import { app, ipcMain as electronIpcMain } from 'electron'
import { readFile } from 'node:fs/promises'
import type { BrowserWindow } from 'electron'
import type { MallContext, MallLoginPayload, MallMember } from '../../shared/ipcContract'
import { isEdition, isEnterpriseAdminRole } from '../../shared/domain/entitlement'
import {
  completeMallWechatLogin,
  loginMallUsingPassword,
  loginMallUsingSms,
  logoutMallAccount,
  queryMallWechatLogin,
  readMallSession,
  withMallToken
} from '../mallAuth'
import {
  abandonMallWechatScan,
  createMallWechatScan,
  createShareContent,
  createShareFolder,
  deleteMallTemplate,
  deleteShareContent,
  deleteShareFolder,
  fetchMallCaptcha,
  fetchMallOrgRole,
  fetchMallPlans,
  isMallCaptchaEnabled,
  fetchMallSharedTemplate,
  fetchMallSharedTemplates,
  fetchMallTemplate,
  fetchMallTemplates,
  fetchPlatformContent,
  fetchPlatformContentPage,
  fetchMyEnterpriseContentPage,
  fetchShareContent,
  fetchShareContentPage,
  fetchShareFolders,
  fetchShareFolderMembers,
  fetchShareOverview,
  saveMallTemplate,
  sendMallSmsCode,
  updateShareContent,
  updateShareFolder,
  updateShareFolderMembers,
  uploadShareContent,
  validateMallContext,
  verifyMallCaptcha
} from '../mallRepository'
import { clearMallCaptcha, rememberMallCaptcha, takeMallCaptchaSecret } from '../mallCaptcha'
import { openMallWindow, syncMallSession } from '../mallService'
import { readMallCredential } from '../mallCredentials'
import { getEntitlementState, refreshEntitlementMember } from '../entitlementService'
import { validateTemplateJson } from './validation'
import { assertKnownIpcChannel, secureIpcHandler } from './senderGuard'

const READ_ONLY_MESSAGE = '当前为只读状态：请登录有效会员或插入授权加密狗'

function assertEditable(): void {
  if (getEntitlementState().editable) return
  const error = new Error(READ_ONLY_MESSAGE) as Error & { messageKey?: string }
  error.messageKey = 'error.entitlementReadOnly'
  throw error
}

function normalizeTestMember(parsed: Partial<MallMember> | null): MallMember | null {
  if (!parsed || typeof parsed !== 'object' || typeof parsed.mobileMasked !== 'string' || !parsed.mobileMasked) return null
  return {
    userId: Number(parsed.userId ?? 1),
    mobileMasked: parsed.mobileMasked,
    ...(typeof parsed.nickname === 'string' ? { nickname: parsed.nickname } : {}),
    ...(typeof parsed.companyName === 'string' ? { companyName: parsed.companyName } : {}),
    ...(typeof parsed.avatarUrl === 'string' ? { avatarUrl: parsed.avatarUrl } : {}),
    ...(isEdition(parsed.edition) ? { edition: parsed.edition } : {}),
    subscriptionActive: parsed.subscriptionActive === true,
    ...(parsed.subscriptionSource ? { subscriptionSource: parsed.subscriptionSource } : {}),
    ...(typeof parsed.orgName === 'string' && parsed.orgName ? { orgName: parsed.orgName } : {}),
    ...(parsed.subscriptionEndTime ? { subscriptionEndTime: parsed.subscriptionEndTime } : {}),
    ...(parsed.subscriptionEndDate ? { subscriptionEndDate: parsed.subscriptionEndDate } : {})
  }
}

/** 仅测试：非打包构建可用固定会员（环境变量或文件）模拟登录态。 */
async function testMallMember(): Promise<MallMember | null> {
  if (app.isPackaged) return null
  const raw = process.env.MAXLABEL_TEST_MALL_MEMBER?.trim()
  if (raw) {
    try { return normalizeTestMember(JSON.parse(raw) as Partial<MallMember>) } catch { return null }
  }
  const file = process.env.MAXLABEL_TEST_MALL_MEMBER_FILE?.trim()
  if (!file) return null
  try { return normalizeTestMember(JSON.parse(await readFile(file, 'utf8')) as Partial<MallMember>) } catch { return null }
}

/** 仅测试：非打包构建可用环境变量模拟企业角色，避免 E2E 依赖真实账号。 */
function testEnterpriseRole(): number | null {
  if (app.isPackaged) return null
  const raw = process.env.MAXLABEL_TEST_ENTERPRISE_ROLE?.trim()
  if (!raw) return null
  const role = Number(raw)
  return Number.isInteger(role) ? role : null
}

function asContext(value: unknown): MallContext {
  if (!value || typeof value !== 'object') throw new Error('商城配置无效')
  const context = value as Partial<MallContext>
  validateMallContext({ baseUrl: String(context.baseUrl ?? ''), tenantId: Number(context.tenantId ?? 0) })
  return { baseUrl: String(context.baseUrl), tenantId: Number(context.tenantId) }
}

function asId(value: unknown): number {
  const id = Number(value)
  if (!Number.isInteger(id) || id <= 0) throw new Error('模板编号无效')
  return id
}

function asMobile(value: unknown): string {
  const mobile = String(value ?? '').trim()
  if (!/^1[3-9]\d{9}$/.test(mobile)) throw new Error('手机号格式不正确')
  return mobile
}

function asPassword(value: unknown): string {
  const password = typeof value === 'string' ? value : ''
  if (!password || password.length > 128) throw new Error('密码无效')
  return password
}

function asSmsCode(value: unknown): string {
  const code = String(value ?? '').trim()
  if (!/^\d{4,8}$/.test(code)) throw new Error('短信验证码无效')
  return code
}

function asLoginPayload(value: unknown): MallLoginPayload {
  if (!value || typeof value !== 'object') throw new Error('登录参数无效')
  const input = value as Record<string, unknown>
  if (input.method === 'password') {
    return { method: 'password', mobile: asMobile(input.mobile), password: asPassword(input.password) }
  }
  if (input.method === 'sms') {
    return { method: 'sms', mobile: asMobile(input.mobile), code: asSmsCode(input.code) }
  }
  throw new Error('不支持的登录方式')
}

function asTicket(value: unknown): string {
  const ticket = String(value ?? '').trim()
  if (!/^[A-Za-z0-9_-]{8,128}$/.test(ticket)) throw new Error('登录票据无效')
  return ticket
}

function asCaptchaToken(value: unknown): string {
  const token = String(value ?? '').trim()
  if (!/^[A-Za-z0-9_-]{8,128}$/.test(token)) throw new Error('验证码标识无效')
  return token
}

function asCaptchaX(value: unknown): number {
  const x = Number(value)
  if (!Number.isInteger(x) || x < 0 || x > 400) throw new Error('验证码坐标无效')
  return x
}

function asCaptchaVerification(value: unknown): string | undefined {
  if (value === undefined || value === null || value === '') return undefined
  if (typeof value !== 'string' || value.length > 2048) throw new Error('验证码凭证无效')
  return value
}

function asCompany(value: unknown): string | undefined {
  if (value === undefined || value === null || value === '') return undefined
  const company = String(value).trim()
  if (company.length > 64) throw new Error('公司名称过长')
  return company || undefined
}

function asName(value: unknown): string {
  const name = String(value ?? '').trim()
  if (!name || name.length > 255) throw new Error('模板名称无效')
  return name
}

function asOptionalText(value: unknown, max: number): string | undefined {
  if (value === undefined || value === null) return undefined
  const text = String(value).trim()
  if (text.length > max) throw new Error('字段长度超限')
  return text
}

function asOptionalNumber(value: unknown, max: number): number | undefined {
  if (value === undefined || value === null || value === '') return undefined
  const number = Number(value)
  if (!Number.isFinite(number) || number < 0 || number > max) throw new Error('尺寸字段无效')
  return number
}

/** 注册 MaxLabelMall 会员登录、云端模板、共享模板与商城窗口 IPC。 */
export function registerMallIpc(getWindow: () => BrowserWindow | null): void {
  const secureHandle = (channel: string, handler: Parameters<typeof electronIpcMain.handle>[1]) => {
    assertKnownIpcChannel(channel)
    return electronIpcMain.handle(channel, secureIpcHandler(getWindow, handler as never) as never)
  }
  const ipcMain = { handle: secureHandle }
  const fail = (error: unknown) => {
    const messageKey = (error as { messageKey?: unknown })?.messageKey
    return {
      ok: false,
      error: String((error as { message?: string }).message ?? error),
      messageKey: typeof messageKey === 'string' && messageKey ? messageKey : 'error.mall'
    }
  }

  ipcMain.handle('mall:login', async (_e, context: unknown, payload: unknown) => {
    try {
      const fake = await testMallMember()
      if (fake) {
        refreshEntitlementMember(fake)
        return { ok: true, member: fake }
      }
      const input = asLoginPayload(payload)
      const ctx = asContext(context)
      const member = input.method === 'password'
        ? await loginMallUsingPassword(ctx, input.mobile, input.password)
        : await loginMallUsingSms(ctx, input.mobile, input.code)
      refreshEntitlementMember(member)
      return { ok: true, member }
    } catch (error) { return fail(error) }
  })
  ipcMain.handle('mall:logout', async (_e, context: unknown) => {
    try {
      if (await testMallMember()) {
        refreshEntitlementMember(null)
        return { ok: true }
      }
      await logoutMallAccount(asContext(context))
      clearMallCaptcha()
      refreshEntitlementMember(null)
      return { ok: true }
    } catch (error) { return fail(error) }
  })
  ipcMain.handle('mall:sms-send', async (_e, context: unknown, mobile: unknown, captchaVerification: unknown) => {
    try {
      await sendMallSmsCode(asContext(context), asMobile(mobile), asCaptchaVerification(captchaVerification))
      return { ok: true }
    } catch (error) { return fail(error) }
  })
  ipcMain.handle('mall:captcha-enabled', async (_e, context: unknown) => {
    try {
      return { ok: true, enabled: await isMallCaptchaEnabled(asContext(context)) }
    } catch (error) { return fail(error) }
  })
  ipcMain.handle('mall:captcha-get', async (_e, context: unknown) => {
    try {
      const challenge = await fetchMallCaptcha(asContext(context))
      rememberMallCaptcha(challenge.token, challenge.secretKey)
      return {
        ok: true,
        captcha: {
          token: challenge.token,
          originalImageBase64: challenge.originalImageBase64,
          jigsawImageBase64: challenge.jigsawImageBase64
        }
      }
    } catch (error) { return fail(error) }
  })
  ipcMain.handle('mall:captcha-check', async (_e, context: unknown, token: unknown, x: unknown) => {
    try {
      const ctx = asContext(context)
      const captchaToken = asCaptchaToken(token)
      const secretKey = takeMallCaptchaSecret(captchaToken)
      if (!secretKey) throw new Error('验证码已过期，请刷新后重试')
      const result = await verifyMallCaptcha(ctx, captchaToken, secretKey, asCaptchaX(x))
      if (!result.success || !result.captchaVerification) {
        return { ok: false, error: '验证不通过，请重试' }
      }
      return { ok: true, captchaVerification: result.captchaVerification }
    } catch (error) { return fail(error) }
  })
  ipcMain.handle('mall:wechat-create', async (_e, context: unknown) => {
    try {
      return { ok: true, scan: await createMallWechatScan(asContext(context)) }
    } catch (error) { return fail(error) }
  })
  ipcMain.handle('mall:wechat-query', async (_e, context: unknown, ticket: unknown) => {
    try {
      const state = await queryMallWechatLogin(asContext(context), asTicket(ticket))
      if (state.status === 'completed') refreshEntitlementMember(state.member)
      return { ok: true, state }
    } catch (error) { return fail(error) }
  })
  ipcMain.handle('mall:wechat-complete', async (_e, context: unknown, payload: unknown) => {
    try {
      if (!payload || typeof payload !== 'object') throw new Error('补全资料参数无效')
      const input = payload as Record<string, unknown>
      const company = asCompany(input.company)
      const member = await completeMallWechatLogin(asContext(context), {
        ticket: asTicket(input.ticket),
        mobile: asMobile(input.mobile),
        code: asSmsCode(input.code),
        ...(company ? { company } : {})
      })
      if (!member) return { ok: true, pending: true }
      refreshEntitlementMember(member)
      return { ok: true, member }
    } catch (error) { return fail(error) }
  })
  ipcMain.handle('mall:wechat-abandon', async (_e, context: unknown, ticket: unknown) => {
    try {
      await abandonMallWechatScan(asContext(context), asTicket(ticket))
    } catch {
      // 放弃扫码只是清理服务端票据；失败不影响本地关闭弹窗。
    }
    return { ok: true }
  })
  ipcMain.handle('mall:session', async (_e, context: unknown) => {
    try {
      const fake = await testMallMember()
      if (fake) {
        refreshEntitlementMember(fake)
        return { ok: true, member: fake }
      }
      const member = await readMallSession(asContext(context))
      refreshEntitlementMember(member ?? null)
      return member ? { ok: true, member } : { ok: true }
    } catch (error) { return fail(error) }
  })
  ipcMain.handle('mall:open', async (_e, context: unknown, path?: string) => {
    try {
      const ctx = asContext(context)
      const target = typeof path === 'string' && path.startsWith('/') ? path.slice(0, 512) : '/'
      // 软件内登录后商城窗口可能才打开：先用已保存的令牌播种，店面首屏即按登录态渲染。
      const credential = await readMallCredential(ctx.baseUrl).catch(() => null)
      if (credential) syncMallSession(ctx, credential.tokens)
      openMallWindow(ctx, target)
      return { ok: true, url: `${ctx.baseUrl}${target}` }
    } catch (error) { return fail(error) }
  })
  ipcMain.handle('mall:plans', async (_e, context: unknown) => {
    try { return { ok: true, plans: await fetchMallPlans(asContext(context)) } } catch (error) { return fail(error) }
  })
  ipcMain.handle('mall:enterprise-role', async (_e, context: unknown) => {
    try {
      const fake = testEnterpriseRole()
      if (fake !== null) return { ok: true, role: fake, isAdmin: isEnterpriseAdminRole(fake) }
      const ctx = asContext(context)
      const role = await withMallToken(ctx, (token) => fetchMallOrgRole(ctx, token))
      return { ok: true, ...(role !== null ? { role } : {}), isAdmin: isEnterpriseAdminRole(role) }
    } catch (error) { return fail(error) }
  })
  ipcMain.handle('mall:template-list', async (_e, context: unknown, keyword?: unknown) => {
    try {
      const ctx = asContext(context)
      const items = await withMallToken(ctx, (token) =>
        fetchMallTemplates(ctx, token, asOptionalText(keyword, 255)))
      return { ok: true, items }
    } catch (error) { return fail(error) }
  })
  ipcMain.handle('mall:template-load', async (_e, context: unknown, id: unknown) => {
    try {
      const ctx = asContext(context)
      const item = await withMallToken(ctx, (token) => fetchMallTemplate(ctx, token, asId(id)))
      return { ok: true, item }
    } catch (error) { return fail(error) }
  })
  ipcMain.handle('mall:template-save', async (_e, context: unknown, payload: unknown) => {
    try {
      assertEditable()
      const ctx = asContext(context)
      if (!payload || typeof payload !== 'object') throw new Error('模板载荷无效')
      const input = payload as Record<string, unknown>
      const name = asName(input.name)
      const content = validateTemplateJson(input.content)
      const widthMm = asOptionalNumber(input.widthMm, 10000)
      const heightMm = asOptionalNumber(input.heightMm, 10000)
      const category = asOptionalText(input.category, 64)
      const keywords = asOptionalText(input.keywords, 255)
      const id = input.id === undefined || input.id === null || input.id === '' ? undefined : asId(input.id)
      const savedId = await withMallToken(ctx, (token) => saveMallTemplate(ctx, token, {
        id, name, content, widthMm, heightMm, category, keywords
      }))
      return { ok: true, id: savedId }
    } catch (error) { return fail(error) }
  })
  ipcMain.handle('mall:template-delete', async (_e, context: unknown, id: unknown) => {
    try {
      assertEditable()
      const ctx = asContext(context)
      await withMallToken(ctx, (token) => deleteMallTemplate(ctx, token, asId(id)))
      return { ok: true }
    } catch (error) { return fail(error) }
  })
  ipcMain.handle('mall:shared-list', async (_e, context: unknown, keyword?: unknown, category?: unknown) => {
    try {
      const ctx = asContext(context)
      const items = await withMallToken(ctx, (token) => fetchMallSharedTemplates(
        ctx, token, asOptionalText(keyword, 255), asOptionalText(category, 64)))
      return { ok: true, items }
    } catch (error) { return fail(error) }
  })
  ipcMain.handle('mall:shared-load', async (_e, context: unknown, id: unknown) => {
    try {
      const ctx = asContext(context)
      const item = await withMallToken(ctx, (token) => fetchMallSharedTemplate(ctx, token, asId(id)))
      return { ok: true, item }
    } catch (error) { return fail(error) }
  })

  // ======================= 共享内容空间（016） =======================
  ipcMain.handle('share:overview', async (_e, context: unknown) => {
    try {
      const ctx = asContext(context)
      const overview = await withMallToken(ctx, (token) => fetchShareOverview(ctx, token))
      return { ok: true, overview }
    } catch (error) { return fail(error) }
  })
  ipcMain.handle('share:content-page', async (_e, context: unknown, input: unknown) => {
    try {
      const ctx = asContext(context)
      const q = (input ?? {}) as Record<string, unknown>
      const data = await withMallToken(ctx, (token) => fetchShareContentPage(ctx, token, {
        scope: Number(q.scope),
        folderId: q.folderId == null || q.folderId === '' ? undefined : Number(q.folderId),
        contentType: q.contentType == null || q.contentType === '' ? undefined : Number(q.contentType),
        keyword: asOptionalText(q.keyword, 255),
        pageNo: q.pageNo == null ? 1 : Number(q.pageNo),
        pageSize: q.pageSize == null ? 200 : Number(q.pageSize)
      }))
      return { ok: true, items: data.list, total: data.total }
    } catch (error) { return fail(error) }
  })
  ipcMain.handle('share:content-get', async (_e, context: unknown, id: unknown) => {
    try {
      const ctx = asContext(context)
      const item = await withMallToken(ctx, (token) => fetchShareContent(ctx, token, asId(id)))
      return { ok: true, item }
    } catch (error) { return fail(error) }
  })
  ipcMain.handle('share:content-create', async (_e, context: unknown, payload: unknown) => {
    try {
      const ctx = asContext(context)
      const input = payload as Record<string, unknown>
      const id = await withMallToken(ctx, (token) => createShareContent(ctx, token, {
        scope: Number(input.scope),
        folderId: input.folderId == null || input.folderId === '' ? undefined : Number(input.folderId),
        contentType: Number(input.contentType),
        name: asName(input.name),
        content: String(input.content ?? ''),
        widthMm: asOptionalNumber(input.widthMm, 10000),
        heightMm: asOptionalNumber(input.heightMm, 10000),
        category: asOptionalText(input.category, 64),
        keywords: asOptionalText(input.keywords, 255)
      }))
      return { ok: true, id }
    } catch (error) { return fail(error) }
  })
  ipcMain.handle('share:content-upload', async (_e, context: unknown, payload: unknown, filePath: unknown) => {
    try {
      const ctx = asContext(context)
      if (typeof filePath !== 'string' || !filePath) throw new Error('未选择文件')
      const input = payload as Record<string, unknown>
      const id = await withMallToken(ctx, (token) => uploadShareContent(ctx, token, {
        scope: Number(input.scope),
        folderId: input.folderId == null || input.folderId === '' ? undefined : Number(input.folderId),
        contentType: Number(input.contentType),
        name: asName(input.name),
        widthMm: asOptionalNumber(input.widthMm, 10000),
        heightMm: asOptionalNumber(input.heightMm, 10000),
        category: asOptionalText(input.category, 64),
        keywords: asOptionalText(input.keywords, 255)
      }, filePath))
      return { ok: true, id }
    } catch (error) { return fail(error) }
  })
  ipcMain.handle('share:content-update', async (_e, context: unknown, payload: unknown) => {
    try {
      const ctx = asContext(context)
      const input = payload as Record<string, unknown>
      await withMallToken(ctx, (token) => updateShareContent(ctx, token, {
        id: asId(input.id),
        scope: Number(input.scope),
        contentType: Number(input.contentType),
        name: asName(input.name),
        content: input.content == null ? undefined : String(input.content),
        widthMm: asOptionalNumber(input.widthMm, 10000),
        heightMm: asOptionalNumber(input.heightMm, 10000),
        category: asOptionalText(input.category, 64),
        keywords: asOptionalText(input.keywords, 255)
      }))
      return { ok: true }
    } catch (error) { return fail(error) }
  })
  ipcMain.handle('share:content-delete', async (_e, context: unknown, id: unknown) => {
    try {
      const ctx = asContext(context)
      await withMallToken(ctx, (token) => deleteShareContent(ctx, token, asId(id)))
      return { ok: true }
    } catch (error) { return fail(error) }
  })
  ipcMain.handle('share:content-mine', async (_e, context: unknown, pageNo?: unknown, pageSize?: unknown) => {
    try {
      const ctx = asContext(context)
      const data = await withMallToken(ctx, (token) => fetchMyEnterpriseContentPage(
        ctx, token, pageNo == null ? 1 : Number(pageNo), pageSize == null ? 200 : Number(pageSize)))
      return { ok: true, items: data.list, total: data.total }
    } catch (error) { return fail(error) }
  })
  ipcMain.handle('share:folder-list', async (_e, context: unknown) => {
    try {
      const ctx = asContext(context)
      const items = await withMallToken(ctx, (token) => fetchShareFolders(ctx, token))
      return { ok: true, items }
    } catch (error) { return fail(error) }
  })
  ipcMain.handle('share:folder-create', async (_e, context: unknown, name: unknown) => {
    try {
      const ctx = asContext(context)
      const id = await withMallToken(ctx, (token) => createShareFolder(ctx, token, asName(name)))
      return { ok: true, id }
    } catch (error) { return fail(error) }
  })
  ipcMain.handle('share:folder-update', async (_e, context: unknown, id: unknown, name: unknown) => {
    try {
      const ctx = asContext(context)
      await withMallToken(ctx, (token) => updateShareFolder(ctx, token, asId(id), asName(name)))
      return { ok: true }
    } catch (error) { return fail(error) }
  })
  ipcMain.handle('share:folder-delete', async (_e, context: unknown, id: unknown) => {
    try {
      const ctx = asContext(context)
      await withMallToken(ctx, (token) => deleteShareFolder(ctx, token, asId(id)))
      return { ok: true }
    } catch (error) { return fail(error) }
  })
  ipcMain.handle('share:folder-members', async (_e, context: unknown, folderId: unknown) => {
    try {
      const ctx = asContext(context)
      const data = await withMallToken(ctx, (token) => fetchShareFolderMembers(ctx, token, asId(folderId)))
      return { ok: true, members: data.members }
    } catch (error) { return fail(error) }
  })
  ipcMain.handle('share:folder-update-members', async (_e, context: unknown, id: unknown, memberIds: unknown) => {
    try {
      const ctx = asContext(context)
      if (!Array.isArray(memberIds)) throw new Error('可见成员无效')
      await withMallToken(ctx, (token) => updateShareFolderMembers(ctx, token, asId(id), memberIds.map((value) => asId(value))))
      return { ok: true }
    } catch (error) { return fail(error) }
  })
  ipcMain.handle('share:platform-page', async (_e, context: unknown, input: unknown) => {
    try {
      const ctx = asContext(context)
      const q = (input ?? {}) as Record<string, unknown>
      const data = await withMallToken(ctx, (token) => fetchPlatformContentPage(ctx, token, {
        keyword: asOptionalText(q.keyword, 255),
        contentType: q.contentType == null || q.contentType === '' ? undefined : Number(q.contentType),
        category: asOptionalText(q.category, 64),
        pageNo: q.pageNo == null ? 1 : Number(q.pageNo),
        pageSize: q.pageSize == null ? 200 : Number(q.pageSize)
      }))
      return { ok: true, items: data.list, total: data.total }
    } catch (error) { return fail(error) }
  })
  ipcMain.handle('share:platform-get', async (_e, context: unknown, id: unknown) => {
    try {
      const ctx = asContext(context)
      const item = await withMallToken(ctx, (token) => fetchPlatformContent(ctx, token, asId(id)))
      return { ok: true, item }
    } catch (error) { return fail(error) }
  })
}
