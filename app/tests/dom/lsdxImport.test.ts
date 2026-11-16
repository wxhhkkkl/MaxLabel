import { describe, expect, it, vi } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { importLsdx } from '../../src/renderer/src/io/lsdxImport'

// jsdom 不实现图片解码；fixture 里的内嵌 PNG 只需通过解析分支，不在此校验像素。
vi.mock('../../src/renderer/src/print/imageValidation', () => ({
  validateImageDataUrl: vi.fn().mockResolvedValue(undefined)
}))

const fixtureDir = join(process.cwd(), 'fixtures', 'lsdx')
const fixtures = readdirSync(fixtureDir).filter((name) => name.toLowerCase().endsWith('.lsdx'))

describe('importLsdx fixtures', () => {
  it('has at least one lsdx fixture', () => {
    expect(fixtures.length).toBeGreaterThan(0)
  })

  for (const file of fixtures) {
    it(`parses ${file}`, async () => {
      const content = readFileSync(join(fixtureDir, file), 'utf-8')
      const result = await importLsdx(content, file, {})
      expect(result.doc.widthMm).toBeGreaterThan(0)
      expect(Array.isArray(result.doc.objects)).toBe(true)
    })
  }
})
