import { execFile } from 'node:child_process'
import type { DongleInvalidReason, DongleState } from '../../shared/domain/entitlement'

/**
 * 加密狗读取适配层。
 *
 * 发布构建只接受厂商工具写入的授权结果；开发/测试构建允许用可配置的
 * 卷标或卷序列号做适配（D-02 到位后整体替换 `createVendorReader`）。
 */

export interface DongleReadResult {
  present: boolean
  valid: boolean
  reason?: DongleInvalidReason
  identifierMasked?: string
}

export interface DongleReader {
  read(): Promise<DongleReadResult>
}

export interface VolumeInfo {
  id: string
  label?: string
  serial?: string
}

type ExecFn = (file: string, args: string[]) => Promise<string>

const WINDOWS_VOLUME_SCRIPT = [
  'Get-CimInstance Win32_LogicalDisk -Filter "DriveType=2"',
  '| Select-Object DeviceID,VolumeName,VolumeSerialNumber',
  '| ConvertTo-Json -Compress'
].join(' ')

const defaultExec: ExecFn = (file, args) => new Promise((resolve, reject) => {
  execFile(file, args, { timeout: 3000, windowsHide: true, maxBuffer: 1024 * 1024 }, (error, stdout) => {
    if (error) reject(error)
    else resolve(String(stdout ?? ''))
  })
})

function text(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

/** 解析 `Get-CimInstance Win32_LogicalDisk | ConvertTo-Json` 的输出。 */
export function parseWindowsVolumes(raw: string): VolumeInfo[] {
  const input = String(raw ?? '').trim()
  if (!input) return []
  let parsed: unknown
  try {
    parsed = JSON.parse(input)
  } catch {
    return []
  }
  const rows = Array.isArray(parsed) ? parsed : [parsed]
  return rows.flatMap((row) => {
    if (!row || typeof row !== 'object') return []
    const record = row as Record<string, unknown>
    const id = text(record.DeviceID).replace(/\\+$/, '')
    if (!id) return []
    const label = text(record.VolumeName)
    const serial = text(record.VolumeSerialNumber)
    return [{ id, ...(label ? { label } : {}), ...(serial ? { serial } : {}) }]
  })
}

function normalize(value: string | undefined): string {
  return String(value ?? '').trim().toUpperCase()
}

export function maskIdentifier(value: string | undefined): string | undefined {
  const input = String(value ?? '').trim()
  if (!input) return undefined
  if (input.length <= 4) return input[0] + '***'
  return input.slice(0, 2) + '****' + input.slice(-2)
}

/**
 * 判断可移动卷里是否有配置的授权设备。
 * - 未配置期望标识：设备存在但未写入授权（unwritten），绝不视为有效；
 * - 有匹配：valid；
 * - 有设备但不匹配：rejected；
 * - 没有可移动卷：absent。
 */
export function evaluateVolumes(volumes: VolumeInfo[], expectedIds: string[]): DongleReadResult {
  const expected = expectedIds.map(normalize).filter(Boolean)
  const match = volumes.find((volume) => {
    const candidates = [normalize(volume.label), normalize(volume.serial), normalize(volume.id)]
    return expected.some((value) => candidates.includes(value))
  })
  if (match) {
    return {
      present: true,
      valid: true,
      identifierMasked: maskIdentifier(match.serial || match.label || match.id)
    }
  }
  if (volumes.length === 0) return { present: false, valid: false, reason: 'absent' }
  return { present: true, valid: false, reason: expected.length ? 'rejected' : 'unwritten' }
}

export interface WindowsVolumeReaderOptions {
  expectedIds?: string[]
  exec?: ExecFn
}

export function createWindowsVolumeReader(options: WindowsVolumeReaderOptions = {}): DongleReader {
  const expectedIds = options.expectedIds ?? []
  const exec = options.exec ?? defaultExec
  return {
    async read(): Promise<DongleReadResult> {
      try {
        const raw = await exec('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', WINDOWS_VOLUME_SCRIPT])
        return evaluateVolumes(parseWindowsVolumes(raw), expectedIds)
      } catch {
        // 读取失败必须显式失败，不能回退成“有效”。
        return { present: false, valid: false, reason: 'unreadable' }
      }
    }
  }
}

export type VendorAuthorizationReader = () => Promise<string | null>

/**
 * 读取厂商工具写入的授权结果（D-02）。
 * 发布构建不得信任任意本地 JSON：只有注入的厂商校验函数（SDK/签名校验）可以返回授权；
 * 未注入时一律视为不支持/未授权。
 */
export function createVendorReader(readAuthorization?: VendorAuthorizationReader): DongleReader {
  const source = readAuthorization ?? (async () => null)
  return {
    async read(): Promise<DongleReadResult> {
      let raw: string | null
      try {
        raw = await source()
      } catch {
        return { present: false, valid: false, reason: 'unreadable' }
      }
      if (!raw) return { present: false, valid: false, reason: 'unsupported' }
      try {
        const parsed = JSON.parse(raw) as Record<string, unknown>
        const present = parsed.present === true
        const valid = present && parsed.valid === true
        const identifier = text(parsed.identifier)
        if (valid) return { present: true, valid: true, ...(identifier ? { identifierMasked: maskIdentifier(identifier) } : {}) }
        const reason = typeof parsed.reason === 'string' ? parsed.reason : (present ? 'rejected' : 'absent')
        return { present, valid: false, reason: reason as DongleInvalidReason }
      } catch {
        return { present: false, valid: false, reason: 'unreadable' }
      }
    }
  }
}

export interface ConfiguredReaderOptions {
  packaged: boolean
  env?: NodeJS.ProcessEnv
  platform?: NodeJS.Platform
  exec?: ExecFn
  vendorRead?: VendorAuthorizationReader
}

/** 按构建类型与平台选择读取器；打包构建绝不使用开发期卷标适配。 */
export function createConfiguredReader(options: ConfiguredReaderOptions): DongleReader {
  if (options.packaged) return createVendorReader(options.vendorRead)
  const platform = options.platform ?? process.platform
  if (platform !== 'win32') {
    return { read: async () => ({ present: false, valid: false, reason: 'unsupported' }) }
  }
  const env = options.env ?? process.env
  const expectedIds = String(env.MAXLABEL_DONGLE_IDS ?? '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean)
  return createWindowsVolumeReader({ expectedIds, exec: options.exec })
}

export interface DongleWatcherOptions {
  onChange: (state: DongleState) => void
  intervalMs?: number
  now?: () => number
}

export interface DongleWatcher {
  start(): void
  stop(): void
  readNow(): Promise<DongleState>
  current(): DongleState
}

export function createDongleWatcher(reader: DongleReader, options: DongleWatcherOptions): DongleWatcher {
  const intervalMs = Math.max(250, options.intervalMs ?? 1000)
  const now = options.now ?? Date.now
  let timer: ReturnType<typeof setInterval> | null = null
  let lastKey: string | null = null
  let state: DongleState = { present: false, valid: false, reason: 'absent', checkedAt: new Date(now()).toISOString() }

  const readNow = async (): Promise<DongleState> => {
    const result = await reader.read().catch((): DongleReadResult => ({ present: false, valid: false, reason: 'unreadable' }))
    const next: DongleState = {
      present: result.present,
      valid: result.valid,
      ...(result.reason ? { reason: result.reason } : {}),
      ...(result.identifierMasked ? { identifierMasked: result.identifierMasked } : {}),
      checkedAt: new Date(now()).toISOString()
    }
    const key = JSON.stringify({ p: next.present, v: next.valid, r: next.reason ?? '', i: next.identifierMasked ?? '' })
    state = next
    if (key !== lastKey) {
      lastKey = key
      options.onChange(next)
    }
    return next
  }

  return {
    start() {
      if (timer) return
      void readNow()
      timer = setInterval(() => { void readNow() }, intervalMs)
      const unref = (timer as unknown as { unref?: () => void }).unref
      if (unref) unref.call(timer)
    },
    stop() {
      if (timer) clearInterval(timer)
      timer = null
    },
    readNow,
    current: () => state
  }
}
