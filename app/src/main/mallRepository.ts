import { createCipheriv } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { basename } from 'node:path'
import type {
  MallContext,
  MallMember,
  MallPlan,
  MallSharedTemplate,
  MallSharedTemplateContent,
  MallTemplateContent,
  MallTemplateMetadata,
  PlatformContentDetail,
  PlatformContentItem,
  ShareContentDetail,
  ShareContentItem,
  ShareContentQuery,
  ShareFolderItem,
  ShareFolderMember,
  ShareSpaceOverview
} from '../shared/ipcContract'
import { isEdition, type Edition } from '../shared/domain/entitlement'
import { httpRequestJson, httpRequestMultipart } from './net'
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

/** 商城接口挂在 yudao 的 app-api 前缀下（店面同源调用 /app-api/member/...）。 */
const API_PREFIX = '/app-api'

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
    `${baseUrl}${API_PREFIX}${path}`,
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

interface MallAuthResponse {
  accessToken?: string
  refreshToken?: string
  expiresTime?: number
}

/** 店面登录接口只在有 access token 时算成功；刷新令牌缺失则无法持久化会话。 */
function authTokens(data: MallAuthResponse | null, fallbackRefresh?: string): MallTokens {
  const accessToken = typeof data?.accessToken === 'string' ? data.accessToken : ''
  const refreshToken = typeof data?.refreshToken === 'string' && data.refreshToken
    ? data.refreshToken
    : fallbackRefresh ?? ''
  if (!accessToken || !refreshToken) throw new MallApiError(-1, '商城返回的登录令牌不完整')
  return {
    accessToken,
    refreshToken,
    expiresTime: typeof data?.expiresTime === 'number' ? data.expiresTime : Date.now() + 25 * 60 * 1000
  }
}

export async function loginMallWithPassword(
  context: MallContext,
  mobile: string,
  password: string
): Promise<MallTokens> {
  const data = await requestMall<MallAuthResponse>(context, null, 'POST', '/member/auth/login', { mobile, password })
  return authTokens(data)
}

export async function loginMallWithSms(
  context: MallContext,
  mobile: string,
  code: string
): Promise<MallTokens> {
  const data = await requestMall<MallAuthResponse>(context, null, 'POST', '/member/auth/sms-login', { mobile, code })
  return authTokens(data)
}

/** 短信验证码 scene=1（登录/注册）；网站发送验证码前会要求通过滑块验证。 */
export async function sendMallSmsCode(
  context: MallContext,
  mobile: string,
  captchaVerification?: string
): Promise<void> {
  await requestMall<boolean>(context, null, 'POST', '/member/auth/send-sms-code', {
    mobile,
    scene: 1,
    ...(captchaVerification ? { captchaVerification } : {})
  })
}

export interface MallCaptchaChallenge {
  originalImageBase64: string
  jigsawImageBase64: string
  token: string
  secretKey: string
}

/** 店面根据该开关决定发送短信前是否弹滑块；桌面端保持一致。 */
export async function isMallCaptchaEnabled(context: MallContext): Promise<boolean> {
  return await requestMall<boolean>(context, null, 'GET', '/system/captcha/enable') === true
}

export async function fetchMallCaptcha(context: MallContext): Promise<MallCaptchaChallenge> {
  const data = await requestMall<Partial<MallCaptchaChallenge>>(
    context, null, 'POST', '/system/captcha/get', { captchaType: 'blockPuzzle' })
  if (!data
    || typeof data.originalImageBase64 !== 'string' || !data.originalImageBase64
    || typeof data.jigsawImageBase64 !== 'string' || !data.jigsawImageBase64
    || typeof data.token !== 'string' || !data.token
    || typeof data.secretKey !== 'string' || !data.secretKey) {
    throw new MallApiError(-1, '商城返回的验证码不完整')
  }
  return {
    originalImageBase64: data.originalImageBase64,
    jigsawImageBase64: data.jigsawImageBase64,
    token: data.token,
    secretKey: data.secretKey
  }
}

/** 与店面一致：AES-ECB + PKCS7，密钥来自 captcha/get 的 secretKey。 */
function encryptCaptchaText(text: string, secretKey: string): string {
  const key = Buffer.from(secretKey, 'utf8')
  const algorithm = key.length === 24 ? 'aes-192-ecb' : key.length === 32 ? 'aes-256-ecb' : 'aes-128-ecb'
  if (key.length !== 16 && key.length !== 24 && key.length !== 32) {
    throw new MallApiError(-1, '商城返回的验证码密钥无效')
  }
  const cipher = createCipheriv(algorithm, key, null)
  return Buffer.concat([cipher.update(text, 'utf8'), cipher.final()]).toString('base64')
}

function captchaPointJson(x: number): string {
  return JSON.stringify({ x, y: 5 })
}

export async function verifyMallCaptcha(
  context: MallContext,
  token: string,
  secretKey: string,
  x: number
): Promise<{ success: boolean; captchaVerification?: string }> {
  const pointJson = encryptCaptchaText(captchaPointJson(x), secretKey)
  const data = await requestMall<{ success?: boolean; msg?: string }>(
    context, null, 'POST', '/system/captcha/check', { captchaType: 'blockPuzzle', token, pointJson })
  if (data?.success !== true) return { success: false }
  return {
    success: true,
    captchaVerification: encryptCaptchaText(`${token}---${captchaPointJson(x)}`, secretKey)
  }
}

export interface MallWechatScan {
  ticket: string
  qrContent: string
  expiresIn: number
}

export interface MallWechatScanState {
  status: string
  accessToken?: string
  refreshToken?: string
  expiresTime?: number
  wxNickname?: string
  wxAvatar?: string
}

/** redirectUri 固定从校验后的商城地址推导，避免渲染层传入任意回跳地址。 */
export async function createMallWechatScan(context: MallContext): Promise<MallWechatScan> {
  const { baseUrl } = validateMallContext(context)
  const data = await requestMall<Partial<MallWechatScan>>(
    context, null, 'POST', '/member/auth/wechat/scan/create', { redirectUri: `${baseUrl}/wechat/callback` })
  if (!data
    || typeof data.ticket !== 'string' || !data.ticket
    || typeof data.qrContent !== 'string' || !data.qrContent) {
    throw new MallApiError(-1, '商城返回的微信二维码不完整')
  }
  return {
    ticket: data.ticket,
    qrContent: data.qrContent,
    expiresIn: typeof data.expiresIn === 'number' ? data.expiresIn : 300
  }
}

export async function queryMallWechatScan(context: MallContext, ticket: string): Promise<MallWechatScanState> {
  const data = await requestMall<Partial<MallWechatScanState>>(
    context, null, 'GET', `/member/auth/wechat/scan/query${query({ ticket })}`)
  return {
    status: typeof data?.status === 'string' ? data.status : '',
    ...(typeof data?.accessToken === 'string' ? { accessToken: data.accessToken } : {}),
    ...(typeof data?.refreshToken === 'string' ? { refreshToken: data.refreshToken } : {}),
    ...(typeof data?.expiresTime === 'number' ? { expiresTime: data.expiresTime } : {}),
    ...(typeof data?.wxNickname === 'string' ? { wxNickname: data.wxNickname } : {}),
    ...(typeof data?.wxAvatar === 'string' ? { wxAvatar: data.wxAvatar } : {})
  }
}

export async function completeMallWechatProfile(
  context: MallContext,
  payload: { ticket: string; mobile: string; code: string; company?: string }
): Promise<MallTokens | null> {
  const data = await requestMall<MallAuthResponse | null>(
    context, null, 'POST', '/member/auth/wechat/complete', {
      ticket: payload.ticket,
      mobile: payload.mobile,
      smsCode: payload.code,
      ...(payload.company ? { company: payload.company } : {})
    })
  return data?.accessToken ? authTokens(data) : null
}

export async function abandonMallWechatScan(context: MallContext, ticket: string): Promise<void> {
  await requestMall<boolean>(context, null, 'POST', '/member/auth/wechat/abandon', { ticket })
}

export function maskMobile(mobile: unknown): string {
  const text = typeof mobile === 'string' ? mobile : ''
  if (text.length >= 7) return `${text.slice(0, 3)}****${text.slice(-4)}`
  return text ? '***' : ''
}

const EDITION_ORDER: Array<Exclude<Edition, 'none'>> = ['standard', 'professional', 'enterprise']

/** 从单个版本或版本列表里取最高档；非法/未知值一律忽略。 */
export function highestEdition(value: unknown): Edition | undefined {
  const list = Array.isArray(value) ? value : value === undefined || value === null ? [] : [value]
  const valid = list.filter(isEdition).filter((edition) => edition !== 'none')
  return EDITION_ORDER.reduce<Edition | undefined>((best, edition) => valid.includes(edition) ? edition : best, undefined)
}

function safeAvatarUrl(value: unknown): string | undefined {
  if (typeof value !== 'string' || !value.trim()) return undefined
  try {
    const url = new URL(value.trim())
    return url.protocol === 'https:' || url.protocol === 'http:' ? url.toString() : undefined
  } catch {
    return undefined
  }
}

export async function fetchMallMember(context: MallContext, token: string): Promise<{
  userId: number
  mobileMasked: string
  nickname?: string
  companyName?: string
  avatarUrl?: string
  edition?: Edition
  activeEditions?: Edition[]
}> {
  const data = await requestMall<{
    id?: number
    mobile?: string
    nickname?: string
    companyName?: string
    avatarUrl?: string
    edition?: string
    activeEditions?: string[]
  }>(context, token, 'GET', '/member/user/get')
  const companyName = typeof data?.companyName === 'string' ? data.companyName.trim().slice(0, 100) : ''
  const activeEditions = Array.isArray(data?.activeEditions)
    ? data.activeEditions.filter(isEdition).filter((edition) => edition !== 'none')
    : []
  const edition = highestEdition([data?.edition, ...activeEditions])
  return {
    userId: Number(data?.id ?? 0),
    mobileMasked: maskMobile(data?.mobile),
    nickname: typeof data?.nickname === 'string' ? data.nickname : undefined,
    ...(companyName ? { companyName } : {}),
    ...(safeAvatarUrl(data?.avatarUrl) ? { avatarUrl: safeAvatarUrl(data?.avatarUrl) } : {}),
    ...(edition ? { edition } : {}),
    ...(activeEditions.length ? { activeEditions } : {})
  }
}

/** 企业角色：1=所有者，2=管理员，其余为普通成员；不在企业时为 null。 */
export async function fetchMallOrgRole(context: MallContext, token: string): Promise<number | null> {
  const data = await requestMall<{ role?: number }>(context, token, 'GET', '/member/org/get')
  return typeof data?.role === 'number' && Number.isInteger(data.role) ? data.role : null
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
    sourceType?: number
    orgName?: string
    edition?: string
    activeEditions?: string[]
  }>(context, token, 'GET', '/member/subscription/get')
  const activeEditions = Array.isArray(data?.activeEditions)
    ? data.activeEditions.filter(isEdition).filter((edition) => edition !== 'none')
    : []
  const edition = highestEdition([data?.edition, ...activeEditions])
  return {
    subscriptionActive: data?.active === true,
    subscriptionEndDate: data?.endDate ?? null,
    subscriptionEndTime: data?.endTime ?? null,
    remainingDays: typeof data?.remainingDays === 'number' ? data.remainingDays : 0,
    periodMonths: data?.periodMonths ?? null,
    sourceOrderNo: data?.sourceOrderNo ?? null,
    subscriptionSource: data?.sourceType === 2 ? 'enterprise' : 'personal',
    ...(typeof data?.orgName === 'string' && data.orgName ? { orgName: data.orgName } : {}),
    ...(edition ? { edition } : {}),
    ...(activeEditions.length ? { activeEditions } : {})
  }
}

export async function fetchMallPlans(context: MallContext): Promise<MallPlan[]> {
  const data = await requestMall<Array<Partial<MallPlan>>>(context, null, 'GET', '/product/subscription-plan/list')
  return (data ?? []).map((plan) => ({
    spuId: Number(plan.spuId ?? 0),
    skuId: Number(plan.skuId ?? 0),
    name: String(plan.name ?? ''),
    ...(isEdition(plan.edition) && plan.edition !== 'none' ? { edition: plan.edition } : {}),
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

// ======================= 共享内容空间（016） =======================

export async function fetchShareOverview(context: MallContext, token: string): Promise<ShareSpaceOverview> {
  return requestMall<ShareSpaceOverview>(context, token, 'GET', '/member/share-space/overview')
}

export async function fetchShareContentPage(
  context: MallContext, token: string, input: ShareContentQuery
): Promise<{ list: ShareContentItem[]; total: number }> {
  return requestMall<{ list: ShareContentItem[]; total: number }>(
    context, token, 'GET', `/member/share-content/page${query({
      scope: input.scope, folderId: input.folderId ?? undefined, contentType: input.contentType,
      keyword: input.keyword, pageNo: input.pageNo ?? 1, pageSize: input.pageSize ?? 200
    })}`)
}

export async function fetchShareContent(context: MallContext, token: string, id: number): Promise<ShareContentDetail> {
  return requestMall<ShareContentDetail>(context, token, 'GET',
    `/member/share-content/get${query({ id })}`, undefined, 32 * 1024 * 1024)
}

export async function fetchMyEnterpriseContentPage(
  context: MallContext, token: string, pageNo = 1, pageSize = 200
): Promise<{ list: ShareContentItem[]; total: number }> {
  return requestMall<{ list: ShareContentItem[]; total: number }>(
    context, token, 'GET', `/member/share-content/mine${query({ pageNo, pageSize })}`)
}

export async function createShareContent(
  context: MallContext, token: string,
  payload: { scope: number; folderId?: number | null; contentType: number; name: string; content: string; widthMm?: number; heightMm?: number; category?: string; keywords?: string }
): Promise<number> {
  const data = await requestMall<{ id?: number }>(context, token, 'POST', '/member/share-content/create', payload)
  return Number(data?.id ?? 0)
}

export async function updateShareContent(
  context: MallContext, token: string,
  payload: { id: number; scope: number; contentType: number; name: string; content?: string; widthMm?: number; heightMm?: number; category?: string; keywords?: string }
): Promise<void> {
  await requestMall<boolean>(context, token, 'PUT', '/member/share-content/update', payload)
}

export async function deleteShareContent(context: MallContext, token: string, id: number): Promise<void> {
  await requestMall<boolean>(context, token, 'DELETE', `/member/share-content/delete${query({ id })}`)
}

export async function uploadShareContent(
  context: MallContext, token: string,
  payload: { scope: number; folderId?: number | null; contentType: number; name: string; widthMm?: number; heightMm?: number; category?: string; keywords?: string },
  filePath: string
): Promise<number> {
  const { baseUrl, tenantId } = validateMallContext(context)
  const data = await readFile(filePath)
  const fields: Record<string, string> = {
    scope: String(payload.scope),
    contentType: String(payload.contentType),
    name: payload.name
  }
  if (payload.folderId != null) fields.folderId = String(payload.folderId)
  if (payload.widthMm != null) fields.widthMm = String(payload.widthMm)
  if (payload.heightMm != null) fields.heightMm = String(payload.heightMm)
  if (payload.category) fields.category = payload.category
  if (payload.keywords) fields.keywords = payload.keywords
  const response = await httpRequestMultipart(
    `${baseUrl}${API_PREFIX}/member/share-content/upload`,
    fields,
    { name: basename(filePath), type: guessMimeType(filePath), data },
    headersFor(tenantId, token),
    60000,
    32 * 1024 * 1024
  )
  const envelope = parseUploadEnvelope<{ id?: number }>(response.status, response.body)
  return Number(envelope?.id ?? 0)
}

export async function fetchShareFolders(context: MallContext, token: string): Promise<ShareFolderItem[]> {
  return requestMall<ShareFolderItem[]>(context, token, 'GET', '/member/share-folder/list')
}

export async function createShareFolder(context: MallContext, token: string, name: string): Promise<number> {
  const data = await requestMall<{ id?: number }>(context, token, 'POST', '/member/share-folder/create', { name })
  return Number(data?.id ?? 0)
}

export async function updateShareFolder(context: MallContext, token: string, id: number, name: string): Promise<void> {
  await requestMall<boolean>(context, token, 'PUT', '/member/share-folder/update', { id, name })
}

export async function deleteShareFolder(context: MallContext, token: string, id: number): Promise<void> {
  await requestMall<boolean>(context, token, 'DELETE', `/member/share-folder/delete${query({ id })}`)
}

export async function fetchShareFolderMembers(
  context: MallContext, token: string, folderId: number
): Promise<{ folderId: number; members: ShareFolderMember[] }> {
  return requestMall<{ folderId: number; members: ShareFolderMember[] }>(
    context, token, 'GET', `/member/share-folder/member-list${query({ folderId })}`)
}

export async function updateShareFolderMembers(
  context: MallContext, token: string, id: number, memberIds: number[]
): Promise<void> {
  await requestMall<boolean>(context, token, 'PUT', '/member/share-folder/update-members', { id, memberIds })
}

export async function fetchPlatformContentPage(
  context: MallContext, token: string,
  input: { keyword?: string; contentType?: number; category?: string; pageNo?: number; pageSize?: number }
): Promise<{ list: PlatformContentItem[]; total: number }> {
  return requestMall<{ list: PlatformContentItem[]; total: number }>(
    context, token, 'GET', `/member/platform-content/page${query({
      keyword: input.keyword, contentType: input.contentType, category: input.category,
      pageNo: input.pageNo ?? 1, pageSize: input.pageSize ?? 200
    })}`)
}

export async function fetchPlatformContent(
  context: MallContext, token: string, id: number
): Promise<PlatformContentDetail> {
  return requestMall<PlatformContentDetail>(context, token, 'GET',
    `/member/platform-content/get${query({ id })}`, undefined, 32 * 1024 * 1024)
}

function guessMimeType(filePath: string): string {
  const ext = filePath.toLowerCase().substring(filePath.lastIndexOf('.') + 1)
  if (['png'].includes(ext)) return 'image/png'
  if (['jpg', 'jpeg'].includes(ext)) return 'image/jpeg'
  if (ext === 'gif') return 'image/gif'
  if (ext === 'bmp') return 'image/bmp'
  if (ext === 'webp') return 'image/webp'
  if (ext === 'xls') return 'application/vnd.ms-excel'
  if (ext === 'xlsx') return 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  if (ext === 'csv') return 'text/csv'
  if (ext === 'txt') return 'text/plain'
  return 'application/octet-stream'
}

function parseUploadEnvelope<T>(status: number, body: string): T {
  let envelope: Envelope<T>
  try {
    envelope = JSON.parse(body) as Envelope<T>
  } catch {
    throw new MallApiError(-1, `商城返回了非 JSON 响应（HTTP ${status}）`, status)
  }
  if (status === 401) {
    throw new MallApiError(typeof envelope.code === 'number' ? envelope.code : 401,
      envelope.msg || '登录已过期', status)
  }
  if (envelope.code !== 0) {
    throw new MallApiError(typeof envelope.code === 'number' ? envelope.code : -1,
      envelope.msg || `商城请求失败（HTTP ${status}）`, status)
  }
  return envelope.data as T
}
