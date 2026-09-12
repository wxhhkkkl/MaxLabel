import type { BrowserWindow, IpcMainInvokeEvent } from 'electron'
import { IPC_CHANNELS } from '../../shared/ipcContract'

export function assertKnownIpcChannel(channel: string): void {
  if (!(Object.values(IPC_CHANNELS) as readonly string[]).includes(channel)) throw new Error(`未注册的 IPC 通道：${channel}`)
}

/** Every renderer-facing handler must originate from the authenticated main
 * window. Cloud/help/preview windows do not receive this application's
 * privileged preload API. */
export function assertTrustedRenderer(event: IpcMainInvokeEvent, getWindow: () => BrowserWindow | null): void {
  const owner = getWindow()
  if (!owner || event.sender !== owner.webContents) throw new Error('未授权的渲染进程请求')
}

export function secureIpcHandler(
  getWindow: () => BrowserWindow | null,
  handler: (event: IpcMainInvokeEvent, ...args: any[]) => any
): (event: IpcMainInvokeEvent, ...args: any[]) => any {
  return (event, ...args) => {
    assertTrustedRenderer(event, getWindow)
    return handler(event, ...args)
  }
}
