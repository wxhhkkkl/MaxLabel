import { ipcMain as electronIpcMain } from 'electron'
import type { BrowserWindow } from 'electron'
import { IPC_CHANNELS } from '../../shared/ipcContract'
import { getEntitlementState } from '../entitlementService'
import { assertKnownIpcChannel, secureIpcHandler } from './senderGuard'

/** 注册会员授权状态读取通道；变更通过 `entitlement:changed` 由主进程推送。 */
export function registerEntitlementIpc(getWindow: () => BrowserWindow | null): void {
  const secureHandle = (channel: string, handler: Parameters<typeof electronIpcMain.handle>[1]) => {
    assertKnownIpcChannel(channel)
    return electronIpcMain.handle(channel, secureIpcHandler(getWindow, handler as never) as never)
  }
  const ipcMain = { handle: secureHandle }

  ipcMain.handle(IPC_CHANNELS.entitlementStatus, async () => {
    try {
      return { ok: true, state: getEntitlementState() }
    } catch (error) {
      return {
        ok: false,
        error: String((error as { message?: string }).message ?? error),
        messageKey: 'error.entitlementReadOnly'
      }
    }
  })
}
