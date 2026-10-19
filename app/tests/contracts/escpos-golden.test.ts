import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const fixtureDir = resolve(__dirname, '../../fixtures/protocol')
const manifest = JSON.parse(readFileSync(resolve(fixtureDir, 'protocol-snapshots.json'), 'utf8')) as {
  fixtures: Array<{ driver: string; file: string; bytes: number; sha256: string; mustContain: string[] }>
}
const fixture = manifest.fixtures.find((entry) => entry.driver === 'escpos')

describe('ESC/POS golden output', () => {
  it('is present in the manifest', () => {
    expect(fixture).toBeDefined()
  })

  it('matches byte length, SHA-256 and required commands', () => {
    if (!fixture) throw new Error('missing escpos fixture')
    const bytes = readFileSync(resolve(fixtureDir, fixture.file))
    expect(bytes.byteLength).toBe(fixture.bytes)
    expect(createHash('sha256').update(bytes).digest('hex')).toBe(fixture.sha256)
    const text = bytes.toString('latin1')
    for (const token of fixture.mustContain) expect(text).toContain(token)
  })
})
