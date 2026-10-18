import { rmSync } from 'node:fs'
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('electron', async () => {
  const fs = await import('node:fs')
  const os = await import('node:os')
  const path = await import('node:path')
  const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'maxlabel-cloud-'))
  ;(globalThis as { __cloudUserDataDir?: string }).__cloudUserDataDir = userDataDir
  const { createElectronMock } = await import('../../helpers/electronMock')
  const mock = createElectronMock({ userDataDir })
  // The offline session store double-prefixes plaintext fallback keys on reload.
  // Keep safeStorage available so sessions use the enc: path (see the finding in
  // specs/002-test-architecture/research.md).
  mock.safeStorage.isEncryptionAvailable.mockReturnValue(true)
  mock.safeStorage.encryptString.mockImplementation((value: string) => Buffer.from(`enc:${value}`))
  mock.safeStorage.decryptString.mockImplementation((value: Buffer) => value.toString().replace(/^enc:/, ''))
  return mock
})

vi.mock('@main/net', () => ({ httpRequestJson: vi.fn() }))

import type { CloudTemplateMetadata } from '@shared/ipcContract'
import { createCloudRepository } from '@main/cloudRepository'
import { httpRequestJson } from '@main/net'

const request = vi.mocked(httpRequestJson)
const meta = (overrides: Partial<CloudTemplateMetadata> = {}): CloudTemplateMetadata => ({
  keywords: '',
  description: '',
  category: '未分类',
  scope: 'user',
  shared: false,
  ...overrides
})

beforeEach(() => {
  request.mockReset()
})

describe('offline cloud repository', () => {
  const repo = createCloudRepository('')

  it('validates registration input and logs in an existing account', async () => {
    expect((await repo.register('bad', 'secret1')).ok).toBe(false)
    expect((await repo.register('user@example.com', '123')).ok).toBe(false)

    const registered = await repo.register('User@Example.com', 'secret1')
    expect(registered.ok).toBe(true)
    expect(registered.data?.email).toBe('user@example.com')

    const login = await repo.login('user@example.com', 'secret1')
    expect(login.ok).toBe(true)
    expect(login.data?.token).toBeTruthy()
    expect((await repo.login('user@example.com', 'wrong')).ok).toBe(false)
  })

  it('saves, lists, loads and deletes templates', async () => {
    const login = await repo.login('user@example.com', 'secret1')
    const token = login.data!.token

    expect((await repo.save(token, 'bad', '{bad json')).ok).toBe(false)
    const saved = await repo.save(token, '模板 A', '{"a":1}', meta({ keywords: 'kw', category: '测试' }))
    expect(saved.ok, JSON.stringify(saved)).toBe(true)
    expect(saved.data?.name).toBe('模板 A')

    const list = await repo.list(token)
    expect(list.ok).toBe(true)
    expect(list.data?.map((item) => item.name)).toContain('模板 A')
    expect(list.data?.[0].metadata?.category).toBe('测试')

    const loaded = await repo.load(token, saved.data!.id)
    expect(loaded.ok).toBe(true)
    expect(loaded.data?.json).toBe('{"a":1}')

    expect((await repo.delete(token, saved.data!.id)).ok).toBe(true)
    expect((await repo.load(token, saved.data!.id)).ok).toBe(false)
  })

  it('reports empty cloud databases and rejects a logged-out session', async () => {
    const login = await repo.login('user@example.com', 'secret1')
    const token = login.data!.token
    expect(await repo.databases(token)).toEqual({ ok: true, data: [] })
    expect(await repo.databaseTables(token, 'db')).toEqual({ ok: true, data: [] })
    expect(await repo.databaseRows(token, 'db', 'table', ['a'])).toEqual({ ok: true, data: [] })

    expect((await repo.logout(token)).ok).toBe(true)
    expect((await repo.list(token)).ok).toBe(false)
  })
})

describe('remote cloud repository', () => {
  const base = 'https://cloud.example.com'
  const repo = createCloudRepository(base)

  it('calls the expected auth and template endpoints', async () => {
    request
      .mockResolvedValueOnce({ status: 200, body: JSON.stringify({ token: 'tk', email: 'user@example.com' }) })
      .mockResolvedValueOnce({ status: 200, body: JSON.stringify({ id: 7, name: '模板' }) })
      .mockResolvedValueOnce({ status: 200, body: JSON.stringify([{ id: 7, name: '模板', updated_at: '2026-01-01' }]) })
      .mockResolvedValueOnce({ status: 200, body: JSON.stringify({ id: 7, name: '模板', data: '{"a":1}' }) })
      .mockResolvedValueOnce({ status: 200, body: JSON.stringify({ ok: true }) })
      .mockResolvedValueOnce({ status: 200, body: JSON.stringify([{ id: 'db1', name: '库' }]) })
      .mockResolvedValueOnce({ status: 200, body: JSON.stringify([{ name: 't1', columns: ['a'], row_count: 2 }]) })
      .mockResolvedValueOnce({ status: 200, body: JSON.stringify([{ a: 1 }]) })

    expect(await repo.login('user@example.com', 'secret1')).toEqual({ ok: true, data: { token: 'tk', email: 'user@example.com' } })
    expect(request).toHaveBeenNthCalledWith(1, `${base}/api/auth/login`, 'POST', { email: 'user@example.com', password: 'secret1' }, undefined)

    const saved = await repo.save('tk', '模板', '{"a":1}', meta({ keywords: 'k' }))
    expect(saved.data?.id).toBe('7')
    expect(request).toHaveBeenNthCalledWith(
      2,
      `${base}/api/cloud/templates`,
      'POST',
      { name: '模板', data: '{"a":1}', keywords: 'k', description: '', category: '未分类', scope: 'user', shared: false },
      { Authorization: 'Bearer tk' }
    )

    const list = await repo.list('tk')
    expect(list.data?.[0]).toMatchObject({ id: '7', name: '模板' })
    expect(request).toHaveBeenNthCalledWith(3, `${base}/api/cloud/templates?offset=0&limit=500`, 'GET', undefined, { Authorization: 'Bearer tk' })

    expect((await repo.load('tk', '7')).data?.json).toBe('{"a":1}')
    expect((await repo.delete('tk', '7')).ok).toBe(true)
    expect((await repo.databases('tk')).data?.[0]).toEqual({ id: 'db1', name: '库' })
    expect((await repo.databaseTables('tk', 'db1')).data?.[0]).toEqual({ name: 't1', columns: ['a'], rowCount: 2 })
    expect((await repo.databaseRows('tk', 'db1', 't1', ['a'])).data).toEqual([{ a: 1 }])
  })

  it('maps HTTP errors to repository errors', async () => {
    request.mockResolvedValueOnce({ status: 400, body: JSON.stringify({ detail: '模板名称不能为空' }) })
    const result = await repo.save('tk', '', '{}')
    expect(result.ok).toBe(false)
    expect(result.error).toBe('模板名称不能为空')
  })

  it('rejects insecure remote URLs and network failures', async () => {
    const invalid = createCloudRepository('http://remote.example.com')
    expect((await invalid.login('a@b.com', 'secret')).ok).toBe(false)

    request.mockRejectedValueOnce(new Error('offline'))
    const failed = await repo.login('a@b.com', 'secret')
    expect(failed.ok).toBe(false)
    expect(failed.error).toMatch(/无法连接云服务器/)
  })
})

afterAll(() => {
  const dir = (globalThis as { __cloudUserDataDir?: string }).__cloudUserDataDir
  if (dir) rmSync(dir, { recursive: true, force: true })
})
