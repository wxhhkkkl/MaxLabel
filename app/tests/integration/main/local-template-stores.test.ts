import { mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'

const store = vi.hoisted(() => ({ path: '', blockedIndex: '' }))
vi.mock('electron', () => ({ app: { getPath: () => store.path } }))
vi.mock('fs/promises', async (original) => {
  const fs = await original<typeof import('node:fs/promises')>()
  return {
    ...fs,
    rename: async (source: string, target: string) => {
      if (target === store.blockedIndex) throw new Error('simulated index write failure')
      await fs.rename(source, target)
    }
  }
})

import { offlineCloudDelete, offlineCloudLoad, offlineCloudRegister, offlineCloudSave } from '@main/cloud'
import { deleteSharedTemplate, loadSharedTemplate, publishSharedTemplate } from '@main/sharedLibrary'

beforeEach(() => { store.path = mkdtempSync(join(tmpdir(), 'maxlabel-local-template-stores-')) })
afterEach(() => {
  store.blockedIndex = ''
  if (store.path.startsWith(join(tmpdir(), 'maxlabel-local-template-stores-'))) rmSync(store.path, { recursive: true, force: true })
})

it.each(['offline', 'shared'] as const)('%s keeps the old body on failed save and removes retired blobs', async (kind) => {
  const account = kind === 'offline' ? (await offlineCloudRegister('test@example.test', 'test-password')).data! : null
  const save = async (json: string) => account
    ? (await offlineCloudSave(account.token, 'label', json)).data?.id
    : (await publishSharedTemplate('label', json, 'operator')).id
  const load = (id: string) => account ? offlineCloudLoad(account.token, id) : loadSharedTemplate(id)
  const remove = (id: string) => account ? offlineCloudDelete(account.token, id) : deleteSharedTemplate(id)
  const index = join(store.path, account ? 'cloud-store.json' : 'shared-templates.json')
  const blobs = join(store.path, account ? 'cloud-templates' : 'shared-template-blobs')
  const original = '{"text":"original"}'
  const updated = '{"text":"updated"}'
  const id = (await save(original))!
  const originalFiles = readdirSync(blobs)
  store.blockedIndex = index
  await expect(save(updated)).rejects.toThrow('simulated index write failure')
  await expect(remove(id)).rejects.toThrow('simulated index write failure')
  expect(await load(id)).toMatchObject({ ok: true, data: { json: original } })
  expect(readdirSync(blobs)).toEqual(originalFiles)

  store.blockedIndex = ''
  expect(await save(updated)).toBe(id)
  expect(await load(id)).toMatchObject({ ok: true, data: { json: updated } })
  expect(readdirSync(blobs)).toHaveLength(1)
  await expect(remove(id)).resolves.toMatchObject({ ok: true })
  expect(readdirSync(blobs)).toEqual([])
})

it.each(['offline', 'shared'] as const)('%s still reads legacy inline templates if migration cannot save the index', async (kind) => {
  const json = '{"text":"legacy"}'
  const account = kind === 'offline' ? (await offlineCloudRegister('legacy@example.test', 'test-password')).data! : null
  const index = join(store.path, account ? 'cloud-store.json' : 'shared-templates.json')
  const template = { id: 'legacy-label', name: 'label', updatedAt: '2026-01-01', author: 'operator', json }
  if (account) {
    const data = JSON.parse(readFileSync(index, 'utf8'))
    data.accounts[account.email].templates.push(template)
    writeFileSync(index, JSON.stringify(data))
  } else {
    writeFileSync(index, JSON.stringify({ templates: [template] }))
  }
  const load = () => account ? offlineCloudLoad(account.token, template.id) : loadSharedTemplate(template.id)
  store.blockedIndex = index
  await expect(load()).resolves.toMatchObject({ ok: true, data: { json } })
  expect(readFileSync(index, 'utf8')).toContain('legacy-label')
  store.blockedIndex = ''
  await expect(load()).resolves.toMatchObject({ ok: true, data: { json } })
})
