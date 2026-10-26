import type { EntitlementState } from '../../../../shared/domain/entitlement'
import type { MallMember } from '../../../../shared/ipcContract'

export interface ProfileFields {
  loggedIn: boolean
  avatarUrl?: string
  mobile: string
  company: string
  editionLabel: string
  /** 企业来源时的「企业授权 · 企业名」；个人订阅与未登录为 undefined。 */
  enterpriseSource?: string
  subscriptionActive: boolean
  expiresAt: string | null
}

/** 起始页左栏与登录态/授权状态的纯映射，便于单测且不依赖 React。 */
export function profileFields(member: MallMember | null | undefined, entitlement: EntitlementState): ProfileFields {
  const orgName = String(member?.orgName ?? '').trim()
  const enterpriseSource = member?.subscriptionSource === 'enterprise' && orgName
    ? `企业授权 · ${orgName}`
    : undefined
  return {
    loggedIn: Boolean(member),
    ...(member?.avatarUrl ? { avatarUrl: member.avatarUrl } : {}),
    mobile: member?.mobileMasked ?? '',
    company: String(member?.companyName ?? '').trim(),
    editionLabel: entitlement.editionLabel,
    ...(enterpriseSource ? { enterpriseSource } : {}),
    subscriptionActive: member?.subscriptionActive === true,
    expiresAt: member?.subscriptionEndTime ?? member?.subscriptionEndDate ?? null
  }
}

/** 右栏云模板区域的数据来源：登录后看“我的”，未登录看公共库。 */
export function cloudScope(member: MallMember | null | undefined): 'mine' | 'public' {
  return member ? 'mine' : 'public'
}

export type CloudSectionState = 'loading' | 'error' | 'empty' | 'list'

/** 云模板区域的互斥展示状态：加载中 > 错误 > 空态 > 列表。 */
export function cloudSectionState(busy: boolean, error: string, count: number): CloudSectionState {
  if (busy) return 'loading'
  if (error) return 'error'
  return count > 0 ? 'list' : 'empty'
}
