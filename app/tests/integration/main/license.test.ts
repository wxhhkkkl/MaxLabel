import { readFileSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { afterAll, describe, expect, it, vi } from 'vitest'

vi.mock('electron', async () => {
  const fs = await import('node:fs')
  const os = await import('node:os')
  const path = await import('node:path')
  const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'maxlabel-license-'))
  ;(globalThis as { __licenseUserDataDir?: string }).__licenseUserDataDir = userDataDir
  const { createElectronMock } = await import('../../helpers/electronMock')
  const mock = createElectronMock({ userDataDir })
  mock.safeStorage.isEncryptionAvailable.mockReturnValue(true)
  return mock
})

vi.mock('@main/net', () => ({ httpPostJson: vi.fn() }))

import { safeStorage } from 'electron'
import { activateLicense, checkLicenseOnline, readLicenseState } from '@main/license'
import { httpPostJson } from '@main/net'

const post = vi.mocked(httpPostJson)
const server = 'https://cloud.example.com'

describe('license integration', () => {
  it('starts inactive', async () => {
    const state = await readLicenseState()
    expect(state.active).toBe(false)
    expect(state.machineId).toMatch(/^[0-9a-f]{16}$/)
  })

  it('activates online and persists the local cache', async () => {
    post.mockResolvedValueOnce({ status: 200, body: JSON.stringify({ active: true, holder: 'buyer@example.com', expires_at: null }) })
    const result = await activateLicense('KEY-1234', server)
    expect(result.ok).toBe(true)
    expect(result.state?.active).toBe(true)
    expect(result.state?.holder).toBe('buyer@example.com')

    const cached = await readLicenseState()
    expect(cached.active).toBe(true)
    expect(cached.key).toBe('KEY-1234')
    const dir = (globalThis as { __licenseUserDataDir?: string }).__licenseUserDataDir!
    const stored = JSON.parse(readFileSync(join(dir, 'license.json'), 'utf8'))
    expect(stored.keyEncoding).toBe('safeStorage')
    expect(stored.key).not.toBe('KEY-1234')
    expect(post).toHaveBeenCalledWith(`${server}/api/license/activate`, { key: 'KEY-1234', machine_id: expect.any(String) })
  })

  it('keeps the last encrypted cache if secure storage is unavailable during activation', async () => {
    const requests = post.mock.calls.length
    vi.mocked(safeStorage.isEncryptionAvailable).mockReturnValueOnce(false)
    await expect(activateLicense('NEW-SECRET', server)).resolves.toMatchObject({ ok: false, error: expect.stringContaining('安全凭据存储') })
    expect(post).toHaveBeenCalledTimes(requests)
    expect((await readLicenseState()).key).toBe('KEY-1234')
  })

  it('keeps the cache when the online re-check cannot connect', async () => {
    post.mockRejectedValueOnce(new Error('offline'))
    const result = await checkLicenseOnline(server)
    expect(result.ok).toBe(false)
    expect(result.error).toMatch(/保留本地授权/)
    expect((await readLicenseState()).active).toBe(true)
  })

  it('refreshes the cache on a successful re-check', async () => {
    post.mockResolvedValueOnce({ status: 200, body: JSON.stringify({ active: true, expires_at: '2030-01-01T00:00:00Z' }) })
    const result = await checkLicenseOnline(server)
    expect(result.ok).toBe(true)
    const cached = await readLicenseState()
    expect(cached.active).toBe(true)
    expect(cached.expiresAt).toBe('2030-01-01T00:00:00Z')
    expect(cached.lastCheckAt).toBeTruthy()
  })

  it('preserves a valid license during a service outage', async () => {
    post.mockResolvedValueOnce({ status: 503, body: '{"detail":"maintenance"}' })
    await expect(checkLicenseOnline(server)).resolves.toMatchObject({ ok: false, error: expect.stringContaining('503') })
    expect((await readLicenseState()).active).toBe(true)
  })

  it('marks the cache inactive when the server rejects the license', async () => {
    post.mockResolvedValueOnce({ status: 400, body: JSON.stringify({ detail: '授权已撤销' }) })
    const result = await checkLicenseOnline(server)
    expect(result.ok).toBe(false)
    expect(result.error).toBe('授权已撤销')
    expect((await readLicenseState()).active).toBe(false)
  })

  it('restores an inactive cache when the server confirms activation again', async () => {
    post.mockResolvedValueOnce({ status: 200, body: '{"active":true,"holder":"buyer@example.com","expires_at":null}' })
    await expect(checkLicenseOnline(server)).resolves.toMatchObject({ ok: true })
    expect(await readLicenseState()).toMatchObject({ active: true, holder: 'buyer@example.com', expiresAt: null })
  })

  it('discards an older re-check result after a new key is activated', async () => {
    const response = { status: 200, body: '{"active":true}' }
    let finishCheck!: (value: typeof response) => void
    post.mockReturnValueOnce(new Promise((resolve) => { finishCheck = resolve })).mockResolvedValueOnce(response)
    const check = checkLicenseOnline(server)
    await vi.waitFor(() => expect(post).toHaveBeenCalledWith(`${server}/api/license/check`, { key: 'KEY-1234', machine_id: expect.any(String) }))
    await expect(activateLicense('NEW-KEY', server)).resolves.toMatchObject({ ok: true })
    finishCheck(response)
    await expect(check).resolves.toMatchObject({ ok: false })
    expect(await readLicenseState()).toMatchObject({ active: true, key: 'NEW-KEY' })
  })

  it('rejects an invalid or missing server URL without network access', async () => {
    expect((await activateLicense('KEY', '')).ok).toBe(false)
    expect((await activateLicense('KEY', 'http://remote.example.com')).ok).toBe(false)
  })
})

afterAll(() => {
  const dir = (globalThis as { __licenseUserDataDir?: string }).__licenseUserDataDir
  if (dir) rmSync(dir, { recursive: true, force: true })
})
