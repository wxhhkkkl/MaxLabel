import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@main/mallCredentials', () => ({
  readMallCredential: vi.fn(),
  saveMallCredential: vi.fn(),
  clearMallCredential: vi.fn()
}))
vi.mock('@main/mallService', () => ({
  openMallLoginWindow: vi.fn(),
  waitForLoginTokens: vi.fn(),
  closeMallLoginWindow: vi.fn(),
  closeMallWindows: vi.fn(),
  syncMallSession: vi.fn()
}))
vi.mock('@main/mallRepository', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@main/mallRepository')>()
  return {
    ...actual,
    fetchMallMember: vi.fn(),
    fetchMallSubscription: vi.fn(),
    refreshMallTokens: vi.fn(),
    logoutMall: vi.fn()
  }
})

import {
  clearMallCredential,
  readMallCredential,
  saveMallCredential
} from '@main/mallCredentials'
import {
  fetchMallMember,
  fetchMallSubscription,
  MallApiError,
  refreshMallTokens
} from '@main/mallRepository'
import {
  closeMallLoginWindow,
  openMallLoginWindow,
  waitForLoginTokens
} from '@main/mallService'
import { loginMall, readMallSession, withMallToken } from '@main/mallAuth'

const context = { baseUrl: 'https://mall.test', tenantId: 162 }
const tokens = { accessToken: 'a1', refreshToken: 'r1', expiresTime: Date.now() + 3_600_000 }
const credential = { tokens, member: null, deviceId: 'device-1', savedAt: 0 }

const readCredential = vi.mocked(readMallCredential)
const saveCredential = vi.mocked(saveMallCredential)
const clearCredential = vi.mocked(clearMallCredential)
const member = vi.mocked(fetchMallMember)
const subscription = vi.mocked(fetchMallSubscription)
const refresh = vi.mocked(refreshMallTokens)
const openLogin = vi.mocked(openMallLoginWindow)
const waitTokens = vi.mocked(waitForLoginTokens)

beforeEach(() => {
  vi.clearAllMocks()
  readCredential.mockResolvedValue(credential)
  member.mockResolvedValue({ userId: 1001, mobileMasked: '138****0000', nickname: '张三' })
  subscription.mockResolvedValue({ subscriptionActive: true, remainingDays: 365, subscriptionEndDate: '2027-10-20' })
  saveCredential.mockResolvedValue()
  clearCredential.mockResolvedValue()
  openLogin.mockResolvedValue({} as never)
  waitTokens.mockResolvedValue(tokens)
})

describe('mall auth', () => {
  it('logs in through the storefront window and saves the session', async () => {
    const result = await loginMall(context)
    expect(openLogin).toHaveBeenCalledWith(context)
    expect(result).toMatchObject({ userId: 1001, mobileMasked: '138****0000', subscriptionActive: true })
    expect(saveCredential).toHaveBeenCalledWith('https://mall.test', tokens, expect.objectContaining({ userId: 1001 }))
    expect(closeMallLoginWindow).toHaveBeenCalled()
  })

  it('refreshes an expired token before reading the session', async () => {
    readCredential.mockResolvedValue({ ...credential, tokens: { ...tokens, expiresTime: Date.now() - 1000 } })
    refresh.mockResolvedValue({ accessToken: 'a2', refreshToken: 'r1', expiresTime: Date.now() + 3_600_000 })

    const result = await readMallSession(context)
    expect(refresh).toHaveBeenCalledWith(context, 'r1')
    expect(result?.userId).toBe(1001)
    expect(saveCredential).toHaveBeenCalled()
  })

  it('clears the session when the server rejects the refresh token', async () => {
    readCredential.mockResolvedValue({ ...credential, tokens: { ...tokens, expiresTime: Date.now() - 1000 } })
    refresh.mockRejectedValue(new MallApiError(401, 'expired', 401))

    await expect(readMallSession(context)).resolves.toBeNull()
    expect(clearCredential).toHaveBeenCalledWith('https://mall.test')
  })

  it('keeps the cached member when the refresh fails on the network', async () => {
    readCredential.mockResolvedValue({
      ...credential,
      member: { userId: 1001, mobileMasked: '138****0000', subscriptionActive: true },
      tokens: { ...tokens, expiresTime: Date.now() - 1000 }
    })
    refresh.mockRejectedValue(new Error('offline'))

    await expect(readMallSession(context)).resolves.toMatchObject({ userId: 1001 })
    expect(clearCredential).not.toHaveBeenCalled()
  })

  it('retries once after a 401 from a mall call', async () => {
    refresh.mockResolvedValue({ accessToken: 'a2', refreshToken: 'r1', expiresTime: Date.now() + 3_600_000 })
    const run = vi.fn()
      .mockRejectedValueOnce(new MallApiError(401, 'expired', 401))
      .mockResolvedValueOnce('ok')

    await expect(withMallToken(context, run)).resolves.toBe('ok')
    expect(run).toHaveBeenCalledTimes(2)
    expect(refresh).toHaveBeenCalledTimes(1)
  })

  it('rejects mall calls when not signed in', async () => {
    readCredential.mockResolvedValue(null)
    await expect(withMallToken(context, async () => 'ok')).rejects.toThrow(/请先登录/)
  })
})
