import { existsSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'

const PNG_1X1 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=='

vi.mock('@main/entitlementService', () => ({
  getEntitlementState: () => ({ editable: true })
}))

vi.mock('electron', async () => {
  const fs = await import('node:fs')
  const os = await import('node:os')
  const path = await import('node:path')
  const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'maxlabel-image-export-'))
  const { createElectronMock } = await import('../../helpers/electronMock')
  const mock = createElectronMock({ userDataDir })
  ;(globalThis as { __imageExportElectronMock?: unknown }).__imageExportElectronMock = mock
  return mock
})

import { registerFileIpc } from '@main/ipc/registerFileIpc'

const mock = (globalThis as { __imageExportElectronMock?: ReturnType<typeof import('../../helpers/electronMock')['createElectronMock']> }).__imageExportElectronMock!
const handlers = new Map<string, (...args: never[]) => unknown>()
const webContents = {}
const window = { webContents }
const event = { sender: webContents }
const outDir = realpathSync.native(mkdtempSync(join(tmpdir(), 'maxlabel-cloud-images-')))

beforeAll(() => {
  mock.nativeImage.createFromBuffer.mockReturnValue({ isEmpty: () => false, getSize: () => ({ width: 1, height: 1 }) } as never)
  mock.ipcMain.handle.mockImplementation((channel: string, handler: (...args: never[]) => unknown) => {
    handlers.set(channel, handler)
  })
  registerFileIpc(() => window as never)
})

afterAll(() => {
  rmSync(outDir, { recursive: true, force: true })
})

function handle<T>(channel: string, ...args: unknown[]): Promise<T> {
  const fn = handlers.get(channel)
  if (!fn) throw new Error(`missing handler ${channel}`)
  return fn(event as never, ...(args as never[])) as Promise<T>
}

interface ExportResult {
  ok: boolean
  canceled?: boolean
  dir?: string
  files?: Array<{ fileName: string; path: string }>
  message?: string
}

describe('image:exportToDirectory', () => {
  it('writes cloud image data URLs into the selected folder', async () => {
    mock.dialog.showOpenDialog.mockResolvedValueOnce({ canceled: false, filePaths: [outDir] })
    const result = await handle<ExportResult>('image:exportToDirectory', {
      items: [{ fileName: 'AoAZ.png', dataUrl: `data:image/png;base64,${PNG_1X1}` }],
      suggestedDir: outDir
    })
    expect(result.ok).toBe(true)
    expect(result.dir).toBe(outDir)
    expect(result.files).toEqual([{ fileName: 'AoAZ.png', path: join(outDir, 'AoAZ.png') }])
    expect(existsSync(join(outDir, 'AoAZ.png'))).toBe(true)
    expect(readFileSync(join(outDir, 'AoAZ.png')).toString('base64')).toBe(PNG_1X1)
  })

  it('keeps an existing different file and writes a suffixed copy', async () => {
    writeFileSync(join(outDir, 'same.png'), Buffer.from('existing'))
    mock.dialog.showOpenDialog.mockResolvedValueOnce({ canceled: false, filePaths: [outDir] })
    const result = await handle<ExportResult>('image:exportToDirectory', {
      items: [{ fileName: 'same.png', dataUrl: `data:image/png;base64,${PNG_1X1}` }]
    })
    expect(result.ok).toBe(true)
    expect(result.files?.[0].fileName).toBe('same (1).png')
    expect(readFileSync(join(outDir, 'same.png'), 'utf8')).toBe('existing')
    expect(readFileSync(join(outDir, 'same (1).png')).toString('base64')).toBe(PNG_1X1)
  })

  it('cancels without writing when the directory dialog is dismissed', async () => {
    mock.dialog.showOpenDialog.mockResolvedValueOnce({ canceled: true, filePaths: [] })
    const result = await handle<ExportResult>('image:exportToDirectory', {
      items: [{ fileName: 'a.png', dataUrl: `data:image/png;base64,${PNG_1X1}` }]
    })
    expect(result).toMatchObject({ ok: false, canceled: true })
  })

  it('rejects invalid payloads', async () => {
    const result = await handle<ExportResult>('image:exportToDirectory', {
      items: [{ fileName: 'a.png', dataUrl: 'data:text/plain;base64,AAAA' }]
    })
    expect(result.ok).toBe(false)
    expect(result.message).toBeTruthy()
  })
})
