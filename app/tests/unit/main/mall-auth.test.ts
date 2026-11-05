import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@main/mallCredentials', () => ({
  readMallCredential: vi.fn(),
  saveMallCredential: vi.fn(),
  clearMallCredential: vi.fn()
}))
vi.mock('@main/mallService', () => ({
  clearMallSession: vi.fn(),
  syncMallSession: vi.fn()
}))
vi.mock('@main/mallRepository', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@main/mallRepository')>()
  return {
    ...actual,
    completeMallWechatProfile: vi.fn(),
    fetchMallMember: vi.fn(),
    fetchMallSubscription: vi.fn(),
    loginMallWithPassword: vi.fn(),
    loginMallWithSms: vi.fn(),
    logoutMall: vi.fn(),
    queryMallWechatScan: vi.fn(),
    refreshMallTokens: vi.fn()
  }
})

import {
  clearMallCredential,
  readMallCredential,
  saveMallCredential
} from '@main/mallCredentials'
import {
  completeMallWechatProfile,
  fetchMallMember,
  fetchMallSubscription,
  loginMallWithPassword,
  loginMallWithSms,
  MallApiError,
  queryMallWechatScan,
  refreshMallTokens
} from '@main/mallRepository'
import { clearMallSession, syncMallSession } from '@main/mallService'
import {
  completeMallWechatLogin,
  loginMallUsingPassword,
  loginMallUsingSms,
  logoutMallAccount,
  queryMallWechatLogin,
  readMallSession,
  withMallToken
} from '@main/mallAuth'

const context = { baseUrl: 'https://mall.test', tenantId: 162 }
const tokens = { accessToken: 'a1', refreshToken: 'r1', expiresTime: Date.now() + 3_600_000 }
const credential = { tokens, member: null, deviceId: 'device-1', savedAt: 0 }

const readCredential = vi.mocked(readMallCredential)
const saveCredential = vi.mocked(saveMallCredential)
const clearCredential = vi.mocked(clearMallCredential)
const member = vi.mocked(fetchMallMember)
const subscription = vi.mocked(fetchMallSubscription)
const refresh = vi.mocked(refreshMallTokens)
const passwordLogin = vi.mocked(loginMallWithPassword)
const smsLogin = vi.mocked(loginMallWithSms)
const completeProfile = vi.mocked(completeMallWechatProfile)
const queryScan = vi.mocked(queryMallWechatScan)
const syncSession = vi.mocked(syncMallSession)
const clearSession = vi.mocked(clearMallSession)

beforeEach(() => {
  vi.clearAllMocks()
  readCredential.mockResolvedValue(credential)
  member.mockResolvedValue({ userId: 1001, mobileMasked: '138****0000', nickname: '张三' })
  subscription.mockResolvedValue({ subscriptionActive: true, remainingDays: 365, subscriptionEndDate: '2027-10-20' })
  saveCredential.mockResolvedValue()
  clearCredential.mockResolvedValue()
  passwordLogin.mockResolvedValue(tokens)
  smsLogin.mockResolvedValue(tokens)
  completeProfile.mockResolvedValue(tokens)
  queryScan.mockResolvedValue({ status: '待确认' })
})

describe('mall auth', () => {
  it('logs in with the mobile password and saves the session', async () => {
    const result = await loginMallUsingPassword(context, '13800138000', 'secret')
    expect(passwordLogin).toHaveBeenCalledWith(context, '13800138000', 'secret')
    expect(result).toMatchObject({ userId: 1001, mobileMasked: '138****0000', subscriptionActive: true })
    expect(saveCredential).toHaveBeenCalledWith('https://mall.test', tokens, expect.objectContaining({ userId: 1001 }))
    expect(syncSession).toHaveBeenCalledWith(context, tokens, { reload: true })
  })

  it('logs in with an SMS code and saves the session', async () => {
    const result = await loginMallUsingSms(context, '13800138000', '1234')
    expect(smsLogin).toHaveBeenCalledWith(context, '13800138000', '1234')
    expect(result).toMatchObject({ userId: 1001, subscriptionActive: true })
    expect(saveCredential).toHaveBeenCalledWith('https://mall.test', tokens, expect.objectContaining({ userId: 1001 }))
  })

  it('keeps the enterprise source fields in the saved session', async () => {
    // 012 / FR-322：来源字段要原样带进会话，账户弹层据此显示「企业授权（公司名）」
    subscription.mockResolvedValue({
      subscriptionActive: true,
      remainingDays: 200,
      subscriptionEndDate: '2027-05-06',
      edition: 'enterprise',
      activeEditions: ['enterprise'],
      subscriptionSource: 'enterprise',
      orgName: '北京杏林康云'
    })

    const result = await loginMallUsingPassword(context, '13800138000', 'secret')

    expect(result).toMatchObject({
      subscriptionSource: 'enterprise',
      orgName: '北京杏林康云',
      edition: 'enterprise'
    })
    expect(saveCredential).toHaveBeenCalledWith(
      'https://mall.test',
      tokens,
      expect.objectContaining({ subscriptionSource: 'enterprise', orgName: '北京杏林康云' })
    )
  })

  it('completes a WeChat login when the storefront already returned tokens', async () => {
    const result = await completeMallWechatLogin(context, {
      ticket: 't1', mobile: '13800138000', code: '1234', company: '测试公司'
    })
    expect(completeProfile).toHaveBeenCalledWith(context, {
      ticket: 't1', mobile: '13800138000', code: '1234', company: '测试公司'
    })
    expect(result).toMatchObject({ userId: 1001, subscriptionActive: true })
    expect(saveCredential).toHaveBeenCalled()
  })

  it('reports a pending WeChat completion when the storefront returns no tokens yet', async () => {
    completeProfile.mockResolvedValue(null)
    await expect(completeMallWechatLogin(context, {
      ticket: 't1', mobile: '13800138000', code: '1234'
    })).resolves.toBeNull()
    expect(saveCredential).not.toHaveBeenCalled()
  })

  it('turns a completed WeChat scan into a full session', async () => {
    queryScan.mockResolvedValue({
      status: '已完成',
      accessToken: 'a9',
      refreshToken: 'r9',
      expiresTime: Date.now() + 3_600_000
    })
    const result = await queryMallWechatLogin(context, 't1')
    expect(result).toMatchObject({ status: 'completed', member: { userId: 1001 } })
    expect(saveCredential).toHaveBeenCalledWith(
      'https://mall.test',
      expect.objectContaining({ accessToken: 'a9', refreshToken: 'r9' }),
      expect.objectContaining({ userId: 1001 })
    )
  })

  it('surfaces the WeChat profile-completion requirement without logging in', async () => {
    queryScan.mockResolvedValue({ status: '待补全', wxNickname: '微信昵称', wxAvatar: 'https://cdn.test/a.png' })
    await expect(queryMallWechatLogin(context, 't1')).resolves.toEqual({
      status: 'need-profile', nickname: '微信昵称'
    })
    expect(saveCredential).not.toHaveBeenCalled()
  })

  it('maps expired and pending WeChat scans', async () => {
    queryScan.mockResolvedValue({ status: '已过期' })
    await expect(queryMallWechatLogin(context, 't1')).resolves.toEqual({ status: 'expired' })

    queryScan.mockResolvedValue({ status: '待确认' })
    await expect(queryMallWechatLogin(context, 't1')).resolves.toEqual({ status: 'pending' })
  })

  it('clears both the saved credentials and the storefront localStorage on logout', async () => {
    await logoutMallAccount(context)
    expect(clearCredential).toHaveBeenCalledWith('https://mall.test')
    expect(clearSession).toHaveBeenCalledWith(context)
  })

  it('rejects a completed scan without usable tokens', async () => {
    queryScan.mockResolvedValue({ status: '已完成', accessToken: 'a9' })
    await expect(queryMallWechatLogin(context, 't1')).rejects.toThrow(/令牌/)
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
