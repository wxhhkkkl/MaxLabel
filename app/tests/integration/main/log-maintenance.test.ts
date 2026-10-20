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
const handlers = new Map<string, (...args: never[]) => unknown>()
const webContents = {}
const event = { sender: webContents }
const mock = (globalThis as { __logMock?: { ipcMain: { handle: { mockImplementation: (fn: never) => void } }; shell: { openPath: { mockResolvedValue: (value: string) => void } } } }).__logMock!

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
})

describe('print log maintenance', () => {
  it('creates an empty file when opening a missing log', async () => {
    mock.shell.openPath.mockResolvedValue('')
    const result = await handle<{ ok: boolean; path?: string }>('log:open')
    expect(result.ok).toBe(true)
    expect(existsSync(logFile)).toBe(true)
    expect(readFileSync(logFile, 'utf8')).toBe('')
  })

  it('clears every row', async () => {
    await handle('log:print', logPayload())
    await handle('log:clear')
    expect(readFileSync(logFile, 'utf8')).toBe('')
    await expect(handle('log:list')).resolves.toEqual({ ok: true, logs: [] })
  })

  it('deletes rows by timestamp', async () => {
    await handle('log:print', logPayload({ time: 't1', title: '一' }))
    await handle('log:print', logPayload({ time: 't2', title: '二' }))
    await handle('log:delete', 't1')
    const listed = await handle<{ logs?: Array<Record<string, unknown>> }>('log:list')
    expect(listed.logs).toHaveLength(1)
    expect(listed.logs?.[0]).toMatchObject({ time: 't2', title: '二' })
  })

  it('serializes concurrent writes', async () => {
    await Promise.all([
      handle('log:print', logPayload({ time: 't1', title: '一' })),
      handle('log:print', logPayload({ time: 't2', title: '二' }))
    ])
    const listed = await handle<{ logs?: Array<Record<string, unknown>> }>('log:list')
    expect(listed.logs).toHaveLength(2)
    const lines = readFileSync(logFile, 'utf8').trim().split('\n')
    expect(lines).toHaveLength(2)
    for (const line of lines) expect(() => JSON.parse(line)).not.toThrow()
  })
})
