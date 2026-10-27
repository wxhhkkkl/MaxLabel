import { app } from 'electron'
import { autoUpdater, CancellationToken } from 'electron-updater'
import type {
  UpdateActionResult,
  UpdateCheckResultDto,
  UpdateProgressDto,
  UpdateStateDto
} from '../../shared/ipcContract'
import { resolveUpdateFeedUrl } from './updateConfig'
import { createTestUpdater } from './updateTestAdapter'
import type { UpdaterLike } from './updateTypes'

const VERSION_PATTERN = /^\d+(\.\d+)*$/
const MAX_RELEASE_NOTES = 4000

export interface UpdateServiceOptions {
  updater?: UpdaterLike
  currentVersion?: string
  packaged?: boolean
  feedOverride?: string
  /** 仅非打包构建；来自 MAXLABEL_TEST_UPDATE。 */
  testMode?: string
  send?: (state: UpdateStateDto) => void
  /** 安装前允许主窗口关闭；安装失败时传 false 复位。 */
  onAllowClose?: (allow: boolean) => void
  progressThrottleMs?: number
}

/** 去掉 v 前缀与预发布后缀，只留数字段；非法返回 null。 */
export function normalizeVersion(value: unknown): string | null {
  const raw = String(value ?? '').trim().replace(/^v/i, '')
  const core = raw.split(/[-+]/)[0]
  return VERSION_PATTERN.test(core) ? core : null
}

/** 逐段比较版本号：a<b 返回 -1，a=b 返回 0，a>b 返回 1。 */
export function compareVersions(a: unknown, b: unknown): number {
  const left = (normalizeVersion(a) ?? '0').split('.').map(Number)
  const right = (normalizeVersion(b) ?? '0').split('.').map(Number)
  const length = Math.max(left.length, right.length)
  for (let index = 0; index < length; index += 1) {
    const diff = (left[index] ?? 0) - (right[index] ?? 0)
    if (diff !== 0) return diff > 0 ? 1 : -1
  }
  return 0
}

function releaseNotesText(value: unknown): string | undefined {
  if (typeof value === 'string') {
    const text = value.trim().slice(0, MAX_RELEASE_NOTES)
    return text || undefined
  }
  if (!Array.isArray(value)) return undefined
  const parts = value
    .map((item) => {
      if (typeof item === 'string') return item
      if (item && typeof item === 'object' && 'note' in item) {
        return String((item as { note?: unknown }).note ?? '')
      }
      return ''
    })
    .map((part) => part.trim())
    .filter(Boolean)
  const text = parts.join('\n').slice(0, MAX_RELEASE_NOTES)
  return text || undefined
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

function numberOrZero(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0
}

export class UpdateService {
  private readonly updater: UpdaterLike
  private readonly currentVersion: string
  private readonly packaged: boolean
  private readonly feedOverride?: string
  private readonly send: (state: UpdateStateDto) => void
  private readonly onAllowClose: (allow: boolean) => void
  private readonly progressThrottleMs: number
  private readonly cancelToken: { current: CancellationToken | null } = { current: null }
  private lastProgressSent = 0
  private state: UpdateStateDto

  constructor(options: UpdateServiceOptions = {}) {
    this.packaged = options.packaged ?? app.isPackaged
    this.testMode = options.testMode ?? (this.packaged ? undefined : process.env.MAXLABEL_TEST_UPDATE)
    this.updater = options.updater ?? (this.testMode ? createTestUpdater(this.testMode) : autoUpdater as unknown as UpdaterLike)
    this.currentVersion = normalizeVersion(options.currentVersion ?? app.getVersion()) ?? '0'
    this.feedOverride = options.feedOverride ?? process.env.MAXLABEL_UPDATE_URL
    this.send = options.send ?? (() => undefined)
    this.onAllowClose = options.onAllowClose ?? (() => undefined)
    this.progressThrottleMs = options.progressThrottleMs ?? 250
    this.state = { state: 'idle', current: this.currentVersion }
    this.configure()
    this.bindEvents()
    app.on('before-quit', () => {
      if (this.state.state === 'downloading') this.cancel()
    })
  }

  private readonly testMode?: string

  private configure(): void {
    this.updater.autoDownload = false
    this.updater.autoInstallOnAppQuit = false
    this.updater.allowDowngrade = false
    this.updater.allowPrerelease = false
    const feed = resolveUpdateFeedUrl({ packaged: this.packaged, override: this.feedOverride })
    try {
      this.updater.setFeedURL?.({ provider: 'generic', url: feed })
    } catch {
      // 打包配置缺失时由 check/download 的失败路径如实回报，不在构造期抛错。
    }
  }

  private bindEvents(): void {
    this.updater.on('download-progress', (progress: unknown) => this.handleProgress(progress))
    this.updater.on('update-downloaded', (info: unknown) => this.handleDownloaded(info))
    this.updater.on('error', (error: unknown) => {
      if (this.state.state !== 'downloading' && this.state.state !== 'checking') return
      this.fail(error, this.state.state === 'checking' ? 'update.error.network' : 'update.error.download')
    })
  }

  getState(): UpdateStateDto {
    return {
      ...this.state,
      ...(this.state.progress ? { progress: { ...this.state.progress } } : {})
    }
  }

  async check(): Promise<UpdateCheckResultDto> {
    // 手动检查不得打断正在下载/已下载待安装/安装中的会话。
    if (this.state.state === 'downloading' || this.state.state === 'ready' || this.state.state === 'installing') {
      return {
        status: this.state.latest ? 'update' : 'latest',
        current: this.currentVersion,
        ...(this.state.latest ? { latest: this.state.latest } : {}),
        ...(this.state.notes ? { notes: this.state.notes } : {}),
        ...(this.state.releaseDate ? { releaseDate: this.state.releaseDate } : {})
      }
    }
    this.setState({
      state: 'checking',
      latest: undefined,
      notes: undefined,
      releaseDate: undefined,
      progress: undefined,
      error: undefined,
      messageKey: undefined
    })
    try {
      const result = await this.updater.checkForUpdates()
      const rawVersion = result?.updateInfo?.version
      const latest = normalizeVersion(rawVersion)
      if (!latest) {
        this.setState({ state: 'latest', latest: this.currentVersion })
        return { status: 'latest', current: this.currentVersion }
      }
      if (compareVersions(latest, this.currentVersion) <= 0) {
        this.setState({ state: 'latest', latest: this.currentVersion })
        return { status: 'latest', current: this.currentVersion }
      }
      const notes = releaseNotesText(result?.updateInfo?.releaseNotes)
      const releaseDate = typeof result?.updateInfo?.releaseDate === 'string'
        ? result.updateInfo.releaseDate
        : undefined
      this.setState({ state: 'available', latest, ...(notes ? { notes } : {}), ...(releaseDate ? { releaseDate } : {}) })
      return {
        status: 'update',
        current: this.currentVersion,
        latest,
        ...(notes ? { notes } : {}),
        ...(releaseDate ? { releaseDate } : {})
      }
    } catch (error) {
      const message = errorMessage(error)
      this.setState({ state: 'error', error: message, messageKey: 'update.error.network' })
      return {
        status: 'unavailable',
        current: this.currentVersion,
        message,
        messageKey: 'update.error.network'
      }
    }
  }

  download(): UpdateActionResult {
    if (this.state.state === 'downloading' || this.state.state === 'ready' || this.state.state === 'installing') {
      return { ok: true }
    }
    if (this.state.state !== 'available') {
      return { ok: false, error: '当前没有可下载的更新', messageKey: 'update.error.noUpdate' }
    }
    const token = new CancellationToken()
    this.cancelToken.current = token
    this.lastProgressSent = 0
    this.setState({
      state: 'downloading',
      progress: { percent: 0, transferred: 0, total: 0, bytesPerSecond: 0 },
      error: undefined,
      messageKey: undefined
    })
    void this.updater.downloadUpdate(token).catch((error) => {
      if (token.cancelled) return
      this.fail(error, 'update.error.download')
    })
    return { ok: true }
  }

  cancel(): { ok: boolean; canceled: boolean } {
    if (this.state.state !== 'downloading') return { ok: true, canceled: false }
    this.cancelToken.current?.cancel()
    this.cancelToken.current = null
    this.setState({ state: 'available', progress: undefined })
    return { ok: true, canceled: true }
  }

  install(): UpdateActionResult {
    if (this.state.state !== 'ready') {
      return { ok: false, error: '更新尚未下载完成', messageKey: 'update.error.notReady' }
    }
    this.setState({ state: 'installing' })
    this.onAllowClose(true)
    try {
      this.updater.quitAndInstall(false, true)
      return { ok: true }
    } catch (error) {
      this.onAllowClose(false)
      const message = errorMessage(error)
      this.setState({ state: 'error', error: message, messageKey: 'update.error.install' })
      return { ok: false, error: message, messageKey: 'update.error.install' }
    }
  }

  private handleProgress(value: unknown): void {
    if (this.state.state !== 'downloading') return
    const progress = (value && typeof value === 'object' ? value : {}) as Record<string, unknown>
    const next: UpdateProgressDto = {
      percent: Math.max(0, Math.min(100, Math.round(numberOrZero(progress.percent) * 10) / 10)),
      transferred: numberOrZero(progress.transferred),
      total: numberOrZero(progress.total),
      bytesPerSecond: numberOrZero(progress.bytesPerSecond)
    }
    this.state = { ...this.state, progress: next }
    const now = Date.now()
    if (next.percent >= 100 || now - this.lastProgressSent >= this.progressThrottleMs) {
      this.lastProgressSent = now
      this.emit()
    }
  }

  private handleDownloaded(value: unknown): void {
    if (this.state.state !== 'downloading') return
    const info = (value && typeof value === 'object' ? value : {}) as Record<string, unknown>
    const latest = normalizeVersion(info.version) ?? this.state.latest
    const total = this.state.progress?.total ?? 0
    this.setState({
      state: 'ready',
      ...(latest ? { latest } : {}),
      progress: { percent: 100, transferred: total, total, bytesPerSecond: 0 }
    })
  }

  private fail(error: unknown, messageKey: string): void {
    const message = errorMessage(error)
    this.setState({ state: 'error', error: message, messageKey })
  }

  private setState(patch: Partial<UpdateStateDto>): void {
    this.state = { ...this.state, ...patch }
    this.emit()
  }

  private emit(): void {
    this.send(this.getState())
  }
}

export function createUpdateService(options: UpdateServiceOptions = {}): UpdateService {
  return new UpdateService(options)
}
