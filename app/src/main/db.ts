// ---------- 数据库连接（ODBC / SQL） ----------
// 通过 Windows PowerShell 的 System.Data.Odbc 执行查询，避免引入原生驱动模块。
// SQL 与连接参数通过 stdin JSON 载荷传给 PowerShell 脚本，全程不进命令行 → 无注入风险。
import { spawn, type ChildProcess } from 'child_process'
import { tmpdir } from 'os'
import { randomUUID } from 'crypto'
import { writeFile, rm } from 'fs/promises'
import { join } from 'path'
import iconv from 'iconv-lite'
import { MAX_DATASET_CELL_LENGTH, MAX_DATASET_COLUMNS, MAX_DATASET_ROWS } from '../shared/domain/document'
import type { DbConnectionConfig } from '../shared/domain/printer'
import { readConnectionSecret } from './connectionSecrets'


/** ODBC connection-string values are brace-quoted so semicolons and credentials
 * cannot change the meaning of a later attribute. */
function odbcValue(value: string | undefined): string {
  const text = value ?? ''
  if (text.includes('\0') || /[\r\n]/.test(text)) throw new Error('数据库连接参数包含非法控制字符')
  return `{${text.replace(/}/g, '}}')}}`
}

export function buildConnectionString(c: DbConnectionConfig): string {
  switch (c.driver) {
    case 'sqlserver':
      return [
        'Driver={ODBC Driver 17 for SQL Server}',
        `Server=${odbcValue(c.server)}`,
        `Database=${odbcValue(c.database)}`,
        `Uid=${odbcValue(c.user)}`,
        `Pwd=${odbcValue(c.password)}`,
        'TrustServerCertificate=yes'
      ].join(';')
    case 'mysql':
      return [
        'Driver={MySQL ODBC 8.0 Unicode Driver}',
        `Server=${odbcValue(c.server)}`,
        `Database=${odbcValue(c.database)}`,
        `Uid=${odbcValue(c.user)}`,
        `Pwd=${odbcValue(c.password)}`
      ].join(';')
    case 'sqlite':
      return [`Driver={SQLite3 ODBC Driver}`, `Database=${odbcValue(c.filePath)}`].join(';')
    case 'dsn':
      return [`DSN=${odbcValue(c.dsn)}`, `Uid=${odbcValue(c.user)}`, `Pwd=${odbcValue(c.password)}`].join(';')
  }
}

const PS_TEMPLATE = `
$ErrorActionPreference = 'Stop'
$payload = [Console]::In.ReadToEnd()
$p = $payload | ConvertFrom-Json
Add-Type -AssemblyName System.Data
$conn = New-Object System.Data.Odbc.OdbcConnection($p.connectionString)
$reader = $null
try {
  $conn.Open()
  $cmd = $conn.CreateCommand()
  $cmd.CommandText = $p.query
  $cmd.CommandTimeout = [int]$p.timeout
  $reader = $cmd.ExecuteReader()
  if ($reader.FieldCount -gt $p.maxColumns) { throw '查询结果字段数超过限制' }
  $names = @()
  for ($i = 0; $i -lt $reader.FieldCount; $i++) {
    $base = [string]$reader.GetName($i)
    if ([string]::IsNullOrWhiteSpace($base)) { $base = '列' + ($i + 1) }
    $name = $base
    $suffix = 2
    while ($names -contains $name) { $name = $base + '_' + $suffix; $suffix++ }
    $names += $name
  }
  $rows = [System.Collections.Generic.List[object]]::new()
  while ($reader.Read()) {
    if ($rows.Count -ge $p.maxRows) { throw '查询结果行数超过限制' }
    $o = @{}
    for ($i = 0; $i -lt $reader.FieldCount; $i++) {
      $v = $reader.GetValue($i)
      if ($null -eq $v -or [System.DBNull]::Value -eq $v) { $o[$names[$i]] = $null }
      else {
        $text = [string]$v
        if ($text.Length -gt $p.maxCellLength) { throw '查询结果单元格过大' }
        $o[$names[$i]] = $text
      }
    }
    $rows.Add($o)
  }
  $reader.Close()
  $conn.Close()
  # Windows PowerShell unwraps a one-item collection when it is piped.  Force
  # an array so a query returning exactly one row has the same JSON shape as
  # every other query result.
  ConvertTo-Json -InputObject @($rows.ToArray()) -Depth 3 -Compress
} catch {
  if ($null -ne $reader) { try { $reader.Close() } catch {} }
  $conn.Close()
  throw
}
`

const activeDbProcesses = new Map<string, ChildProcess>()

function runPowerShell(scriptPath: string, payload: string, timeoutMs: number, requestId?: string): Promise<{ stdout: Buffer; stderr: Buffer }> {
  return new Promise((resolve, reject) => {
    const child = spawn('powershell.exe', ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', scriptPath], { windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'] })
    if (requestId) activeDbProcesses.set(requestId, child)
    const stdout: Buffer[] = []
    const stderr: Buffer[] = []
    let settled = false
    const timer = setTimeout(() => {
      if (settled) return
      settled = true
      if (requestId && activeDbProcesses.get(requestId) === child) activeDbProcesses.delete(requestId)
      child.kill()
      reject(Object.assign(new Error('数据库查询超时'), { stderr: Buffer.from('数据库查询超时') }))
    }, timeoutMs)
    const finish = (error?: Error) => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      if (requestId && activeDbProcesses.get(requestId) === child) activeDbProcesses.delete(requestId)
      if (error) {
        Object.assign(error, { stderr: Buffer.concat(stderr) })
        reject(error)
      } else resolve({ stdout: Buffer.concat(stdout), stderr: Buffer.concat(stderr) })
    }
    child.stdout.on('data', (chunk: Buffer) => stdout.push(Buffer.from(chunk)))
    child.stderr.on('data', (chunk: Buffer) => stderr.push(Buffer.from(chunk)))
    child.once('error', (error) => finish(error))
    child.once('close', (code) => finish(code === 0 ? undefined : new Error(`PowerShell 查询失败（退出码 ${code ?? 'unknown'}）`)))
    child.stdin.end(payload, 'utf8')
  })
}

async function runOdbc(c: DbConnectionConfig, query: string, timeoutSec: number, requestId?: string): Promise<{ rows: Array<Record<string, string | null>>; error?: string }> {
  const id = randomUUID()
  const scriptPath = join(tmpdir(), `maxlabel-odbc-${id}.ps1`)
  try {
    const password = c.password === undefined ? await readConnectionSecret(c.id) : c.password
    const payload = {
      connectionString: buildConnectionString({ ...c, password }),
      query: String(query || ''),
      timeout: Math.max(5, timeoutSec || 15),
      maxRows: MAX_DATASET_ROWS,
      maxColumns: MAX_DATASET_COLUMNS,
      maxCellLength: MAX_DATASET_CELL_LENGTH
    }
    const script = PS_TEMPLATE
    await writeFile(scriptPath, script, 'utf-8')
    const { stdout } = await runPowerShell(scriptPath, JSON.stringify(payload), Math.max(15000, (timeoutSec || 15) * 1000 + 10000), requestId)
    const out = stdout.toString('utf8').trim()
    if (!out) return { rows: [] }
    const parsed = JSON.parse(out)
    const rows = Array.isArray(parsed)
      ? parsed.map((r: unknown) => (r && typeof r === 'object' ? (r as Record<string, string | null>) : {}))
      : []
    if (rows.length > MAX_DATASET_ROWS || rows.some((row) => Object.keys(row).length > MAX_DATASET_COLUMNS)) return { rows: [], error: '查询结果超过数据集限制' }
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
      await rm(scriptPath, { force: true })
    } catch {
      /* ignore */
    }
  }
}

export async function dbTestConnection(c: DbConnectionConfig, requestId?: string): Promise<{ ok: boolean; error?: string; message?: string }> {
  const res = await runOdbc(c, 'SELECT 1 AS ok', 10, requestId)
  if (res.error) return { ok: false, error: res.error }
  return { ok: true, message: '连接成功（SELECT 1 返回 ' + res.rows.length + ' 行）' }
}

export async function dbQuery(
  c: DbConnectionConfig,
  sql: string,
  requestId?: string
): Promise<{ ok: boolean; rows: Array<Record<string, string | null>>; error?: string }> {
  const res = await runOdbc(c, sql, c.timeoutSec ?? 15, requestId)
  if (res.error) return { ok: false, rows: [], error: res.error }
  return { ok: true, rows: res.rows }
}

export function cancelDbQuery(requestId: string): boolean {
  const child = activeDbProcesses.get(requestId)
  if (!child) return false
  activeDbProcesses.delete(requestId)
  return child.kill()
}
