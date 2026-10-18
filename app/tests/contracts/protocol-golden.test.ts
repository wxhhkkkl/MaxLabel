import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const fixtureDir = resolve(__dirname, '../../fixtures/protocol')

interface Snapshot {
  version: number
  fixtures: Array<{ driver: string; file: string; bytes: number; sha256: string; mustContain: string[] }>
}

const snapshot = JSON.parse(readFileSync(resolve(fixtureDir, 'protocol-snapshots.json'), 'utf8')) as Snapshot

describe('protocol golden files', () => {
  it('uses manifest version 1', () => {
    expect(snapshot.version).toBe(1)
  })

  it.each(snapshot.fixtures)('matches $driver bytes, SHA-256 and required tokens', (fixture) => {
    const bytes = readFileSync(resolve(fixtureDir, fixture.file))
    expect(bytes.byteLength).toBe(fixture.bytes)
    expect(createHash('sha256').update(bytes).digest('hex')).toBe(fixture.sha256)
    const text = bytes.toString('latin1')
    for (const token of fixture.mustContain) expect(text).toContain(token)
  })
})
