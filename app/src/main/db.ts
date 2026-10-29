// ---------- 数据库连接 ----------
// SQLite 走 Electron 内置的 node:sqlite（用户无需安装任何驱动）；MySQL 优先使用已安装
// 的 ODBC 驱动，缺失时回退到内置的 mysql2；SQL Server 与 DSN 仍通过 Windows PowerShell
// 的 System.Data.Odbc 执行，避免引入原生驱动模块。
// ODBC 通路的 SQL 与连接参数通过 stdin JSON 载荷传给 PowerShell 脚本，全程不进命令行 → 无注入风险。
import { spawn } from 'child_process'
import { tmpdir } from 'os'
import { randomUUID } from 'crypto'
import { existsSync } from 'fs'
import { writeFile, rm } from 'fs/promises'
import { join } from 'path'
import { Worker } from 'worker_threads'
import iconv from 'iconv-lite'
import mysql from 'mysql2/promise'
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
      return c.authMode === 'windows'
        ? [
        'Driver={ODBC Driver 17 for SQL Server}',
        `Server=${odbcValue(c.server)}`,
        `Database=${odbcValue(c.database)}`,
        'Trusted_Connection=yes',
        'TrustServerCertificate=yes'
      ].join(';')
        : [
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
      // SQLite 已改走内置驱动（node:sqlite），不应再构造 ODBC 连接串
      throw new Error('SQLite 连接不经 ODBC')
    case 'dsn':
      return [`DSN=${odbcValue(c.dsn)}`, `Uid=${odbcValue(c.user)}`, `Pwd=${odbcValue(c.password)}`].join(';')
  }
}

const PS_TEMPLATE = `
$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
$utf8 = [System.Text.UTF8Encoding]::new($false)
[Console]::InputEncoding = $utf8
[Console]::OutputEncoding = $utf8
$OutputEncoding = $utf8
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

/** 在途查询的中止句柄：ODBC 子进程、SQLite worker、MySQL 连接各有一种停法。 */
interface ActiveQuery {
  cancel(): void
}

const activeDbQueries = new Map<string, ActiveQuery>()

function runPowerShell(scriptPath: string, payload: string, timeoutMs: number, requestId?: string): Promise<{ stdout: Buffer; stderr: Buffer }> {
  return new Promise((resolve, reject) => {
    const child = spawn('powershell.exe', ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', scriptPath], { windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'] })
    const entry: ActiveQuery = { cancel: () => child.kill() }
    if (requestId) activeDbQueries.set(requestId, entry)
    const release = () => {
      if (requestId && activeDbQueries.get(requestId) === entry) activeDbQueries.delete(requestId)
    }
    const stdout: Buffer[] = []
    const stderr: Buffer[] = []
    let settled = false
    const timer = setTimeout(() => {
      if (settled) return
      settled = true
      release()
      child.kill()
      reject(Object.assign(new Error('数据库查询超时'), { stderr: Buffer.from('数据库查询超时') }))
    }, timeoutMs)
    const finish = (error?: Error) => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      release()
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
    await writeFile(scriptPath, '\uFEFF' + script, 'utf-8')
    const { stdout } = await runPowerShell(scriptPath, JSON.stringify(payload), Math.max(15000, (timeoutSec || 15) * 1000 + 10000), requestId)
    const out = new TextDecoder('utf-8', { fatal: true }).decode(stdout).trim()
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

// ---------- 内置驱动：SQLite（node:sqlite） ----------

/** 查询在独立 worker 中执行：node:sqlite 是同步 API，直接放在主进程会把界面卡死。
 * 注意 terminate() 打断不了 worker 里正在执行的 SQLite 语句（node:sqlite 没有 interrupt API），
 * 超时/取消只是让调用方立刻拿到结果，worker 要等当前语句返回后才真正退出。 */
const SQLITE_WORKER_SOURCE = `
const { parentPort, workerData } = require('node:worker_threads')
const { DatabaseSync } = require('node:sqlite')

function cell(value) {
  if (value === null || value === undefined) return null
  if (typeof value === 'bigint') return value.toString()
  if (value instanceof Uint8Array) return Buffer.from(value).toString('base64')
  return typeof value === 'string' ? value : String(value)
}

try {
  const db = new DatabaseSync(workerData.file)
  try {
    const rows = []
    for (const raw of db.prepare(workerData.sql).iterate()) {
      if (rows.length >= workerData.maxRows) throw new Error('查询结果行数超过限制')
      const keys = Object.keys(raw)
      if (keys.length > workerData.maxColumns) throw new Error('查询结果字段数超过限制')
      const row = {}
      for (const key of keys) {
        const text = cell(raw[key])
        if (text !== null && text.length > workerData.maxCellLength) throw new Error('查询结果单元格过大')
        row[key] = text
      }
      rows.push(row)
    }
    parentPort.postMessage({ ok: true, rows })
  } finally {
    db.close()
  }
} catch (error) {
  parentPort.postMessage({ ok: false, error: String(error && error.message ? error.message : error) })
}
`

type DbRows = Array<Record<string, string | null>>
interface DbResult {
  rows: DbRows
  error?: string
}

function runSqlite(c: DbConnectionConfig, sql: string, timeoutSec: number, requestId?: string): Promise<DbResult> {
  const file = c.filePath?.trim()
  if (!file) return Promise.resolve({ rows: [], error: '未指定 SQLite 数据库文件' })
  // SQLite 打开不存在的路径会顺手建一个空库，这里必须先拦下，否则拼错路径也会"连接成功"
  if (!existsSync(file)) return Promise.resolve({ rows: [], error: '数据库文件不存在：' + file })

  return new Promise((resolve) => {
    const worker = new Worker(SQLITE_WORKER_SOURCE, {
      eval: true,
      workerData: {
        file,
        sql: String(sql || ''),
        maxRows: MAX_DATASET_ROWS,
        maxColumns: MAX_DATASET_COLUMNS,
        maxCellLength: MAX_DATASET_CELL_LENGTH
      }
    })
    let settled = false
    let timer: NodeJS.Timeout | undefined
    const entry: ActiveQuery = { cancel: () => settle({ rows: [], error: '查询已取消' }) }
    function settle(result: DbResult) {
      if (settled) return
      settled = true
      clearTimeout(timer)
      if (requestId && activeDbQueries.get(requestId) === entry) activeDbQueries.delete(requestId)
      void worker.terminate()
      resolve(result)
    }
    if (requestId) activeDbQueries.set(requestId, entry)
    timer = setTimeout(() => settle({ rows: [], error: '数据库查询超时' }), Math.max(1, timeoutSec || 15) * 1000)
    worker.once('message', (message: { ok: boolean; rows?: DbRows; error?: string }) => {
      if (message.ok) settle({ rows: message.rows ?? [] })
      else settle({ rows: [], error: message.error ?? 'SQLite 查询失败' })
    })
    worker.once('error', (error) => settle({ rows: [], error: error.message }))
  })
}

// ---------- 内置驱动：MySQL（mysql2） ----------

/** 与 ODBC 子进程保持同一种单元格形态：一律字符串，NULL 保留为 null。 */
function cellText(value: unknown): string | null {
  if (value === null || value === undefined) return null
  if (typeof value === 'bigint') return value.toString()
  if (Buffer.isBuffer(value)) return value.toString('base64')
  if (typeof value === 'string') return value
  return String(value)
}

/** 重名列按 ODBC 通路的做法加序号后缀，避免对象键互相覆盖。 */
function uniqueColumnNames(names: string[]): string[] {
  const used = new Set<string>()
  return names.map((raw, index) => {
    const base = raw && raw.trim() ? raw : '列' + (index + 1)
    let name = base
    let suffix = 2
    while (used.has(name)) name = base + '_' + suffix++
    used.add(name)
    return name
  })
}

function splitMysqlTarget(server?: string): { host: string; port: number } {
  const [host, portText] = (server ?? '').trim().split(':')
  const port = Number(portText)
  return { host: host || '127.0.0.1', port: Number.isInteger(port) && port > 0 && port < 65536 ? port : 3306 }
}

async function runMysqlNative(c: DbConnectionConfig, sql: string, timeoutSec: number, requestId?: string): Promise<DbResult> {
  const limitSec = Math.max(1, timeoutSec || 15)
  let connection: mysql.Connection | undefined
  try {
    const password = c.password === undefined ? await readConnectionSecret(c.id) : c.password
    const { host, port } = splitMysqlTarget(c.server)
    connection = await mysql.createConnection({
      host,
      port,
      user: c.user || undefined,
      password: password || undefined,
      database: c.database || undefined,
      // 日期按 MySQL 文本格式返回，避免 Date 被 String() 成 "Wed Oct 29 2026 ..."
      dateStrings: true,
      connectTimeout: Math.min(limitSec * 1000, 30_000)
    })
    if (requestId) activeDbQueries.set(requestId, { cancel: () => connection?.destroy() })
    const [rows, fields] = await connection.query({ sql: String(sql || ''), rowsAsArray: true, timeout: limitSec * 1000 })
    // 非查询语句（INSERT/UPDATE…）没有结果集
    if (!Array.isArray(rows) || !Array.isArray(fields)) return { rows: [] }
    if (rows.length > MAX_DATASET_ROWS || fields.length > MAX_DATASET_COLUMNS) return { rows: [], error: '查询结果超过数据集限制' }
    const names = uniqueColumnNames(fields.map((field) => String(field.name)))
    const out: DbRows = []
    for (const raw of rows as unknown[][]) {
      const row: Record<string, string | null> = {}
      for (let i = 0; i < names.length; i++) {
        const text = cellText(raw[i])
        if (text !== null && text.length > MAX_DATASET_CELL_LENGTH) return { rows: [], error: '查询结果超过数据集限制' }
        row[names[i]] = text
      }
      out.push(row)
    }
    return { rows: out }
  } catch (error) {
    return { rows: [], error: String((error as { message?: string }).message ?? error) }
  } finally {
    if (requestId) activeDbQueries.delete(requestId)
    try {
      await connection?.end()
    } catch {
      /* 连接已断开或已销毁 */
    }
  }
}

/** ODBC 明确报「找不到驱动」才回退到内置驱动；认证失败等真实错误必须原样返回。 */
export function isOdbcDriverMissing(error?: string): boolean {
  return typeof error === 'string' && /IM002|IM003/.test(error)
}

/** 本进程内确认过 MySQL ODBC 驱动缺失后，后续查询直接走内置驱动，不再白跑一次 PowerShell。 */
let mysqlOdbcUnavailable = false

/** MySQL：装了 ODBC 驱动就沿用 ODBC，缺驱动才回退到内置 mysql2。
 * 认证失败、库不存在这类真实错误必须原样返回，不能被回退掩盖。 */
async function runMysql(c: DbConnectionConfig, sql: string, timeoutSec: number, requestId?: string): Promise<DbResult> {
  if (!mysqlOdbcUnavailable) {
    const probe = await runOdbc(c, sql, timeoutSec, requestId)
    if (!probe.error || !isOdbcDriverMissing(probe.error)) return probe
    mysqlOdbcUnavailable = true
  }
  return runMysqlNative(c, sql, timeoutSec, requestId)
}

function runForDriver(c: DbConnectionConfig, sql: string, timeoutSec: number, requestId?: string): Promise<DbResult> {
  if (c.driver === 'sqlite') return runSqlite(c, sql, timeoutSec, requestId)
  if (c.driver === 'mysql') return runMysql(c, sql, timeoutSec, requestId)
  return runOdbc(c, sql, timeoutSec, requestId)
}

// ---------- 对外接口 ----------

export async function dbTestConnection(c: DbConnectionConfig, requestId?: string): Promise<{ ok: boolean; error?: string; message?: string }> {
  const res = await runForDriver(c, 'SELECT 1 AS ok', 10, requestId)
  if (res.error) return { ok: false, error: res.error }
  return { ok: true, message: '连接成功（SELECT 1 返回 ' + res.rows.length + ' 行）' }
}

export async function dbQuery(
  c: DbConnectionConfig,
  sql: string,
  requestId?: string
): Promise<{ ok: boolean; rows: DbRows; error?: string }> {
  const res = await runForDriver(c, sql, c.timeoutSec ?? 15, requestId)
  return res.error ? { ok: false, rows: [], error: res.error } : { ok: true, rows: res.rows }
}

export function cancelDbQuery(requestId: string): boolean {
  const active = activeDbQueries.get(requestId)
  if (!active) return false
  activeDbQueries.delete(requestId)
  active.cancel()
  return true
}
