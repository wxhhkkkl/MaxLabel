// ---------- 数据库连接（ODBC / SQL） ----------
// 通过 Windows PowerShell 的 System.Data.Odbc 执行查询，避免引入原生驱动模块。
// SQL 与连接参数通过 JSON 载荷文件传给 PowerShell 脚本，全程不进命令行 → 无注入风险。
import { execFile } from 'child_process'
import { promisify } from 'util'
import { tmpdir } from 'os'
import { randomUUID } from 'crypto'
import { writeFile, rm } from 'fs/promises'
import { join } from 'path'
import iconv from 'iconv-lite'

const execFileP = promisify(execFile)

export type DbDriver = 'sqlserver' | 'mysql' | 'sqlite' | 'dsn'

export interface DbConnectionConfig {
  id: string
  name: string
  driver: DbDriver
  /** dsn 驱动时：DSN 名称 */
  dsn?: string
  server?: string
  database?: string
  user?: string
  password?: string
  /** sqlite 驱动时：数据库文件路径 */
  filePath?: string
  timeoutSec?: number
}

export function buildConnectionString(c: DbConnectionConfig): string {
  switch (c.driver) {
    case 'sqlserver':
      return [
        'Driver={ODBC Driver 17 for SQL Server}',
        `Server=${c.server ?? ''}`,
        `Database=${c.database ?? ''}`,
        `Uid=${c.user ?? ''}`,
        `Pwd=${c.password ?? ''}`,
        'TrustServerCertificate=yes'
      ].join(';')
    case 'mysql':
      return [
        'Driver={MySQL ODBC 8.0 Unicode Driver}',
        `Server=${c.server ?? ''}`,
        `Database=${c.database ?? ''}`,
        `Uid=${c.user ?? ''}`,
        `Pwd=${c.password ?? ''}`
      ].join(';')
    case 'sqlite':
      return [`Driver={SQLite3 ODBC Driver}`, `Database=${c.filePath ?? ''}`].join(';')
    case 'dsn':
      return [`DSN=${c.dsn ?? ''}`, `Uid=${c.user ?? ''}`, `Pwd=${c.password ?? ''}`].join(';')
  }
}

const PS_TEMPLATE = `
$ErrorActionPreference = 'Stop'
$payload = Get-Content -Raw -Encoding UTF8 '{PAYLOAD}'
$p = $payload | ConvertFrom-Json
Add-Type -AssemblyName System.Data
$conn = New-Object System.Data.Odbc.OdbcConnection($p.connectionString)
try {
  $conn.Open()
  $cmd = $conn.CreateCommand()
  $cmd.CommandText = $p.query
  $cmd.CommandTimeout = [int]$p.timeout
  $adapter = New-Object System.Data.Odbc.OdbcDataAdapter($cmd)
  $dt = New-Object System.Data.DataTable
  $adapter.Fill($dt) | Out-Null
  $rows = @()
  foreach ($r in $dt.Rows) {
    $o = @{}
    foreach ($c in $dt.Columns) {
      $v = $r[$c.ColumnName]
      if ($null -eq $v -or [System.DBNull]::Value -eq $v) { $o[$c.ColumnName] = $null }
      else { $o[$c.ColumnName] = [string]$v }
    }
    $rows += $o
  }
  $conn.Close()
  $rows | ConvertTo-Json -Depth 3 -Compress
} catch {
  $conn.Close()
  throw
}
`

async function runOdbc(c: DbConnectionConfig, query: string, timeoutSec: number): Promise<{ rows: Array<Record<string, string | null>>; error?: string }> {
  const id = randomUUID()
  const payloadPath = join(tmpdir(), `maxlabel-odbc-${id}.json`)
  const scriptPath = join(tmpdir(), `maxlabel-odbc-${id}.ps1`)
  const payload = {
    connectionString: buildConnectionString(c),
    query: String(query || ''),
    timeout: Math.max(5, timeoutSec || 15)
  }
  try {
    await writeFile(payloadPath, JSON.stringify(payload), 'utf-8')
    const script = PS_TEMPLATE.replace('{PAYLOAD}', payloadPath.replace(/\\/g, '\\\\'))
    await writeFile(scriptPath, script, 'utf-8')
    const { stdout } = await execFileP(
      'powershell.exe',
      ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', scriptPath],
      { timeout: Math.max(15000, (timeoutSec || 15) * 1000 + 10000), maxBuffer: 64 * 1024 * 1024, windowsHide: true }
    )
    const out = (stdout || '').trim()
    if (!out) return { rows: [] }
    const parsed = JSON.parse(out)
    const rows = Array.isArray(parsed)
      ? parsed.map((r: unknown) => (r && typeof r === 'object' ? (r as Record<string, string | null>) : {}))
      : []
    return { rows }
  } catch (err) {
    const e = err as { stderr?: Buffer | string; message?: string }
    let msg = String(e.stderr ?? e.message ?? err)
    if (Buffer.isBuffer(e.stderr)) {
      // PowerShell 输出多为 GBK 编码，按 UTF-8 可解析则用之，否则转 GBK
      try {
        const utf = iconv.decode(e.stderr, 'utf8')
        if (!utf.includes('\uFFFD')) msg = utf
        else msg = iconv.decode(e.stderr, 'gb18030')
      } catch {
        msg = iconv.decode(e.stderr, 'gb18030')
      }
    }
    return { rows: [], error: msg.trim() }
  } finally {
    try {
      await rm(payloadPath, { force: true })
      await rm(scriptPath, { force: true })
    } catch {
      /* ignore */
    }
  }
}

export async function dbTestConnection(c: DbConnectionConfig): Promise<{ ok: boolean; error?: string; message?: string }> {
  const res = await runOdbc(c, 'SELECT 1 AS ok', 10)
  if (res.error) return { ok: false, error: res.error }
  return { ok: true, message: '连接成功（SELECT 1 返回 ' + res.rows.length + ' 行）' }
}

export async function dbQuery(
  c: DbConnectionConfig,
  sql: string
): Promise<{ ok: boolean; rows: Array<Record<string, string | null>>; error?: string }> {
  const res = await runOdbc(c, sql, c.timeoutSec ?? 15)
  if (res.error) return { ok: false, rows: [], error: res.error }
  return { ok: true, rows: res.rows }
}
