import { describe, expect, it } from 'vitest'
import { titleAccount } from '@/features/shell/titleAccount'
import type { MallMember } from '@shared/ipcContract'

function member(overrides: Partial<MallMember> = {}): MallMember {
  return {
    userId: 1,
    mobileMasked: '180****5870',
    subscriptionActive: true,
    edition: 'enterprise',
    ...overrides
  }
}

/**
 * 013 现场回归：商城会员已登录，标题栏却仍显示「请登录 MaxLabel」。
 * 原因是标题一直取旧的云服务账号（cloudEmail），而 009 之后客户端的
 * 主登录已经换成商城会员。
 */
describe('标题栏登录状态段', () => {
  it('商城会员登录后显示会员账号', () => {
    expect(titleAccount(member(), null)).toBe('180****5870')
  })

  it('商城会员登录优先于旧的云服务账号', () => {
    expect(titleAccount(member(), 'user@example.com')).toBe('180****5870')
  })

  it('没有会员登录时回退到云服务账号', () => {
    expect(titleAccount(null, 'user@example.com')).toBe('user@example.com')
  })

  it('两者都没有时返回 null，交由标题拼装显示「请登录」', () => {
    expect(titleAccount(null, null)).toBeNull()
    expect(titleAccount(undefined, undefined)).toBeNull()
    expect(titleAccount({ mobileMasked: '   ' }, '   ')).toBeNull()
  })
})
