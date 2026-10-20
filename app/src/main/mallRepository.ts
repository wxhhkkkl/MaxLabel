import type {
  MallContext,
  MallMember,
  MallPlan,
  MallSharedTemplate,
  MallSharedTemplateContent,
  MallTemplateContent,
  MallTemplateMetadata
} from '../shared/ipcContract'
import { httpRequestJson } from './net'
import type { MallTokens } from './mallCredentials'
import { normalizeServerUrl } from './serverUrlPolicy'

export class MallApiError extends Error {
  constructor(readonly code: number, message: string, readonly status = 0) {
    super(message)
    this.name = 'MallApiError'
  }
}

interface Envelope<T> {
  code?: number
  data?: T
  msg?: string
}

export function validateMallContext(context: MallContext): { baseUrl: string; tenantId: number } {
  if (!context || typeof context !== 'object') throw new Error('商城配置无效')
  const baseUrl = normalizeServerUrl(context.baseUrl)
  if (!baseUrl) {
    const raw = String(context.baseUrl || '').trim()
    if (/^http:\/\//i.test(raw) && !/^http:\/\/(localhost|127\.0\.0\.1|\[::1\])(?::|\/|$)/i.test(raw)) {
      throw new Error('商城地址必须使用 HTTPS（本机回环除外）')
    }
    throw new Error('未配置商城地址')
  }
  const tenantId = Number(context.tenantId)
  if (!Number.isInteger(tenantId) || tenantId < 1 || tenantId > 999999) throw new Error('商城租户编号无效')
  return { baseUrl, tenantId }
}

function headersFor(tenantId: number, token?: string | null): Record<string, string> {
  return {
    'tenant-id': String(tenantId),
    terminal: '31',
    ...(token ? { Authorization: `Bearer ${token}` } : {})
  }
}

async function requestMall<T>(
  context: MallContext,
  token: string | null,
  method: 'GET' | 'POST' | 'PUT' | 'DELETE',
  path: string,
  payload?: unknown,
  maxResponseBytes?: number
): Promise<T> {
  const { baseUrl, tenantId } = validateMallContext(context)
  const response = await httpRequestJson(
    `${baseUrl}${path}`,
    method,
    payload,
    headersFor(tenantId, token),
    8000,
    maxResponseBytes
  )
  let envelope: Envelope<T>
  try {
    envelope = JSON.parse(response.body) as Envelope<T>
  } catch {
    throw new MallApiError(-1, `商城返回了非 JSON 响应（HTTP ${response.status}）`, response.status)
  }
  if (response.status === 401) {
    throw new MallApiError(typeof envelope.code === 'number' ? envelope.code : 401,
      envelope.msg || '登录已过期', response.status)
  }
  if (typeof envelope.code !== 'number') {
    throw new MallApiError(-1, envelope.msg || `商城响应缺少 code（HTTP ${response.status}）`, response.status)
  }
  if (envelope.code !== 0) {
    throw new MallApiError(envelope.code, envelope.msg || `商城接口错误（${envelope.code}）`, response.status)
  }
  return envelope.data as T
}

function query(params: Record<string, string | number | undefined>): string {
  const search = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== '') search.set(key, String(value))
  }
  const text = search.toString()
  return text ? `?${text}` : ''
}

export async function refreshMallTokens(context: MallContext, refreshToken: string): Promise<MallTokens> {
  const data = await requestMall<{
    accessToken?: string
    refreshToken?: string
    expiresTime?: number
  }>(context, null, 'POST', `/member/auth/refresh-token?refreshToken=${encodeURIComponent(refreshToken)}`)
  if (!data?.accessToken) {
    throw new MallApiError(-1, '商城刷新令牌响应不完整')
  }
  // yudao 刷新会复用 refresh token；部分版本不重复返回，沿用旧值。
  return {
    accessToken: data.accessToken,
    refreshToken: data.refreshToken || refreshToken,
    expiresTime: typeof data.expiresTime === 'number' ? data.expiresTime : Date.now() + 25 * 60 * 1000
  }
}

export function maskMobile(mobile: unknown): string {
  const text = typeof mobile === 'string' ? mobile : ''
  if (text.length >= 7) return `${text.slice(0, 3)}****${text.slice(-4)}`
  return text ? '***' : ''
}

export async function fetchMallMember(context: MallContext, token: string): Promise<{
  userId: number
  mobileMasked: string
  nickname?: string
}> {
  const data = await requestMall<{ id?: number; mobile?: string; nickname?: string }>(
    context, token, 'GET', '/member/user/get')
  return {
    userId: Number(data?.id ?? 0),
    mobileMasked: maskMobile(data?.mobile),
    nickname: typeof data?.nickname === 'string' ? data.nickname : undefined
  }
}

export async function fetchMallSubscription(context: MallContext, token: string): Promise<Partial<MallMember>> {
  const data = await requestMall<{
    active?: boolean
    startDate?: string
    endDate?: string
    startTime?: string
    endTime?: string
    remainingDays?: number
    periodMonths?: number
    sourceOrderNo?: string
  }>(context, token, 'GET', '/member/subscription/get')
  return {
    subscriptionActive: data?.active === true,
    subscriptionEndDate: data?.endDate ?? null,
    subscriptionEndTime: data?.endTime ?? null,
    remainingDays: typeof data?.remainingDays === 'number' ? data.remainingDays : 0,
    periodMonths: data?.periodMonths ?? null,
    sourceOrderNo: data?.sourceOrderNo ?? null
  }
}

export async function fetchMallPlans(context: MallContext): Promise<MallPlan[]> {
  const data = await requestMall<Array<Partial<MallPlan>>>(context, null, 'GET', '/product/subscription-plan/list')
  return (data ?? []).map((plan) => ({
    spuId: Number(plan.spuId ?? 0),
    skuId: Number(plan.skuId ?? 0),
    name: String(plan.name ?? ''),
    periodMonths: Number(plan.periodMonths ?? 0),
    price: Number(plan.price ?? 0),
    picUrl: plan.picUrl,
    stock: plan.stock,
    sort: plan.sort
  }))
}

export async function fetchMallTemplates(context: MallContext, token: string, keyword?: string): Promise<MallTemplateMetadata[]> {
  const data = await requestMall<{ list?: MallTemplateMetadata[] }>(
    context, token, 'GET', `/member/cloud-template/page${query({ pageNo: 1, pageSize: 200, keyword })}`)
  return data?.list ?? []
}

export async function fetchMallTemplate(context: MallContext, token: string, id: number): Promise<MallTemplateContent> {
  return requestMall<MallTemplateContent>(context, token, 'GET', `/member/cloud-template/get${query({ id })}`, undefined, 32 * 1024 * 1024)
}

export async function saveMallTemplate(
  context: MallContext,
  token: string,
  payload: {
    id?: number
    name: string
    content: string
    widthMm?: number
    heightMm?: number
    category?: string
    keywords?: string
  }
): Promise<number> {
  if (payload.id) {
    await requestMall<boolean>(context, token, 'PUT', '/member/cloud-template/update', payload)
    return payload.id
  }
  const data = await requestMall<{ id?: number }>(context, token, 'POST', '/member/cloud-template/create', payload)
  return Number(data?.id ?? 0)
}

export async function deleteMallTemplate(context: MallContext, token: string, id: number): Promise<void> {
  await requestMall<boolean>(context, token, 'DELETE', `/member/cloud-template/delete${query({ id })}`)
}

export async function submitMallTemplateShare(
  context: MallContext,
  token: string,
  id: number,
  category?: string,
  keywords?: string
): Promise<{ sharedTemplateId: number; auditStatus: number }> {
  const data = await requestMall<{ sharedTemplateId?: number; auditStatus?: number }>(
    context, token, 'POST', '/member/cloud-template/submit-share', { id, category, keywords })
  return {
    sharedTemplateId: Number(data?.sharedTemplateId ?? 0),
    auditStatus: Number(data?.auditStatus ?? 0)
  }
}

export async function cancelMallTemplateShare(context: MallContext, token: string, id: number): Promise<void> {
  await requestMall<boolean>(context, token, 'DELETE', `/member/cloud-template/cancel-share${query({ id })}`)
}

export async function fetchMallSharedTemplates(
  context: MallContext,
  token: string,
  keyword?: string,
  category?: string
): Promise<MallSharedTemplate[]> {
  const data = await requestMall<{ list?: MallSharedTemplate[] }>(
    context, token, 'GET', `/member/shared-template/page${query({ pageNo: 1, pageSize: 200, keyword, category })}`)
  return data?.list ?? []
}

export async function fetchMallSharedTemplate(
  context: MallContext,
  token: string,
  id: number
): Promise<MallSharedTemplateContent> {
  return requestMall<MallSharedTemplateContent>(
    context, token, 'GET', `/member/shared-template/get${query({ id })}`, undefined, 32 * 1024 * 1024)
}

export async function reportMallPrintRecord(
  context: MallContext,
  token: string,
  record: Record<string, unknown>
): Promise<void> {
  await requestMall<{ id?: number }>(context, token, 'POST', '/member/print-record/create', record)
}

export async function logoutMall(context: MallContext, token: string): Promise<void> {
  await requestMall<boolean>(context, token, 'POST', '/member/auth/logout')
}
