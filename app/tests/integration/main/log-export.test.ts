import { existsSync, readFileSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('electron', async () => {
  const fs = await import('node:fs')
  const os = await import('node:os')
  const path = await import('node:path')
  const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'maxlabel-log-'))
  ;(globalThis as { __logUserDataDir?: string }).__logUserDataDir = userDataDir
  const { createElectronMock } = await import('../../helpers/electronMock')
  const mock = createElectronMock({ userDataDir })
  ;(globalThis as { __logMock?: unknown }).__logMock = mock
  return mock
})

import { registerLogIpc } from '@main/ipc/registerLogIpc'
import { logPayload } from '../../helpers/logs'

const userDataDir = (globalThis as { __logUserDataDir?: string }).__logUserDataDir!
const logFile = join(userDataDir, 'print-log.jsonl')
const csvFile = join(userDataDir, 'history.csv')
const handlers = new Map<string, (...args: never[]) => unknown>()
const webContents = {}
const event = { sender: webContents }
const mock = (globalThis as { __logMock?: { ipcMain: { handle: { mockImplementation: (fn: never) => void } }; dialog: { showSaveDialog: { mockResolvedValue: (value: unknown) => void } } } }).__logMock!

beforeAll(() => {
  mock.ipcMain.handle.mockImplementation(((channel: string, handler: (...args: never[]) => unknown) => {
    handlers.set(channel, handler)
  }) as never)
  registerLogIpc(() => ({ webContents }) as never)
})

function handle<T>(channel: string, ...args: unknown[]): Promise<T> {
  const fn = handlers.get(channel)
  if (!fn) throw new Error(`missing handler ${channel}`)
  return fn(event as never, ...(args as never[])) as Promise<T>
}

beforeEach(() => {
  rmSync(logFile, { force: true })
  rmSync(csvFile, { force: true })
})

describe('print log CSV export', () => {
  it('writes the fixed header, BOM, CRLF and quoted values', async () => {
    await handle('log:print', logPayload({ title: 'A,"B"\nC', time: 't1' }))
    await handle('log:print', logPayload({ title: '第二行', time: 't2', status: 'failed', sentCount: undefined, physicalCount: undefined }))
    mock.dialog.showSaveDialog.mockResolvedValue({ canceled: false, filePath: csvFile })

    const result = await handle<{ ok: boolean; path?: string }>('log:export', 'zh-CN')
    expect(result).toMatchObject({ ok: true, path: csvFile })
    const content = readFileSync(csvFile, 'utf8')
    expect(content.startsWith('﻿')).toBe(true)
    expect(content).toContain('时间,模板,打印方式,数量,单签拷贝,计划标签张数,已发送标签张数,状态,测试打印,打印机')
    expect(content).toContain('"A,""B""\nC"')
    expect(content).toContain('t2,第二行,driver,3,2,6,,failed,否,Test Printer')
    expect(content.split('\r\n')).toHaveLength(3)
  })

  it('reports an empty history without opening the save dialog', async () => {
    const result = await handle<{ ok: boolean; messageKey?: string }>('log:export', 'zh-CN')
    expect(result).toMatchObject({ ok: false, messageKey: 'history.empty' })
    expect(existsSync(csvFile)).toBe(false)
  })

  it('treats an existing empty log as no records', async () => {
    await handle('log:clear')
    expect(existsSync(logFile)).toBe(true)
    const result = await handle<{ ok: boolean; messageKey?: string }>('log:export', 'zh-CN')
    expect(result).toMatchObject({ ok: false, messageKey: 'history.empty' })
    expect(mock.dialog.showSaveDialog).not.toHaveBeenCalled()
    expect(existsSync(csvFile)).toBe(false)
  })

  it('writes nothing when the dialog is canceled', async () => {
    await handle('log:print', logPayload())
    mock.dialog.showSaveDialog.mockResolvedValue({ canceled: true })
    const result = await handle<{ ok: boolean; message?: string }>('log:export', 'zh-CN')
    expect(result.ok).toBe(false)
    expect(result.message).toContain('取消')
    expect(existsSync(csvFile)).toBe(false)
  })
})
