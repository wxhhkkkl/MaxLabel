import { mkdtemp, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('electron', async () => (await import('../../helpers/electronMock')).createElectronMock())
vi.mock('@main/mallCredentials', () => ({ readMallCredential: vi.fn() }))
vi.mock('@main/mallAuth', () => ({ readMallSession: vi.fn() }))
vi.mock('@main/secureJsonStore', () => ({
  readSecureJson: vi.fn(),
  updateSecureJson: vi.fn(),
  encryptSecureText: vi.fn((value: string) => `enc:${value}`),
  decryptSecureText: vi.fn((value: string) => value.replace(/^enc:/, ''))
}))

import { app } from 'electron'
import { readMallCredential } from '@main/mallCredentials'
import { readMallSession } from '@main/mallAuth'
import { readSecureJson, updateSecureJson } from '@main/secureJsonStore'
import {
  getEntitlementState,
  initEntitlementService,
  refreshEntitlementMember,
  resetEntitlementServiceForTests,
  setDongleState
} from '@main/entitlementService'
import type { MallMember } from '@shared/ipcContract'

const credential = {
  tokens: { accessToken: 'a', refreshToken: 'r', expiresTime: Date.now() + 3_600_000 },
  member: null as MallMember | null,
  deviceId: 'd',
  savedAt: 0
}

function member(overrides: Partial<MallMember> = {}): MallMember {
  return {
    userId: 1,
    mobileMasked: '138****0000',
    companyName: '测试公司',
    subscriptionActive: true,
    edition: 'standard',
    subscriptionEndTime: '2099-01-01T00:00:00.000Z',
    ...overrides
  }
}

beforeEach(() => {
  resetEntitlementServiceForTests()
  vi.clearAllMocks()
  delete process.env.MAXLABEL_TEST_ENTITLEMENT
  ;(app as unknown as { isPackaged: boolean }).isPackaged = false
  vi.mocked(readMallCredential).mockResolvedValue({ ...credential, member: member() })
  vi.mocked(readMallSession).mockResolvedValue(member())
  vi.mocked(readSecureJson).mockResolvedValue({ version: 2 })
  vi.mocked(updateSecureJson).mockResolvedValue()
})

afterEach(() => {
  resetEntitlementServiceForTests()
  delete process.env.MAXLABEL_TEST_ENTITLEMENT
})

describe('entitlement service', () => {
  it('publishes the refreshed member edition and broadcasts it', async () => {
    vi.mocked(readMallSession).mockResolvedValue(member({ edition: 'enterprise' }))
    const send = vi.fn()
    await initEntitlementService(send)
    expect(send).toHaveBeenCalled()
    expect(getEntitlementState()).toMatchObject({ editable: true, edition: 'enterprise', source: 'member' })
    expect(updateSecureJson).toHaveBeenCalled()
  })

  it('keeps the cached member when the refresh fails on the network', async () => {
    vi.mocked(readMallSession).mockRejectedValue(new Error('offline'))
    const send = vi.fn()
    await initEntitlementService(send)
    expect(getEntitlementState()).toMatchObject({ editable: true, edition: 'standard' })
  })

  it('falls back to read-only when the server rejects the session', async () => {
    vi.mocked(readMallSession).mockResolvedValue(null)
    await initEntitlementService(vi.fn())
    expect(getEntitlementState()).toMatchObject({ editable: false, source: 'none' })
  })

  function encryptedSnapshot(payload: Record<string, unknown>) {
    return { version: 2, payload: `enc:${JSON.stringify({ version: 2, ...payload })}` }
  }

  it('uses an encrypted offline snapshot when no credential exists', async () => {
    vi.mocked(readMallCredential).mockResolvedValue(null)
    vi.mocked(readSecureJson).mockResolvedValue(encryptedSnapshot({
      edition: 'professional',
      expiresAt: '2099-01-01T00:00:00.000Z',
      checkedAt: '2026-10-23T00:00:00.000Z',
      memberMasked: '138****0000'
    }))
    await initEntitlementService(vi.fn())
    expect(getEntitlementState()).toMatchObject({ editable: true, edition: 'professional' })
  })

  it('ignores an expired snapshot', async () => {
    vi.mocked(readMallCredential).mockResolvedValue(null)
    vi.mocked(readSecureJson).mockResolvedValue(encryptedSnapshot({
      edition: 'professional',
      expiresAt: '2020-01-01T00:00:00.000Z'
    }))
    await initEntitlementService(vi.fn())
    expect(getEntitlementState()).toMatchObject({ editable: false, source: 'none' })
  })

  it('rejects legacy plaintext snapshots', async () => {
    vi.mocked(readMallCredential).mockResolvedValue(null)
    vi.mocked(readSecureJson).mockResolvedValue({ version: 1, edition: 'enterprise', expiresAt: '2099-01-01T00:00:00.000Z' })
    await initEntitlementService(vi.fn())
    expect(getEntitlementState()).toMatchObject({ editable: false, source: 'none' })
  })

  it('rejects a snapshot whose payload cannot be decrypted or parsed', async () => {
    vi.mocked(readMallCredential).mockResolvedValue(null)
    vi.mocked(readSecureJson).mockResolvedValue({ version: 2, payload: 'not-encrypted-json' })
    await initEntitlementService(vi.fn())
    expect(getEntitlementState()).toMatchObject({ editable: false, source: 'none' })
  })

  it('lets a valid dongle unlock every feature and notifies listeners', async () => {
    await initEntitlementService(vi.fn())
    const send = vi.fn()
    // 重新注册广播（init 已初始化，调用会重新发布）
    await initEntitlementService(send)
    setDongleState({ present: true, valid: true, checkedAt: new Date().toISOString() })
    expect(send).toHaveBeenCalled()
    expect(getEntitlementState()).toMatchObject({ editable: true, source: 'member+dongle' })
    expect(Object.values(getEntitlementState().features).every(Boolean)).toBe(true)
  })

  it('does not expose tokens or full mobile numbers in the entitlement state', async () => {
    await initEntitlementService(vi.fn())
    const serialized = JSON.stringify(getEntitlementState())
    expect(serialized).not.toContain('accessToken')
    expect(serialized).not.toContain('refreshToken')
    expect(serialized).not.toContain('13800000000')
  })

  it('updates immediately after login or renewal', async () => {
    await initEntitlementService(vi.fn())
    refreshEntitlementMember(member({ edition: 'professional' }))
    expect(getEntitlementState()).toMatchObject({ edition: 'professional', editable: true })
  })

  it('follows a dynamic override file so auth loss can be simulated', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'maxlabel-entitlement-'))
    const file = join(dir, 'state.json')
    await writeFile(file, JSON.stringify({ mode: 'enterprise' }), 'utf8')
    process.env.MAXLABEL_TEST_ENTITLEMENT_FILE = file
    try {
      await initEntitlementService(vi.fn())
      expect(getEntitlementState().editable).toBe(true)

      await writeFile(file, JSON.stringify({ mode: 'readonly' }), 'utf8')
      await new Promise((resolve) => setTimeout(resolve, 700))
      expect(getEntitlementState().editable).toBe(false)
    } finally {
      delete process.env.MAXLABEL_TEST_ENTITLEMENT_FILE
    }
  })

  it('honours the test override only in non-packaged builds', async () => {
    process.env.MAXLABEL_TEST_ENTITLEMENT = 'readonly'
    await initEntitlementService(vi.fn())
    expect(getEntitlementState().editable).toBe(false)

    resetEntitlementServiceForTests()
    ;(app as unknown as { isPackaged: boolean }).isPackaged = true
    await initEntitlementService(vi.fn())
    expect(getEntitlementState().editable).toBe(true)
  })
})
