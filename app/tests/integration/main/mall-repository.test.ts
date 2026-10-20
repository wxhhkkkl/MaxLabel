import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@main/net', () => ({ httpRequestJson: vi.fn() }))

import { httpRequestJson } from '@main/net'
import {
  cancelMallTemplateShare,
  deleteMallTemplate,
  fetchMallPlans,
  fetchMallSharedTemplate,
  fetchMallSharedTemplates,
  fetchMallTemplate,
  fetchMallTemplates,
  MallApiError,
  maskMobile,
  refreshMallTokens,
  saveMallTemplate,
  submitMallTemplateShare
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
    expect(url).toBe('https://mall.test/member/cloud-template/update')
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
    expect(url).toContain('/member/auth/refresh-token?refreshToken=r1')
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
    expect(request.mock.calls[0][0]).toBe('https://mall.test/member/cloud-template/create')

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
    expect(request.mock.calls[3][0]).toBe('https://mall.test/member/cloud-template/update')

    request.mockResolvedValue(ok({ sharedTemplateId: 7, auditStatus: 0 }))
    await expect(submitMallTemplateShare(context, 'access-1', 12, '物流', '面单'))
      .resolves.toEqual({ sharedTemplateId: 7, auditStatus: 0 })
    expect(request.mock.calls[4][1]).toBe('POST')
    expect(request.mock.calls[4][2]).toEqual({ id: 12, category: '物流', keywords: '面单' })

    request.mockResolvedValue(ok({ list: [{ id: 7, name: '共享面单', widthMm: 100, heightMm: 150 }] }))
    await expect(fetchMallSharedTemplates(context, 'access-1', '面单', '物流')).resolves.toHaveLength(1)
    expect(request.mock.calls[5][0]).toContain('/member/shared-template/page')

    request.mockResolvedValue(ok({ id: 7, name: '共享面单', content: '{"x":1}' }))
    await fetchMallSharedTemplate(context, 'access-1', 7)
    expect(request.mock.calls[6][0]).toContain('/member/shared-template/get?id=7')

    request.mockResolvedValue(ok(true))
    await cancelMallTemplateShare(context, 'access-1', 12)
    expect(request.mock.calls[7][1]).toBe('DELETE')
    expect(request.mock.calls[7][0]).toContain('/member/cloud-template/cancel-share?id=12')
  })

  it('rejects remote plain HTTP and masks mobile numbers', async () => {
    await expect(fetchMallPlans({ baseUrl: 'http://mall.test', tenantId: 162 }))
      .rejects.toThrow(/HTTPS/)
    expect(maskMobile('13800138000')).toBe('138****8000')
    expect(maskMobile('')).toBe('')
    expect(new MallApiError(1, 'x').code).toBe(1)
  })
})
