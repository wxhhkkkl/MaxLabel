import { existsSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { beforeEach, describe, expect, it, vi } from 'vitest'

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

import { beforeAll } from 'vitest'
beforeAll(() => {
  const mock = (globalThis as { __logMock?: { ipcMain: { handle: { mockImplementation: (fn: never) => void } } } }).__logMock!
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

describe('print log IPC', () => {
  it('appends a validated row and lists it back', async () => {
    const payload = logPayload({ title: '模板A', dataSnapshot: ['A | B'] })
    const saved = await handle<{ ok: boolean; path?: string }>('log:print', payload)
    expect(saved.ok).toBe(true)
    expect(existsSync(logFile)).toBe(true)

    const line = readFileSync(logFile, 'utf8').trim().split('\n')[0]
    expect(JSON.parse(line)).toMatchObject({ ...payload, app: 'maxlabel' })

    const listed = await handle<{ ok: boolean; logs?: Array<Record<string, unknown>> }>('log:list')
    expect(listed.ok).toBe(true)
    expect(listed.logs).toHaveLength(1)
    expect(listed.logs?.[0]).toMatchObject({ title: '模板A', dataSnapshot: ['A | B'] })
  })

  it('returns an empty list when the file is missing', async () => {
    await expect(handle('log:list')).resolves.toEqual({ ok: true, logs: [] })
  })

  it('skips corrupt lines', async () => {
    writeFileSync(logFile, '{not json}\n' + JSON.stringify({ ...logPayload({ title: '有效' }), app: 'maxlabel' }) + '\n', 'utf8')
    const listed = await handle<{ logs?: Array<Record<string, unknown>> }>('log:list')
    expect(listed.logs).toHaveLength(1)
    expect(listed.logs?.[0]).toMatchObject({ title: '有效' })
  })

  it('rejects an invalid payload without writing', async () => {
    const saved = await handle<{ ok: boolean; messageKey?: string }>('log:print', logPayload({ count: -1 }))
    expect(saved).toMatchObject({ ok: false, messageKey: 'error.log' })
    expect(existsSync(logFile)).toBe(false)
  })
})
