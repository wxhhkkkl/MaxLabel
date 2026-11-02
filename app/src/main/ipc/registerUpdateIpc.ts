import { app, ipcMain as electronIpcMain, type BrowserWindow } from 'electron'
import { IPC_CHANNELS } from '../../shared/ipcContract'
import { createUpdateService } from '../update/updateService'
import { DEFAULT_MALL_BASE_URL, DEFAULT_MALL_TENANT_ID } from '../update/updateConfig'
import { resolveRemoteFeed } from '../update/updateFeedResolver'
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
  // 测试适配器（MAXLABEL_TEST_UPDATE）必须绕过服务端 feed 查询：E2E 没有网络，
  // 否则 resolveFeed 返回 null，check() 会直接按「已是最新」返回，测试适配器根本没机会执行。
  const testMode = !app.isPackaged && Boolean(process.env.MAXLABEL_TEST_UPDATE)
  const service = createUpdateService({
    send,
    onAllowClose,
    // 013 / Q89：先问服务端「有没有更新」，有更新才把 feed 交给更新器
    ...(testMode
      ? {}
      : {
          resolveFeed: () =>
            resolveRemoteFeed({
              baseUrl: DEFAULT_MALL_BASE_URL,
              tenantId: DEFAULT_MALL_TENANT_ID,
              currentVersion: app.getVersion()
            })
        })
  })
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
