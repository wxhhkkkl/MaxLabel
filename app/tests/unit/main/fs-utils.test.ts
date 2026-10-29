import { existsSync, mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, parse } from 'node:path'
import { describe, expect, it } from 'vitest'
import { ensureDirectory } from '@main/fsUtils'

describe('ensureDirectory', () => {
  it('目录已存在时不再 mkdir（Windows 盘符根目录会 EPERM）', async () => {
    const root = parse(process.cwd()).root
    await expect(ensureDirectory(root)).resolves.toBeUndefined()
  })

  it('目录不存在时递归创建', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'maxlabel-ensure-'))
    try {
      const nested = join(dir, 'a', 'b')
      await ensureDirectory(nested)
      expect(existsSync(nested)).toBe(true)
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })
})
