import type { MallContext, MallMember } from '../shared/ipcContract'
import {
  clearMallCredential,
  readMallCredential,
  saveMallCredential,
  type MallCredential,
  type MallTokens
} from './mallCredentials'
import {
  completeMallWechatProfile,
  fetchMallMember,
  fetchMallSubscription,
  loginMallWithPassword,
  loginMallWithSms,
  logoutMall,
  MallApiError,
  queryMallWechatScan,
  refreshMallTokens,
  validateMallContext
} from './mallRepository'
import { clearMallSession, syncMallSession } from './mallService'

const REFRESH_MARGIN_MS = 60 * 1000

function isUnauthorized(error: unknown): boolean {
  return error instanceof MallApiError && (error.status === 401 || error.code === 401)
}

async function buildMember(context: MallContext, tokens: MallTokens): Promise<MallMember> {
  const profile = await fetchMallMember(context, tokens.accessToken)
  if (!profile.userId) throw new MallApiError(-1, '商城返回的会员信息不完整')
  const subscription = await fetchMallSubscription(context, tokens.accessToken)
  const edition = subscription.edition ?? profile.edition
  const activeEditions = subscription.activeEditions ?? profile.activeEditions
  return {
    userId: profile.userId,
    mobileMasked: profile.mobileMasked,
    ...(profile.nickname ? { nickname: profile.nickname } : {}),
    ...(profile.companyName ? { companyName: profile.companyName } : {}),
    ...(profile.avatarUrl ? { avatarUrl: profile.avatarUrl } : {}),
    ...(edition ? { edition } : {}),
    ...(activeEditions?.length ? { activeEditions } : {}),
    subscriptionActive: subscription.subscriptionActive === true,
    ...(subscription.subscriptionSource
      ? { subscriptionSource: subscription.subscriptionSource }
      : {}),
    ...(subscription.orgName ? { orgName: subscription.orgName } : {}),
    subscriptionEndDate: subscription.subscriptionEndDate ?? null,
    subscriptionEndTime: subscription.subscriptionEndTime ?? null,
    remainingDays: subscription.remainingDays ?? 0,
    periodMonths: subscription.periodMonths ?? null,
    sourceOrderNo: subscription.sourceOrderNo ?? null
  }
}

async function refreshAndSave(context: MallContext, credential: MallCredential): Promise<MallTokens> {
  const { baseUrl } = validateMallContext(context)
  const tokens = await refreshMallTokens(context, credential.tokens.refreshToken)
  await saveMallCredential(baseUrl, tokens, credential.member)
  syncMallSession(context, tokens)
  return tokens
}

async function freshTokens(context: MallContext, credential: MallCredential): Promise<MallTokens> {
  if (credential.tokens.expiresTime > Date.now() + REFRESH_MARGIN_MS) {
    return credential.tokens
  }
  return refreshAndSave(context, credential)
}

/** 任意登录方式拿到令牌后的共同收尾：补全会员快照、落盘、同步商城窗口。 */
async function finishMallLogin(context: MallContext, tokens: MallTokens): Promise<MallMember> {
  const { baseUrl } = validateMallContext(context)
  const member = await buildMember(context, tokens)
  await saveMallCredential(baseUrl, tokens, member)
  syncMallSession(context, tokens, { reload: true })
  return member
}

export async function loginMallUsingPassword(
  context: MallContext,
  mobile: string,
  password: string
): Promise<MallMember> {
  const tokens = await loginMallWithPassword(context, mobile, password)
  return finishMallLogin(context, tokens)
}

export async function loginMallUsingSms(
  context: MallContext,
  mobile: string,
  code: string
): Promise<MallMember> {
  const tokens = await loginMallWithSms(context, mobile, code)
  return finishMallLogin(context, tokens)
}

export type MallWechatLoginState =
  | { status: 'completed'; member: MallMember }
  | { status: 'need-profile'; nickname?: string }
  | { status: 'expired' }
  | { status: 'pending' }

/**
 * 轮询微信扫码结果。店面把“扫码完成”“待补全手机号”“过期/作废”编码在
 * status 中文字符串里；这里只暴露桌面端需要的四种状态。
 */
export async function queryMallWechatLogin(
  context: MallContext,
  ticket: string
): Promise<MallWechatLoginState> {
  const state = await queryMallWechatScan(context, ticket)
  if (state.status === '已完成') {
    if (
      typeof state.accessToken !== 'string' || !state.accessToken
      || typeof state.refreshToken !== 'string' || !state.refreshToken
    ) {
      throw new Error('商城返回的登录令牌不完整')
    }
    const member = await finishMallLogin(context, {
      accessToken: state.accessToken,
      refreshToken: state.refreshToken,
      expiresTime: typeof state.expiresTime === 'number'
        ? state.expiresTime
        : Date.now() + 25 * 60 * 1000
    })
    return { status: 'completed', member }
  }
  if (state.status === '待补全') {
    return {
      status: 'need-profile',
      ...(state.wxNickname ? { nickname: state.wxNickname } : {})
    }
  }
  if (state.status === '已过期' || state.status === '已作废') return { status: 'expired' }
  return { status: 'pending' }
}

/** 微信首次登录补全手机号；服务端直接下发令牌时立即完成登录。 */
export async function completeMallWechatLogin(
  context: MallContext,
  payload: { ticket: string; mobile: string; code: string; company?: string }
): Promise<MallMember | null> {
  const tokens = await completeMallWechatProfile(context, payload)
  return tokens ? finishMallLogin(context, tokens) : null
}

export async function readMallSession(context: MallContext): Promise<MallMember | null> {
  const { baseUrl } = validateMallContext(context)
  const credential = await readMallCredential(baseUrl)
  if (!credential) return null
  let tokens: MallTokens
  try {
    tokens = await freshTokens(context, credential)
  } catch (error) {
    // 令牌刷新失败要区分“服务端拒绝”和“网络不可达”：
    // 前者会话失效；后者保留凭据，离线时继续使用最近一次成功校验的会员快照。
    if (isUnauthorized(error)) {
      await clearMallCredential(baseUrl)
      return null
    }
    return credential.member
  }
  try {
    const member = await buildMember(context, tokens)
    await saveMallCredential(baseUrl, tokens, member)
    return member
  } catch (error) {
    if (!isUnauthorized(error)) {
      // 网络/服务不可达：保留凭据与会员快照，供离线授权使用。
      return credential.member
    }
    try {
      const credentialAgain = await readMallCredential(baseUrl)
      if (!credentialAgain) return null
      const tokens = await refreshAndSave(context, credentialAgain)
      const member = await buildMember(context, tokens)
      await saveMallCredential(baseUrl, tokens, member)
      return member
    } catch (retryError) {
      if (isUnauthorized(retryError)) await clearMallCredential(baseUrl)
      return null
    }
  }
}

export async function logoutMallAccount(context: MallContext): Promise<void> {
  const { baseUrl } = validateMallContext(context)
  const credential = await readMallCredential(baseUrl)
  if (credential) {
    try {
      await logoutMall(context, credential.tokens.accessToken)
    } catch {
      // 本地注销必须成功，即使服务端已经过期/不可达。
    }
  }
  await clearMallCredential(baseUrl)
  await clearMallSession(context)
}

/**
 * 用当前登录态执行一次商城调用：自动刷新过期令牌，401 时刷新后重试一次。
 */
export async function withMallToken<T>(
  context: MallContext,
  run: (token: string) => Promise<T>
): Promise<T> {
  const { baseUrl } = validateMallContext(context)
  const credential = await readMallCredential(baseUrl)
  if (!credential) throw new MallApiError(401, '请先登录商城会员账号')
  let tokens = await freshTokens(context, credential)
  try {
    return await run(tokens.accessToken)
  } catch (error) {
    if (!(error instanceof MallApiError) || (error.status !== 401 && error.code !== 401)) throw error
    const latest = await readMallCredential(baseUrl)
    if (!latest) throw new MallApiError(401, '登录已过期，请重新登录')
    tokens = await refreshAndSave(context, latest)
    return run(tokens.accessToken)
  }
}
