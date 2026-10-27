import { ipcMain as electronIpcMain, type BrowserWindow } from 'electron'
import { IPC_CHANNELS } from '../../shared/ipcContract'
import { createUpdateService } from '../update/updateService'
import { assertKnownIpcChannel, secureIpcHandler } from './senderGuard'

/**
 * 注册在线更新 IPC。
 *
 * 主进程独占更新器/安装动作；渲染层只通过白名单通道请求检查/下载/取消/安装。
 * onAllowClose 在 install 前允许主窗口关闭，安装失败时复位。
 */
export function registerUpdateIpc(
  getWindow: () => BrowserWindow | null,
  onAllowClose: (allow: boolean) => void
): void {
  const send = (state: unknown) => {
    const window = getWindow()
    if (window && !window.isDestroyed()) {
      window.webContents.send(IPC_CHANNELS.updateChanged, state)
    }
  }
  const service = createUpdateService({ send, onAllowClose })
  const handle = (channel: string, handler: Parameters<typeof electronIpcMain.handle>[1]) => {
    assertKnownIpcChannel(channel)
    electronIpcMain.handle(channel, secureIpcHandler(getWindow, handler as never) as never)
  }
  handle(IPC_CHANNELS.updateCheck, async () => service.check())
  handle(IPC_CHANNELS.updateDownload, async () => service.download())
  handle(IPC_CHANNELS.updateCancel, async () => service.cancel())
  handle(IPC_CHANNELS.updateInstall, async () => service.install())
  handle(IPC_CHANNELS.updateState, async () => service.getState())
}
