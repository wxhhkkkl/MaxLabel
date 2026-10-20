import { rmSync } from 'node:fs'
import { afterAll, describe, expect, it, vi } from 'vitest'

vi.mock('electron', async () => {
  const fs = await import('node:fs')
  const os = await import('node:os')
  const path = await import('node:path')
  const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'maxlabel-mall-credentials-'))
  ;(globalThis as { __mallCredentialDir?: string }).__mallCredentialDir = userDataDir
  const { createElectronMock } = await import('../../helpers/electronMock')
  const mock = createElectronMock({ userDataDir })
  mock.safeStorage.isEncryptionAvailable.mockReturnValue(true)
  mock.safeStorage.encryptString.mockImplementation((value: string) => Buffer.from(`enc:${value}`))
  mock.safeStorage.decryptString.mockImplementation((value: Buffer) => value.toString().replace(/^enc:/, ''))
  return mock
})

import { clearMallCredential, readMallCredential, readMallDeviceId, saveMallCredential } from '@main/mallCredentials'

const baseUrl = 'https://mall.test'

afterAll(() => {
  const dir = (globalThis as { __mallCredentialDir?: string }).__mallCredentialDir
  if (dir) rmSync(dir, { recursive: true, force: true })
})

describe('mall credentials', () => {
  it('encrypts, reads and clears a member session', async () => {
    await saveMallCredential(baseUrl, {
      accessToken: 'access-1', refreshToken: 'refresh-1', expiresTime: 123456789
    }, {
      userId: 1001, mobileMasked: '138****0000', subscriptionActive: true, remainingDays: 365
    })
    const credential = await readMallCredential(baseUrl)
    expect(credential?.tokens.accessToken).toBe('access-1')
    expect(credential?.member?.mobileMasked).toBe('138****0000')
    expect(credential?.deviceId).toMatch(/^[0-9a-f-]{36}$/)

    await clearMallCredential(baseUrl)
    expect(await readMallCredential(baseUrl)).toBeNull()
  })

  it('keeps a stable random device id', async () => {
    const first = await readMallDeviceId(baseUrl)
    const second = await readMallDeviceId(baseUrl)
    expect(first).toMatch(/^[0-9a-f-]{36}$/)
    expect(second).toBe(first)
  })
})
