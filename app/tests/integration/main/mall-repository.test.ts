import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@main/net', () => ({ httpRequestJson: vi.fn() }))

import { httpRequestJson } from '@main/net'
import {
  abandonMallWechatScan,
  completeMallWechatProfile,
  createMallWechatScan,
  createShareFolder,
  deleteMallTemplate,
  fetchMallCaptcha,
  fetchMallMember,
  fetchMallOrgRole,
  fetchMallPlans,
  fetchMallSharedTemplate,
  fetchMallSharedTemplates,
  fetchMallSubscription,
  fetchMallTemplate,
  fetchMallTemplates,
  fetchPlatformContentPage,
  fetchShareContentPage,
  fetchShareFolderMembers,
  fetchShareFolders,
  highestEdition,
  isMallCaptchaEnabled,
  loginMallWithPassword,
  loginMallWithSms,
  MallApiError,
  maskMobile,
  queryMallWechatScan,
  refreshMallTokens,
  saveMallTemplate,
  sendMallSmsCode,
  updateShareFolderMembers,
  verifyMallCaptcha
} from '@main/mallRepository'

const request = vi.mocked(httpRequestJson)
const context = { baseUrl: 'https://mall.test', tenantId: 162 }

function ok<T>(data: T): { status: number; body: string } {
  return { status: 200, body: JSON.stringify({ code: 0, data, msg: '' }) }
}

beforeEach(() => request.mockReset())

describe('mall repository', () => {
  it('sends tenant, terminal and bearer headers', async () => {
    request.mockResolvedValue(ok({ id: 9 }))
    await saveMallTemplate(context, 'access-1', {
      id: 9, name: '面单', content: '{"format":"maxlabel-msdx"}'
    })
    expect(request).toHaveBeenCalledTimes(1)
    const [url, method, , headers] = request.mock.calls[0]
    expect(url).toBe('https://mall.test/app-api/member/cloud-template/update')
    expect(method).toBe('PUT')
    expect(headers).toMatchObject({
      'tenant-id': '162',
      terminal: '31',
      Authorization: 'Bearer access-1'
    })
  })

  it('maps business errors and keeps the code', async () => {
    request.mockResolvedValue({
      status: 200, body: JSON.stringify({ code: 1_004_014_000, data: null, msg: '订阅已过期' })
    })
    await expect(fetchMallTemplates(context, 'access-1'))
      .rejects.toMatchObject({ code: 1_004_014_000, message: '订阅已过期' })
  })

  it('refreshes the token without an Authorization header', async () => {
    request.mockResolvedValue(ok({ accessToken: 'a2', refreshToken: 'r2', expiresTime: 999 }))
    const tokens = await refreshMallTokens(context, 'r1')
    expect(tokens).toEqual({ accessToken: 'a2', refreshToken: 'r2', expiresTime: 999 })
    const [url, method, , headers] = request.mock.calls[0]
    expect(url).toContain('/app-api/member/auth/refresh-token?refreshToken=r1')
    expect(method).toBe('POST')
    expect(headers).not.toHaveProperty('Authorization')
  })

  it('lists plans anonymously and pages templates', async () => {
    request.mockResolvedValue(ok([{ spuId: 300, skuId: 301, name: '会员', periodMonths: 1, price: 2900 }]))
    const plans = await fetchMallPlans(context)
    expect(plans[0]).toMatchObject({ skuId: 301, periodMonths: 1 })
    expect(request.mock.calls[0][3]).not.toHaveProperty('Authorization')

    request.mockResolvedValue(ok({ list: [] }))
    await fetchMallTemplates(context, 'access-1', '面单')
    expect(request.mock.calls[1][0]).toContain('pageSize=200')
    expect(request.mock.calls[1][0]).toContain('keyword=%E9%9D%A2%E5%8D%95')
  })

  it('covers private template create/load/delete and shared library reads', async () => {
    request.mockResolvedValue(ok({ id: 12 }))
    await expect(saveMallTemplate(context, 'access-1', {
      name: '面单', content: '{"format":"maxlabel-msdx"}', widthMm: 100, heightMm: 150
    })).resolves.toBe(12)
    expect(request.mock.calls[0][1]).toBe('POST')
    expect(request.mock.calls[0][0]).toBe('https://mall.test/app-api/member/cloud-template/create')

    request.mockResolvedValue(ok({ id: 12, name: '面单', content: '{"x":1}', sizeBytes: 7 }))
    await fetchMallTemplate(context, 'access-1', 12)
    expect(request.mock.calls[1][0]).toContain('/member/cloud-template/get?id=12')
    expect(request.mock.calls[1][5]).toBe(32 * 1024 * 1024)

    request.mockResolvedValue(ok(true))
    await deleteMallTemplate(context, 'access-1', 12)
    expect(request.mock.calls[2][1]).toBe('DELETE')
    expect(request.mock.calls[2][0]).toContain('/member/cloud-template/delete?id=12')

    request.mockResolvedValue(ok(true))
    await saveMallTemplate(context, 'access-1', { id: 12, name: '面单', content: '{"x":1}' })
    expect(request.mock.calls[3][1]).toBe('PUT')
    expect(request.mock.calls[3][0]).toBe('https://mall.test/app-api/member/cloud-template/update')

    request.mockResolvedValue(ok({ list: [{ id: 7, name: '共享面单', widthMm: 100, heightMm: 150 }] }))
    await expect(fetchMallSharedTemplates(context, 'access-1', '面单', '物流')).resolves.toHaveLength(1)
    expect(request.mock.calls[4][0]).toContain('/member/shared-template/page')

    request.mockResolvedValue(ok({ id: 7, name: '共享面单', content: '{"x":1}' }))
    await fetchMallSharedTemplate(context, 'access-1', 7)
    expect(request.mock.calls[5][0]).toContain('/member/shared-template/get?id=7')
  })

  it('reads the enterprise organization role for the renewal entry', async () => {
    request.mockResolvedValue(ok({ role: 2, orgName: '测试企业' }))
    await expect(fetchMallOrgRole(context, 'access-1')).resolves.toBe(2)
    expect(request.mock.calls[0][0]).toBe('https://mall.test/app-api/member/org/get')
    expect(request.mock.calls[0][1]).toBe('GET')
    expect(request.mock.calls[0][3]).toMatchObject({ Authorization: 'Bearer access-1' })

    request.mockResolvedValue(ok({}))
    await expect(fetchMallOrgRole(context, 'access-1')).resolves.toBeNull()
  })

  it('maps company, avatar and the highest active edition', async () => {
    request.mockResolvedValue(ok({
      id: 9,
      mobile: '13800138000',
      nickname: '会员',
      companyName: '  测试公司  ',
      avatarUrl: 'https://cdn.test/avatar.png',
      activeEditions: ['standard', 'enterprise', 'bogus']
    }))
    const profile = await fetchMallMember(context, 'a')
    expect(profile).toMatchObject({
      companyName: '测试公司',
      avatarUrl: 'https://cdn.test/avatar.png',
      edition: 'enterprise'
    })
    expect(profile.mobileMasked).toBe('138****8000')
    expect(JSON.stringify(profile)).not.toContain('13800138000')
  })

  it('ignores non-http avatar URLs and unknown editions', async () => {
    request.mockResolvedValue(ok({
      id: 9,
      mobile: '13800138000',
      avatarUrl: 'javascript:alert(1)',
      edition: 'enterprise-plus'
    }))
    const profile = await fetchMallMember(context, 'a')
    expect(profile.avatarUrl).toBeUndefined()
    expect(profile.edition).toBeUndefined()
  })

  it('maps the subscription edition and exact end time', async () => {
    request.mockResolvedValue(ok({
      active: true,
      endDate: '2027-10-20',
      endTime: '2027-10-20T23:59:59.000Z',
      edition: 'professional',
      activeEditions: ['standard', 'professional']
    }))
    await expect(fetchMallSubscription(context, 'a')).resolves.toMatchObject({
      subscriptionActive: true,
      subscriptionEndTime: '2027-10-20T23:59:59.000Z',
      edition: 'professional'
    })
  })

  it('maps enterprise subscription source and org name', async () => {
    request.mockResolvedValue(ok({
      active: true,
      sourceType: 2,
      orgName: '测试企业',
      endDate: '2027-10-20'
    }))
    await expect(fetchMallSubscription(context, 'a')).resolves.toMatchObject({
      subscriptionActive: true,
      subscriptionSource: 'enterprise',
      orgName: '测试企业'
    })
  })

  it('defaults to personal subscription source', async () => {
    request.mockResolvedValue(ok({ active: true, sourceType: 1, endDate: '2027-10-20' }))
    const subscription = await fetchMallSubscription(context, 'a')
    expect(subscription.subscriptionSource).toBe('personal')
    expect(subscription.orgName).toBeUndefined()
  })

  it('keeps only valid editions on plans and picks the highest edition', async () => {
    request.mockResolvedValue(ok([
      { spuId: 1, skuId: 2, name: '标准', edition: 'standard', periodMonths: 12, price: 1 },
      { spuId: 1, skuId: 3, name: '未知', edition: 'bogus', periodMonths: 12, price: 1 }
    ]))
    const plans = await fetchMallPlans(context)
    expect(plans[0].edition).toBe('standard')
    expect(plans[1].edition).toBeUndefined()
    expect(highestEdition(['standard', 'professional', 'bogus', 'none'])).toBe('professional')
  })

  it('logs in with password or SMS and returns tokens', async () => {
    request.mockResolvedValue(ok({ userId: 9, accessToken: 'a1', refreshToken: 'r1', expiresTime: 123 }))
    await expect(loginMallWithPassword(context, '13800138000', 'secret'))
      .resolves.toEqual({ accessToken: 'a1', refreshToken: 'r1', expiresTime: 123 })
    expect(request.mock.calls[0][0]).toBe('https://mall.test/app-api/member/auth/login')
    expect(request.mock.calls[0][1]).toBe('POST')
    expect(request.mock.calls[0][2]).toEqual({ mobile: '13800138000', password: 'secret' })
    expect(request.mock.calls[0][3]).not.toHaveProperty('Authorization')

    request.mockResolvedValue(ok({ userId: 9, accessToken: 'a2', refreshToken: 'r2' }))
    await expect(loginMallWithSms(context, '13800138000', '1234'))
      .resolves.toMatchObject({ accessToken: 'a2', refreshToken: 'r2', expiresTime: expect.any(Number) })
    expect(request.mock.calls[1][0]).toBe('https://mall.test/app-api/member/auth/sms-login')
    expect(request.mock.calls[1][2]).toEqual({ mobile: '13800138000', code: '1234' })
  })

  it('sends SMS codes with the storefront scene and optional captcha proof', async () => {
    request.mockResolvedValue(ok(true))
    await sendMallSmsCode(context, '13800138000', 'proof')
    expect(request.mock.calls[0][0]).toBe('https://mall.test/app-api/member/auth/send-sms-code')
    expect(request.mock.calls[0][2]).toEqual({ mobile: '13800138000', scene: 1, captchaVerification: 'proof' })

    await sendMallSmsCode(context, '13800138000')
    expect(request.mock.calls[1][2]).toEqual({ mobile: '13800138000', scene: 1 })
  })

  it('honours the storefront captcha switch before fetching a challenge', async () => {
    request.mockResolvedValue(ok(true))
    await expect(isMallCaptchaEnabled(context)).resolves.toBe(true)
    expect(request.mock.calls[0][0]).toBe('https://mall.test/app-api/system/captcha/enable')
    expect(request.mock.calls[0][1]).toBe('GET')

    request.mockResolvedValue(ok(false))
    await expect(isMallCaptchaEnabled(context)).resolves.toBe(false)
  })

  it('fetches the slider captcha and builds the AES proof exactly like the storefront', async () => {
    request.mockResolvedValue(ok({
      originalImageBase64: 'bg',
      jigsawImageBase64: 'piece',
      token: 'abcd',
      secretKey: 'XwKsGlMcdPMEhR1B'
    }))
    await expect(fetchMallCaptcha(context)).resolves.toEqual({
      originalImageBase64: 'bg',
      jigsawImageBase64: 'piece',
      token: 'abcd',
      secretKey: 'XwKsGlMcdPMEhR1B'
    })
    expect(request.mock.calls[0][0]).toBe('https://mall.test/app-api/system/captcha/get')
    expect(request.mock.calls[0][1]).toBe('POST')
    expect(request.mock.calls[0][2]).toEqual({ captchaType: 'blockPuzzle' })

    request.mockResolvedValue(ok({ success: true }))
    await expect(verifyMallCaptcha(context, 'abcd', 'XwKsGlMcdPMEhR1B', 100))
      .resolves.toEqual({ success: true, captchaVerification: '+d/QgOMYq7V7ztORpWIGmOxEBtFsSZt08WT9cAKwob0=' })
    expect(request.mock.calls[1][0]).toBe('https://mall.test/app-api/system/captcha/check')
    expect(request.mock.calls[1][2]).toEqual({
      captchaType: 'blockPuzzle',
      token: 'abcd',
      pointJson: '5Kn7GU2It544MtFJOM71Qw=='
    })

    request.mockResolvedValue(ok({ success: false, msg: '验证不通过' }))
    await expect(verifyMallCaptcha(context, 'abcd', 'XwKsGlMcdPMEhR1B', 50))
      .resolves.toEqual({ success: false })
  })

  it('runs the WeChat scan, query, completion and abandon flow', async () => {
    request.mockResolvedValue(ok({ ticket: 't1', qrContent: 'https://open.weixin.qq.com/x', expiresIn: 300 }))
    await expect(createMallWechatScan(context)).resolves.toEqual({
      ticket: 't1', qrContent: 'https://open.weixin.qq.com/x', expiresIn: 300
    })
    expect(request.mock.calls[0][0]).toBe('https://mall.test/app-api/member/auth/wechat/scan/create')
    expect(request.mock.calls[0][2]).toEqual({ redirectUri: 'https://mall.test/wechat/callback' })

    request.mockResolvedValue(ok({ status: '待补全', wxNickname: '微信昵称', wxAvatar: 'https://cdn.test/a.png' }))
    await expect(queryMallWechatScan(context, 't1')).resolves.toMatchObject({ status: '待补全' })
    expect(request.mock.calls[1][0]).toBe('https://mall.test/app-api/member/auth/wechat/scan/query?ticket=t1')
    expect(request.mock.calls[1][1]).toBe('GET')

    request.mockResolvedValue(ok({ accessToken: 'a3', refreshToken: 'r3', expiresTime: 456 }))
    await expect(completeMallWechatProfile(context, {
      ticket: 't1', mobile: '13800138000', code: '1234', company: '测试公司'
    })).resolves.toMatchObject({ accessToken: 'a3', refreshToken: 'r3' })
    expect(request.mock.calls[2][0]).toBe('https://mall.test/app-api/member/auth/wechat/complete')
    expect(request.mock.calls[2][2]).toEqual({
      ticket: 't1', mobile: '13800138000', smsCode: '1234', company: '测试公司'
    })

    request.mockResolvedValue(ok(true))
    await abandonMallWechatScan(context, 't1')
    expect(request.mock.calls[3][0]).toBe('https://mall.test/app-api/member/auth/wechat/abandon')
    expect(request.mock.calls[3][2]).toEqual({ ticket: 't1' })
  })

  it('treats empty share pages as an empty list instead of a load error', async () => {
    request.mockResolvedValue(ok(null))
    await expect(fetchShareContentPage(context, 'a', { scope: 2, folderId: 9, contentType: 1 }))
      .resolves.toEqual({ list: [], total: 0 })

    request.mockResolvedValue(ok(null))
    await expect(fetchPlatformContentPage(context, 'a', {}))
      .resolves.toEqual({ list: [], total: 0 })

    request.mockResolvedValue(ok(null))
    await expect(fetchShareFolders(context, 'a')).resolves.toEqual([])

    request.mockResolvedValue(ok(null))
    await expect(fetchShareFolderMembers(context, 'a', 9))
      .resolves.toEqual({ folderId: 9, members: [] })
  })

  it('normalizes alternate folder/member id fields and keeps nickname + mobile', async () => {
    request.mockResolvedValue(ok([
      { folderId: 7, name: '测试文件夹', memberCount: 2 },
      { folder_id: 8, name: '下划线字段', member_count: 1 }
    ]))
    await expect(fetchShareFolders(context, 'a')).resolves.toEqual([
      { id: 7, name: '测试文件夹', memberCount: 2 },
      { id: 8, name: '下划线字段', memberCount: 1 }
    ])

    request.mockResolvedValue(ok({ folderId: 9 }))
    await expect(createShareFolder(context, 'a', '新文件夹')).resolves.toBe(9)

    request.mockResolvedValue(ok({
      folderId: 9,
      members: [
        { id: 3, nickname: '张三', mobile: '13800138000', visible: true, canEdit: true, canDelete: false },
        { memberId: 4, nickname: '李四', mobile: '13900139000' },
        { member_id: 5, nick_name: '王五', mobile: '13700137000', can_edit: true },
        { id: 0, nickname: '无效成员' }
      ]
    }))
    await expect(fetchShareFolderMembers(context, 'a', 9)).resolves.toEqual({
      folderId: 9,
      members: [
        { memberId: 3, nickname: '张三', mobile: '13800138000', visible: true, canEdit: true, canDelete: false },
        { memberId: 4, nickname: '李四', mobile: '13900139000' },
        { memberId: 5, nickname: '王五', mobile: '13700137000', canEdit: true }
      ]
    })
  })

  it('saves folder member permissions while keeping the legacy visible-member list', async () => {
    request.mockResolvedValue(ok(true))
    await updateShareFolderMembers(context, 'a', 7, [
      { memberId: 1, visible: true, canEdit: true, canDelete: false },
      { memberId: 2, visible: false, canEdit: false, canDelete: false },
      { memberId: 3, visible: true, canEdit: false, canDelete: true }
    ])
    expect(request.mock.calls[0][0]).toBe('https://mall.test/app-api/member/share-folder/update-members')
    expect(request.mock.calls[0][1]).toBe('PUT')
    expect(request.mock.calls[0][2]).toEqual({
      id: 7,
      memberIds: [1, 3],
      members: [
        { memberId: 1, visible: true, canEdit: true, canDelete: false },
        { memberId: 2, visible: false, canEdit: false, canDelete: false },
        { memberId: 3, visible: true, canEdit: false, canDelete: true }
      ]
    })
  })

  it('rejects remote plain HTTP and masks mobile numbers', async () => {
    await expect(fetchMallPlans({ baseUrl: 'http://mall.test', tenantId: 162 }))
      .rejects.toThrow(/HTTPS/)
    expect(maskMobile('13800138000')).toBe('138****8000')
    expect(maskMobile('')).toBe('')
    expect(new MallApiError(1, 'x').code).toBe(1)
  })
})
