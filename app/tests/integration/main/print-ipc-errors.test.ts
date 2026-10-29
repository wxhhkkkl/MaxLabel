import { beforeAll, describe, expect, it, vi } from 'vitest'
import { ipcMain } from 'electron'

vi.mock('electron', async () => (await import('../../helpers/electronMock')).createElectronMock())

import { registerPrintIpc } from '@main/ipc/registerPrintIpc'
import { localizeIpcMessage } from '@shared/i18n/translate'

const handlers = new Map<string, (...args: never[]) => unknown>()
const webContents = {}
const window = { webContents }
const event = { sender: webContents }

beforeAll(() => {
  ;(ipcMain.handle as unknown as { mockImplementation: (fn: unknown) => void }).mockImplementation((channel: string, handler: (...args: never[]) => unknown) => {
    handlers.set(channel, handler)
  })
  registerPrintIpc(() => window as never)
})

function handle<T>(channel: string, ...args: unknown[]): Promise<T> {
  const fn = handlers.get(channel)
  if (!fn) throw new Error(`missing handler ${channel}`)
  return fn(event as never, ...(args as never[])) as Promise<T>
}

describe('print IPC failure messages', () => {
  it('keeps the specific error instead of collapsing to the generic 打印失败', async () => {
    const result = await handle<{ ok: boolean; message?: string; messageKey?: string }>('print:command', {})
    expect(result.ok).toBe(false)
    expect(result.message).toBe('指令编码无效')
    // 带上通用 messageKey 会让渲染层只显示「打印失败」，把真实原因吞掉。
    expect(result.messageKey).toBeUndefined()
    expect(localizeIpcMessage('zh-CN', result)).toBe('指令编码无效')
  })
})
