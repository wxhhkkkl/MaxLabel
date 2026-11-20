import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { expect, it, vi } from 'vitest'

const cold = vi.hoisted(() => {
  let release!: () => void
  const pending = new Promise<void>((resolve) => { release = resolve })
  return { dir: '', release, pending }
})

vi.mock('electron', () => ({ app: { getPath: () => cold.dir } }))
vi.mock('@main/ipc/validation', () => ({
  readBoundedFile: async () => {
    await cold.pending
    throw Object.assign(new Error('new profile'), { code: 'ENOENT' })
  }
}))

import { assertPathAccess, grantPath } from '@main/ipc/pathAccess'

it('persists both first grants when the profile is opened concurrently', async () => {
  cold.dir = mkdtempSync(join(tmpdir(), 'maxlabel-path-grants-'))
  try {
    const first = join(cold.dir, 'first.msdx')
    const second = join(cold.dir, 'second.msdx')
    const granting = Promise.all([grantPath(first, ['write']), grantPath(second, ['read'])])
    await new Promise<void>((resolve) => setImmediate(resolve))
    cold.release()
    await granting

    await expect(assertPathAccess(first, 'write')).resolves.toMatch(/first\.msdx$/)
    await expect(assertPathAccess(second, 'read')).resolves.toMatch(/second\.msdx$/)
    const saved = JSON.parse(readFileSync(join(cold.dir, 'path-access.json'), 'utf8'))
    expect(Object.values(saved.files)).toEqual(expect.arrayContaining([{ write: true }, { read: true }]))
  } finally {
    if (cold.dir.startsWith(join(tmpdir(), 'maxlabel-path-grants-'))) rmSync(cold.dir, { recursive: true, force: true })
  }
})
