import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { app, BrowserWindow, ipcMain } from 'electron'
import { mkdtemp, rm } from 'node:fs/promises'
import { EventEmitter } from 'node:events'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { PrintRecoveryResult, PrintTransportResult } from '@shared/ipcContract'

vi.mock('electron', async () => (await import('../../helpers/electronMock')).createElectronMock())
const { sendCommand } = vi.hoisted(() => ({ sendCommand: vi.fn() }))
vi.mock('@main/printing/commandTransport', async (original) => ({
  ...await original<typeof import('@main/printing/commandTransport')>(),
  sendCommand
}))

import { registerPrintIpc } from '@main/ipc/registerPrintIpc'
import { localizeIpcMessage } from '@shared/i18n/translate'

const handlers = new Map<string, (...args: never[]) => unknown>()
const webContents = new EventEmitter()
const window = { webContents }
const event = { sender: webContents }

let userData: string
beforeAll(async () => {
  userData = await mkdtemp(join(tmpdir(), 'maxlabel-print-ipc-test-'))
  vi.mocked(app.getPath).mockReturnValue(userData)
  ;(ipcMain.handle as unknown as { mockImplementation: (fn: unknown) => void }).mockImplementation((channel: string, handler: (...args: never[]) => unknown) => {
    handlers.set(channel, handler)
  })
  registerPrintIpc(() => window as never)
})
afterAll(async () => {
  if (userData) await rm(userData, { recursive: true, force: true })
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
    expect(localizeIpcMessage('zh-CN', { message: result.message ?? '', messageKey: result.messageKey })).toBe('指令编码无效')
  })

  it('stages bytes without printing and keeps the uncertain range after a second send', async () => {
    const id = 'staged-test'
    const port = { type: 'tcp', encoding: 'utf8', tcpHost: '127.0.0.1', tcpPort: 9100 }
    const payload = { encoding: 'utf8', port }
    const receipt = { title: 'fixture', total: 2, index: 1, first: 1, last: 1, staged: true }
    await handle('print:stage', id, { index: 1, final: false, payload: { ...payload, text: 'first' } })
    expect(await handle('print:command', payload, id, receipt)).toMatchObject({ status: 'failed' })
    await handle('print:stage', id, { index: 2, final: true, payload: { ...payload, text: 'second' } })
    expect(sendCommand).not.toHaveBeenCalled()
    sendCommand.mockResolvedValueOnce({ ok: true, status: 'accepted' }).mockResolvedValueOnce({ ok: false, status: 'unknown' })

    expect(await handle('print:command', payload, id, receipt)).toMatchObject({ status: 'accepted' })
    expect(await handle('print:command', payload, id, { ...receipt, index: 2, first: 2, last: 2 })).toMatchObject({ status: 'unknown' })
    expect(sendCommand.mock.calls.map(([bytes]) => bytes.toString())).toEqual(['first', 'second'])
    await handle('print:stage', id)
    await handle('print:recovery', { jobId: id, discard: false })
    expect((await handle<PrintRecoveryResult>('print:recovery')).jobs).toContainEqual(expect.objectContaining({
      jobId: id, sentPhysicalCount: 1, uncertain: { first: 2, last: 2 }
    }))
    await handle('print:recovery', [id])
  })

  it('marks cancellation during driver submission as uncertain', async () => {
    let signalStarted!: () => void
    const started = new Promise<void>((resolve) => { signalStarted = resolve })
    vi.mocked(BrowserWindow).mockImplementationOnce(function () {
      return {
        loadFile: vi.fn(), on: vi.fn(), isDestroyed: () => false, destroy: vi.fn(),
        webContents: { print: vi.fn(() => signalStarted()) }
      } as never
    })
    const id = 'driver-cancel-test'
    const result = handle<PrintTransportResult>('print-label', {
      pages: [{ svg: '<svg xmlns="http://www.w3.org/2000/svg"></svg>' }], widthMm: 40, heightMm: 30, printerName: 'mock'
    }, id, { title: 'fixture', total: 1, index: 1, first: 1, last: 1 })
    await started
    await handle('print:cancel', id)
    await expect(result).resolves.toMatchObject({ ok: false, status: 'unknown' })
    await handle('print:recovery', { jobId: id, discard: false })
    expect((await handle<PrintRecoveryResult>('print:recovery')).jobs).toContainEqual(expect.objectContaining({
      jobId: id, sentPhysicalCount: 0, uncertain: { first: 1, last: 1 }
    }))
  })

  it.each([
    { ok: true, reason: '', status: 'unknown', retained: true },
    { ok: false, reason: 'Print job canceled', status: 'canceled', retained: false }
  ])('classifies the system dialog result as $status', async ({ ok, reason, status, retained }) => {
    const print = vi.fn((_options, callback: (success: boolean, failureReason: string) => void) => callback(ok, reason))
    vi.mocked(BrowserWindow).mockImplementationOnce(function () {
      return {
        loadFile: vi.fn(), on: vi.fn(), isDestroyed: () => false, destroy: vi.fn(), showInactive: vi.fn(),
        webContents: { print }
      } as never
    })
    const id = `driver-dialog-${status}`
    const result = await handle<PrintTransportResult>('print-label', {
      pages: [{ svg: '<svg xmlns="http://www.w3.org/2000/svg"></svg>' }], widthMm: 40, heightMm: 30
    }, id, { title: 'fixture', total: 3, index: 1, first: 1, last: 3 })
    expect(print).toHaveBeenCalledWith(expect.objectContaining({ silent: false }), expect.any(Function))
    expect(result).toMatchObject({ ok: false, status })
    await handle('print:recovery', { jobId: id, discard: !retained })
    const { jobs } = await handle<PrintRecoveryResult>('print:recovery')
    expect(jobs.find((job) => job.jobId === id)?.uncertain).toEqual(retained ? { first: 1, last: 3 } : undefined)
  })

  it('waits for an abandoned submission and recovers it without restarting Electron', async () => {
    const id = 'renderer-reloaded'
    const payload = { encoding: 'utf8', text: 'label', port: { type: 'tcp', encoding: 'utf8', tcpHost: '127.0.0.1', tcpPort: 9100 } }
    let signalStarted!: () => void
    const started = new Promise<void>((resolve) => { signalStarted = resolve })
    let settle!: (result: PrintTransportResult) => void
    const transport = new Promise<PrintTransportResult>((resolve) => { settle = resolve })
    sendCommand.mockImplementationOnce(() => { signalStarted(); return transport })
    const submission = handle('print:command', payload, id, { title: 'fixture', total: 2, index: 1, first: 1, last: 2 })
    await started
    expect((await handle<PrintRecoveryResult>('print:recovery')).jobs.some((job) => job.jobId === id)).toBe(false)
    webContents.emit('did-start-navigation', { isMainFrame: true, isSameDocument: true })
    expect(sendCommand.mock.calls.at(-1)?.[2].aborted).toBe(false)
    webContents.emit('did-start-navigation', { isMainFrame: true, isSameDocument: false })
    const recovery = handle<PrintRecoveryResult>('print:recovery')
    expect(sendCommand.mock.calls.at(-1)?.[2].aborted).toBe(true)
    settle({ ok: true, status: 'accepted' })
    await submission
    expect((await recovery).jobs).toContainEqual(expect.objectContaining({ jobId: id, sentPhysicalCount: 2 }))
    await handle('print:recovery', [id])
  })
})
