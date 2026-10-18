import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'

let stagingRenames = 0
let failSecondStagingRename = false
vi.mock('fs/promises', async (importOriginal) => {
  const original = await importOriginal<typeof import('node:fs/promises')>()
  return {
    ...original,
    rename: async (from: string, to: string) => {
      if (String(from).includes('.maxlabel-export-')) {
        stagingRenames++
        if (failSecondStagingRename && stagingRenames === 2) throw new Error('simulated rename failure')
      }
      return original.rename(from, to)
    }
  }
})

import { writeBarcodeExport } from '@main/barcodeExport'

const dirs: string[] = []
function makeDir(): string {
  const dir = mkdtempSync(join(tmpdir(), 'maxlabel-export-'))
  dirs.push(dir)
  return dir
}

afterEach(() => {
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true })
  stagingRenames = 0
  failSecondStagingRename = false
})

describe('barcode export transaction', () => {
  it('writes decoded files into the selected directory', async () => {
    const dir = makeDir()
    const result = await writeBarcodeExport(dir, [
      { name: 'a.png', dataUrl: 'data:image/png;base64,AA==' },
      { name: 'b.bmp', dataUrl: 'data:image/bmp;base64,AQ==' }
    ])
    expect(result.count).toBe(2)
    expect([...readFileSync(join(dir, 'a.png'))]).toEqual([0])
    expect([...readFileSync(join(dir, 'b.bmp'))]).toEqual([1])
  })

  it('rolls back committed files when a later rename fails', async () => {
    const dir = makeDir()
    writeFileSync(join(dir, 'a.png'), 'OLD-A')
    writeFileSync(join(dir, 'blocked.png'), 'OLD-B')
    failSecondStagingRename = true
    await expect(writeBarcodeExport(dir, [
      { name: 'a.png', dataUrl: 'data:image/png;base64,AA==' },
      { name: 'blocked.png', dataUrl: 'data:image/png;base64,AQ==' }
    ])).rejects.toThrow(/simulated rename failure/)
    expect(readFileSync(join(dir, 'a.png'), 'utf8')).toBe('OLD-A')
    expect(readFileSync(join(dir, 'blocked.png'), 'utf8')).toBe('OLD-B')
  })

  it('rejects names that escape the selected directory', async () => {
    const dir = makeDir()
    await expect(writeBarcodeExport(dir, [{ name: '../evil.png', dataUrl: 'data:image/png;base64,AA==' }])).rejects.toThrow(/超出所选目录/)
  })
})
