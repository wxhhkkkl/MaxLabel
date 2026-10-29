import { mkdtempSync, realpathSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('electron', async () => {
  const fs = await import('node:fs')
  const os = await import('node:os')
  const path = await import('node:path')
  const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'maxlabel-dataset-'))
  const { createElectronMock } = await import('../../helpers/electronMock')
  const mock = createElectronMock({ userDataDir })
  ;(globalThis as { __datasetElectronMock?: unknown }).__datasetElectronMock = mock
  return mock
})

import { registerFileIpc } from '@main/ipc/registerFileIpc'

const mock = (globalThis as { __datasetElectronMock?: ReturnType<typeof import('../../helpers/electronMock')['createElectronMock']> }).__datasetElectronMock!
const handlers = new Map<string, (...args: never[]) => unknown>()
const webContents = {}
const window = { webContents }
const event = { sender: webContents }

const dir = realpathSync.native(mkdtempSync(join(tmpdir(), 'maxlabel-datasrc-')))
const csvPath = join(dir, '商品.csv')

beforeAll(() => {
  mock.ipcMain.handle.mockImplementation((channel: string, handler: (...args: never[]) => unknown) => {
    handlers.set(channel, handler)
  })
  registerFileIpc(() => window as never)
})

beforeEach(() => {
  vi.clearAllMocks()
  writeFileSync(csvPath, 'sku,qty\nA,1', 'utf8')
})

function handle<T>(channel: string, ...args: unknown[]): Promise<T> {
  const fn = handlers.get(channel)
  if (!fn) throw new Error(`missing handler ${channel}`)
  return fn(event as never, ...(args as never[])) as Promise<T>
}

interface OpenResult { ok: boolean; message?: string }

describe('数据集源文件 IPC', () => {
  it('用系统默认程序打开已存在的文本数据文件', async () => {
    const result = await handle<OpenResult>('dataset:openSource', csvPath)
    expect(result.ok).toBe(true)
    expect(mock.shell.openPath).toHaveBeenCalledTimes(1)
    expect(String((mock.shell.openPath.mock.calls[0] as unknown[])[0]).toLowerCase()).toBe(realpathSync.native(csvPath).toLowerCase())
  })

  it('文件已被移动或删除时给出明确提示且不调用系统打开', async () => {
    const result = await handle<OpenResult>('dataset:openSource', join(dir, 'missing.csv'))
    expect(result.ok).toBe(false)
    expect(result.message ?? '').toContain('不存在')
    expect(mock.shell.openPath).not.toHaveBeenCalled()
  })

  it('拒绝非数据文件的扩展名', async () => {
    const result = await handle<OpenResult>('dataset:openSource', join(dir, 'evil.exe'))
    expect(result.ok).toBe(false)
    expect(mock.shell.openPath).not.toHaveBeenCalled()
  })

  it('系统打开失败时把错误回给渲染层', async () => {
    mock.shell.openPath.mockResolvedValueOnce('没有关联的应用程序')
    const result = await handle<OpenResult>('dataset:openSource', csvPath)
    expect(result.ok).toBe(false)
    expect(result.message).toContain('没有关联的应用程序')
  })
})
