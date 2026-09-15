import { open } from 'fs/promises'
import type { CommandPayload, DriverPrintPage } from '../../shared/ipcContract'
import { portConfigError, type DbConnectionConfig, type PortConfig } from '../../shared/domain/printer'
import { MAX_PRINT_PHYSICAL_LABELS } from '../../shared/print/plan'
import { MAX_DRIVER_DATA_BYTES, MAX_PREVIEW_DATA_BYTES, MAX_PREVIEW_PAGES } from '../../shared/print/limits'
import { normalizeServerUrl, requireServerUrl } from '../serverUrlPolicy'

const IMAGE_EXTENSIONS = new Set(['png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp'])
const TEMPLATE_EXTENSIONS = new Set(['msdx', 'json', 'lsdx'])

function asString(value: unknown, label: string, maxLength: number): string {
  if (typeof value !== 'string' || !value.trim() || value.length > maxLength) throw new Error(`${label}无效`)
  return value
}

function finiteInRange(value: unknown, label: string, min: number, max: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < min || value > max) throw new Error(`${label}超出范围`)
  return value
}

export function validateImagePath(filePath: unknown): string {
  const path = asString(filePath, '图片路径', 4096)
  const ext = path.toLowerCase().split('.').pop() ?? ''
  if (!IMAGE_EXTENSIONS.has(ext)) throw new Error('仅支持 PNG/JPG/GIF/WEBP/BMP 图片')
  return path
}

export function validateTemplatePath(filePath: unknown): string {
  const path = asString(filePath, '模板路径', 4096)
  const ext = path.toLowerCase().split('.').pop() ?? ''
  if (!TEMPLATE_EXTENSIONS.has(ext)) throw new Error('模板文件扩展名无效')
  return path
}

export function validateTemplateJson(json: unknown): string {
  const text = asString(json, '模板内容', 16 * 1024 * 1024)
  try {
    JSON.parse(text)
  } catch {
    throw new Error('模板内容不是有效 JSON')
  }
  return text
}

/** Redact database credentials at every persistence boundary, including legacy callers. */
export function redactTemplateJson(json: unknown): string {
  const text = validateTemplateJson(json)
  const parsed = JSON.parse(text) as unknown
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return text
  const value = parsed as Record<string, unknown>
  const doc = value.format === 'maxlabel-msdx' && value.doc && typeof value.doc === 'object'
    ? value.doc as Record<string, unknown>
    : value
  if (doc.connections && typeof doc.connections === 'object' && !Array.isArray(doc.connections)) {
    const safeConnections: Record<string, unknown> = {}
    for (const [id, connection] of Object.entries(doc.connections as Record<string, unknown>)) {
      if (connection && typeof connection === 'object' && !Array.isArray(connection)) {
        const { password: _password, ...safe } = connection as Record<string, unknown>
        safeConnections[id] = safe
      }
    }
    doc.connections = safeConnections
  }
  return JSON.stringify(value, null, 2)
}

export async function readBoundedFile(filePath: string, maxBytes: number): Promise<Buffer> {
  if (!Number.isSafeInteger(maxBytes) || maxBytes < 1) throw new Error('文件大小限制无效')
  const handle = await open(filePath, 'r')
  try {
    const info = await handle.stat()
    if (!info.isFile() || info.size > maxBytes) throw new Error('文件不存在或超过大小限制')
    // Read exactly the size observed from the same open handle. This avoids
    // the stat/read TOCTOU gap in the old implementation and never consumes
    // bytes appended after the size check.
    const buffer = Buffer.allocUnsafe(info.size)
    let offset = 0
    while (offset < buffer.length) {
      const result = await handle.read(buffer, offset, buffer.length - offset, offset)
      if (!result.bytesRead) break
      offset += result.bytesRead
    }
    return offset === buffer.length ? buffer : buffer.subarray(0, offset)
  } finally {
    await handle.close()
  }
}

export function validateDataUrl(dataUrl: unknown, label = '图片数据'): string {
  const value = asString(dataUrl, label, 64 * 1024 * 1024)
  if (!/^data:image\/(png|jpeg|gif|webp|bmp);base64,[A-Za-z0-9+/=]+$/.test(value)) throw new Error(`${label}格式无效`)
  return value
}

export function validateBarcodeExportPayload(payload: unknown): Array<{ name: string; dataUrl: string }> {
  if (!payload || typeof payload !== 'object') throw new Error('条码导出参数无效')
  const items = (payload as Record<string, unknown>).items
  if (!Array.isArray(items) || items.length > 5000) throw new Error('条码导出数量无效')
  const names = new Set<string>()
  return items.map((item, index) => {
    if (!item || typeof item !== 'object') throw new Error(`第 ${index + 1} 个条码参数无效`)
    const value = item as Record<string, unknown>
    const name = asString(value.name, '条码文件名', 255).replace(/[\\/:*?"<>|]/g, '_').trim()
    if (!name || name === '.' || name === '..') throw new Error(`第 ${index + 1} 个条码文件名无效`)
    if (names.has(name)) throw new Error(`条码文件名重复：${name}`)
    names.add(name)
    return { name, dataUrl: validateDataUrl(value.dataUrl, '条码图片') }
  })
}

export function validatePrintJobId(value: unknown): string {
  return asString(value, '打印任务 ID', 128).trim()
}

export function validateRequestId(value: unknown): string {
  return asString(value, '请求 ID', 128).trim()
}

export function validatePrintPayload(payload: unknown): { pages: DriverPrintPage[]; widthMm: number; heightMm: number; printerName?: string } {
  if (!payload || typeof payload !== 'object') throw new Error('打印参数无效')
  const value = payload as Record<string, unknown>
  if (!Array.isArray(value.pages) || value.pages.length < 1 || value.pages.length > 10000) throw new Error('驱动打印页数无效')
  const pages = value.pages.map((item, index) => {
    if (!item || typeof item !== 'object') throw new Error(`第 ${index + 1} 个打印页无效`)
    const page = item as Record<string, unknown>
    return {
      dataUrl: validateDataUrl(page.dataUrl, `第 ${index + 1} 页打印图片`),
      copies: Math.floor(finiteInRange(page.copies ?? 1, `第 ${index + 1} 页份数`, 1, 99999))
    }
  })
  const physicalPages = pages.reduce((sum, page) => sum + page.copies, 0)
  if (physicalPages > MAX_PRINT_PHYSICAL_LABELS) throw new Error(`实际打印标签数量超过限制（最大 ${MAX_PRINT_PHYSICAL_LABELS} 张）`)
  const totalBytes = pages.reduce((sum, page) => sum + Buffer.byteLength(page.dataUrl), 0)
  if (totalBytes > MAX_DRIVER_DATA_BYTES) throw new Error(`驱动打印图片总数据超过 ${Math.round(MAX_DRIVER_DATA_BYTES / 1024 / 1024)} MB 限制`)
  const printerName = value.printerName === undefined || value.printerName === ''
    ? undefined
    : asString(value.printerName, '打印机名称', 255).trim()
  return {
    pages,
    widthMm: finiteInRange(value.widthMm, '打印宽度', 0.1, 2000),
    heightMm: finiteInRange(value.heightMm, '打印高度', 0.1, 2000),
    ...(printerName ? { printerName } : {})
  }
}

export function validatePort(port: unknown): PortConfig {
  if (!port || typeof port !== 'object') throw new Error('打印端口配置无效')
  const value = port as Record<string, unknown>
  const type = value.type
  if (!['driver', 'file', 'tcp', 'com', 'lpt', 'usb', 'bluetooth'].includes(String(type))) throw new Error('打印端口类型无效')
  const encoding = value.encoding === 'gbk' ? 'gbk' : value.encoding === 'utf8' ? 'utf8' : undefined
  if (!encoding) throw new Error('打印编码无效')
  const result: PortConfig = { type: type as PortConfig['type'], encoding }
  if (type === 'tcp') {
    result.tcpHost = asString(value.tcpHost, 'TCP 地址', 255).trim()
    result.tcpPort = Math.floor(finiteInRange(value.tcpPort, 'TCP 端口', 1, 65535))
  }
  if (type === 'com' || type === 'bluetooth') result.comPort = asString(value.comPort, '串口名称', 32).trim()
  if (type === 'lpt') result.lptPort = asString(value.lptPort ?? 'LPT1', 'LPT 端口', 32).trim()
  if (value.baudRate !== undefined) result.baudRate = Math.floor(finiteInRange(value.baudRate, '波特率', 300, 4000000))
  const error = portConfigError(result)
  if (error) throw new Error(error)
  return result
}

export function validateDbConnection(value: unknown): DbConnectionConfig {
  if (!value || typeof value !== 'object') throw new Error('数据库连接配置无效')
  const raw = value as Record<string, unknown>
  const driver = raw.driver
  if (!['sqlserver', 'mysql', 'sqlite', 'dsn'].includes(String(driver))) throw new Error('数据库驱动无效')
  const result: DbConnectionConfig = {
    id: asString(raw.id ?? 'connection', '数据库连接 ID', 128),
    name: asString(raw.name ?? '数据库连接', '数据库连接名称', 255),
    driver: driver as DbConnectionConfig['driver']
  }
  if (raw.authMode !== undefined && raw.authMode !== 'windows' && raw.authMode !== 'sql') throw new Error('数据库身份验证方式无效')
  if (raw.authMode !== undefined) result.authMode = raw.authMode
  for (const key of ['dsn', 'server', 'database', 'user', 'password', 'filePath', 'datasetName', 'tableName'] as const) {
    if (raw[key] !== undefined) {
      if (typeof raw[key] !== 'string' || raw[key].length > 4096) throw new Error(`数据库字段 ${key}无效`)
      // 空密码/空可选字段是合法的：空密码允许驱动使用 Windows 集成认证，
      // 也不能覆盖已保存在系统安全存储中的密码。
      if (raw[key].length > 0) result[key] = raw[key]
    }
  }
  if (raw.timeoutSec !== undefined) result.timeoutSec = Math.floor(finiteInRange(raw.timeoutSec, '数据库超时时间', 1, 3600))
  if (raw.autoRefresh !== undefined) {
    if (typeof raw.autoRefresh !== 'boolean') throw new Error('数据库自动刷新配置无效')
    result.autoRefresh = raw.autoRefresh
  }
  if (raw.sql !== undefined) result.sql = asString(raw.sql, '数据库查询语句', 4 * 1024 * 1024)
  return result
}

export function validateSql(value: unknown): string {
  return asString(value, '数据库查询语句', 4 * 1024 * 1024)
}

export function validateServerUrl(value: unknown): string {
  return requireServerUrl(asString(value, '服务器地址', 2048))
}

/** 云模板允许空地址，空地址表示本机 userData 离线库；远程地址仍遵循同一安全策略。 */
export function validateCloudServerUrl(value: unknown): string {
  if (value === undefined || value === null) return ''
  if (typeof value !== 'string' || value.length > 2048) throw new Error('服务器地址无效')
  const normalized = normalizeServerUrl(value)
  if (normalized === null) throw new Error('服务器地址无效；远程服务器必须使用 HTTPS，本机地址可使用 HTTP')
  return normalized
}

export function validateCloudEmail(value: unknown): string {
  const email = asString(value, '邮箱', 320).trim().toLowerCase()
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw new Error('邮箱格式无效')
  return email
}

export function validateCloudPassword(value: unknown): string {
  if (typeof value !== 'string' || value.length < 1 || value.length > 128) throw new Error('云端密码长度无效（1-128 位）')
  return value
}

export function validateCloudToken(value: unknown): string {
  const token = asString(value, '云端 Token', 4096).trim()
  if (/[^\x21-\x7e]/.test(token)) throw new Error('云端 Token 无效')
  return token
}
export function validateCloudId(value: unknown): string { return asString(value, '云端模板 ID', 255) }
export function validateCloudName(value: unknown): string { return asString(value, '云端模板名称', 255).trim() }

export function validateCommandPayload(payload: unknown): CommandPayload {
  if (!payload || typeof payload !== 'object') throw new Error('指令打印参数无效')
  const value = payload as Record<string, unknown>
  const encoding = value.encoding === 'gbk' ? 'gbk' : value.encoding === 'utf8' ? 'utf8' : undefined
  if (!encoding) throw new Error('指令编码无效')
  const segments = value.segments
  if (segments !== undefined && (!Array.isArray(segments) || segments.length > 100000)) throw new Error('指令分段无效')
  if (segments !== undefined && value.text !== undefined) throw new Error('指令不能同时提供 segments 和 text')
  let total = 0
  const safeSegments = segments?.map((item) => {
    if (!item || typeof item !== 'object') throw new Error('指令分段无效')
    const segment = item as Record<string, unknown>
    if (segment.type === 'text') {
      const str = asString(segment.str, '指令文本', 16 * 1024 * 1024)
      total += Buffer.byteLength(str)
      return { type: 'text' as const, str }
    }
    if (segment.type === 'bin' && segment.data instanceof Uint8Array) {
      total += segment.data.byteLength
      return { type: 'bin' as const, data: segment.data }
    }
    throw new Error('指令分段类型无效')
  })
  if (total > 64 * 1024 * 1024) throw new Error('打印指令超过 64 MB 限制')
  const text = value.text === undefined ? undefined : asString(value.text, '指令文本', 16 * 1024 * 1024)
  if (!safeSegments?.length && text === undefined) throw new Error('打印指令为空')
  return { segments: safeSegments, text, encoding, port: validatePort(value.port) }
}

export function validatePreviewPayload(payload: unknown): { dataUrl?: string; pages?: string[]; widthMm: number; heightMm: number; truncated?: boolean } {
  if (!payload || typeof payload !== 'object') throw new Error('预览参数无效')
  const value = payload as Record<string, unknown>
  if (Array.isArray(value.pages) && value.pages.length > MAX_PREVIEW_PAGES) throw new Error(`预览页数超过 ${MAX_PREVIEW_PAGES} 页限制`)
  const pages = Array.isArray(value.pages) ? value.pages.map((item) => validateDataUrl(item, '预览图片')) : undefined
  const dataUrl = value.dataUrl === undefined ? undefined : validateDataUrl(value.dataUrl, '预览图片')
  if (!pages?.length && !dataUrl) throw new Error('预览图片为空')
  const totalBytes = (pages ?? []).reduce((sum, page) => sum + Buffer.byteLength(page), dataUrl ? Buffer.byteLength(dataUrl) : 0)
  if (totalBytes > MAX_PREVIEW_DATA_BYTES) throw new Error(`预览数据超过 ${Math.round(MAX_PREVIEW_DATA_BYTES / 1024 / 1024)} MB 限制`)
  return {
    dataUrl,
    pages,
    widthMm: finiteInRange(value.widthMm, '预览宽度', 0.1, 2000),
    heightMm: finiteInRange(value.heightMm, '预览高度', 0.1, 2000),
    ...(value.truncated === undefined ? {} : { truncated: value.truncated === true })
  }
}

export function validatePrintLogPayload(payload: unknown): { time: string; title: string; mode: string; count: number; copies: number; physicalCount?: number; status?: 'completed' | 'submitted' | 'partial' | 'failed' | 'canceled' | 'unknown'; sentCount?: number; test: boolean; printer: string; dataSnapshot?: string[] } {
  if (!payload || typeof payload !== 'object') throw new Error('打印日志参数无效')
  const value = payload as Record<string, unknown>
  const text = (input: unknown, label: string, max: number, required = false): string => {
    if (typeof input !== 'string' || input.length > max || (required && !input.trim())) throw new Error(`${label}无效`)
    return input
  }
  const integer = (input: unknown, label: string, min: number, max: number): number => {
    if (typeof input !== 'number' || !Number.isInteger(input) || input < min || input > max) throw new Error(`${label}无效`)
    return input
  }
  const snapshots = value.dataSnapshot
  let dataSnapshot: string[] | undefined
  if (snapshots !== undefined) {
    if (!Array.isArray(snapshots) || snapshots.length > 100000) throw new Error('打印日志数据快照无效')
    let total = 0
    dataSnapshot = snapshots.map((item) => {
      const line = text(item, '打印日志快照', 1024 * 1024)
      total += line.length
      return line
    })
    if (total > 16 * 1024 * 1024) throw new Error('打印日志数据快照过大')
  }
  const physicalCount = value.physicalCount === undefined ? undefined : integer(value.physicalCount, '实际标签张数', 0, 100000 * 99999)
  const statuses = new Set(['completed', 'submitted', 'partial', 'failed', 'canceled', 'unknown'])
  const status = value.status === undefined ? undefined : (typeof value.status === 'string' && statuses.has(value.status) ? value.status as 'completed' | 'submitted' | 'partial' | 'failed' | 'canceled' | 'unknown' : (() => { throw new Error('打印状态无效') })())
  const sentCount = value.sentCount === undefined ? undefined : integer(value.sentCount, '已发送标签张数', 0, 100000 * 99999)
  if (typeof value.test !== 'boolean') throw new Error('打印日志类型无效')
  return {
    time: text(value.time, '打印时间', 128, true),
    title: text(value.title, '打印模板名称', 255),
    mode: value.mode === 'driver' || value.mode === 'command' ? value.mode : (() => { throw new Error('打印方式无效') })(),
    count: integer(value.count, '打印数量', 0, 100000),
    copies: integer(value.copies, '单签拷贝数', 0, 99999),
    ...(physicalCount === undefined ? {} : { physicalCount }),
    ...(status === undefined ? {} : { status }),
    ...(sentCount === undefined ? {} : { sentCount }),
    test: value.test,
    printer: text(value.printer, '打印机', 255),
    ...(dataSnapshot === undefined ? {} : { dataSnapshot })
  }
}
