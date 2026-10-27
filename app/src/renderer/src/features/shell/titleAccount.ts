import type { MallMember } from '../../../../shared/ipcContract'

/**
 * 标题栏「登录状态」段显示的账号。
 *
 * 009 起客户端的主登录是商城会员（起始页左栏也用同一个 member 判定登录态），
 * 旧的云服务账号只在没有会员登录时兜底；两者都没有才返回 null，
 * 由 `composeWindowTitle` 显示「请登录 MaxLabel」。
 */
export function titleAccount(
  member: Pick<MallMember, 'mobileMasked'> | null | undefined,
  cloudEmail: string | null | undefined
): string | null {
  const mobile = String(member?.mobileMasked ?? '').trim()
  if (mobile) return mobile
  return String(cloudEmail ?? '').trim() || null
}
