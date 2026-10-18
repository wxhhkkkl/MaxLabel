import { existsSync, mkdtempSync, readFileSync, rmSync, mkdirSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'

vi.mock('electron', async () => {
  const fs = await import('node:fs')
  const os = await import('node:os')
  const path = await import('node:path')
  const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'maxlabel-template-'))
  ;(globalThis as { __templateUserDataDir?: string }).__templateUserDataDir = userDataDir
  const { createElectronMock } = await import('../../helpers/electronMock')
  const mock = createElectronMock({ userDataDir })
  ;(globalThis as { __templateElectronMock?: unknown }).__templateElectronMock = mock
  return mock
})

import { registerTemplateIpc } from '@main/ipc/registerTemplateIpc'

const mock = (globalThis as { __templateElectronMock?: ReturnType<typeof import('../../helpers/electronMock')['createElectronMock']> }).__templateElectronMock!
const userDataDir = (globalThis as { __templateUserDataDir?: string }).__templateUserDataDir!
const ungrantedDir = mkdtempSync(join(tmpdir(), 'maxlabel-ungranted-'))
const handlers = new Map<string, (...args: never[]) => unknown>()
const webContents = {}
const window = { webContents }
const event = { sender: webContents }

beforeAll(() => {
  mock.ipcMain.handle.mockImplementation((channel: string, handler: (...args: never[]) => unknown) => {
    handlers.set(channel, handler)
  })
  registerTemplateIpc(() => window as never)
})

function handle<T>(channel: string, ...args: unknown[]): Promise<T> {
  const fn = handlers.get(channel)
  if (!fn) throw new Error(`missing handler ${channel}`)
  return fn(event as never, ...(args as never[])) as Promise<T>
}

describe('template IPC', () => {
  const templatesDir = join(userDataDir, 'templates')
  const savePath = join(userDataDir, 'saved.msdx')

  it('saves through the dialog and reads the template back', async () => {
    mock.dialog.showSaveDialog.mockResolvedValueOnce({ canceled: false, filePath: savePath })
    const saved = await handle<{ canceled: boolean; filePath?: string; message?: string }>(
      'template:save',
      JSON.stringify({ connections: { db: { id: 'db', name: '库', driver: 'sqlite', password: 'secret' } } }),
      'saved'
    )
    expect(saved.canceled).toBe(false)
    expect(saved.filePath).toBe(savePath)
    expect(existsSync(savePath)).toBe(true)
    expect(readFileSync(savePath, 'utf8')).not.toContain('secret')

    mock.dialog.showOpenDialog.mockResolvedValueOnce({ canceled: false, filePaths: [savePath] })
    const opened = await handle<{ canceled: boolean; filePath?: string; content?: string }>('template:open')
    expect(opened.canceled).toBe(false)
    expect(opened.content).not.toContain('secret')
  })

  it('saves to an already-granted path exactly once', async () => {
    const before = readFileSync(savePath, 'utf8')
    const result = await handle<{ ok: boolean; filePath?: string; message?: string }>('template:saveTo', savePath, before)
    expect(result.ok).toBe(true)
    expect(result.filePath).toBe(savePath)
    expect(readFileSync(savePath, 'utf8')).toBe(before)
  })

  it('rejects reading or writing a path that was never granted', async () => {
    const unknown = join(ungrantedDir, 'unknown.msdx')
    expect((await handle<{ ok: boolean; message?: string }>('template:openPath', unknown)).ok).toBe(false)
    const saved = await handle<{ ok: boolean; message?: string }>('template:saveTo', unknown, '{}')
    expect(saved.ok).toBe(false)
  })

  it('writes unique files into the local template library and lists them', async () => {
    mkdirSync(templatesDir, { recursive: true })
    const first = await handle<{ ok: boolean; path?: string }>('template:saveToLib', '我的模板', '{"a":1}')
    const second = await handle<{ ok: boolean; path?: string }>('template:saveToLib', '我的模板', '{"a":2}')
    expect(first.ok).toBe(true)
    expect(second.ok).toBe(true)
    expect(first.path).not.toBe(second.path)
    expect(existsSync(first.path!)).toBe(true)

    const listed = await handle<{ ok: boolean; items?: Array<{ name: string }> }>('template:list')
    expect(listed.ok).toBe(true)
    expect(listed.items?.some((item) => item.name === '我的模板')).toBe(true)
  })

  it('deletes only files inside the template library', async () => {
    const created = await handle<{ ok: boolean; path?: string }>('template:saveToLib', '待删除', '{}')
    expect((await handle<{ ok: boolean }>('template:delete', created.path!)).ok).toBe(true)
    expect(existsSync(created.path!)).toBe(false)
    expect((await handle<{ ok: boolean }>('template:delete', savePath)).ok).toBe(false)
  })
})

afterAll(() => {
  rmSync(userDataDir, { recursive: true, force: true })
  rmSync(ungrantedDir, { recursive: true, force: true })
})
