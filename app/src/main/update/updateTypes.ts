import type { CancellationToken } from 'electron-updater'

export interface UpdateInfoLike {
  version: string
  releaseNotes?: unknown
  releaseDate?: string
}

export interface UpdateCheckResultLike {
  updateInfo: UpdateInfoLike
}

/** 主进程更新服务依赖的最小 updater 接口；便于单测与 e2e 测试适配器替换。 */
export interface UpdaterLike {
  autoDownload: boolean
  autoInstallOnAppQuit: boolean
  allowDowngrade: boolean
  allowPrerelease: boolean
  checkForUpdates(): Promise<UpdateCheckResultLike | null>
  downloadUpdate(token?: CancellationToken): Promise<unknown>
  quitAndInstall(isSilent?: boolean, isForceRunAfter?: boolean): void
  on(event: string, listener: (...args: any[]) => void): unknown
  setFeedURL?(options: { provider: 'generic'; url: string }): void
}
