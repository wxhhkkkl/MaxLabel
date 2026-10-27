import { describe, expect, it } from 'vitest'
import { statusText } from '@/dialogs/MallAccountDialog'
import type { MallMember } from '@shared/ipcContract'

function member(overrides: Partial<MallMember> = {}): MallMember {
  return {
    userId: 1,
    mobileMasked: '138****0000',
    subscriptionActive: true,
    edition: 'enterprise',
    subscriptionEndDate: '2027-10-26',
    remainingDays: 365,
    ...overrides
  }
}

describe('mall account dialog subscription status', () => {
  it('shows the organisation name for enterprise licences', () => {
    const text = statusText(
      member({ subscriptionSource: 'enterprise', orgName: '北京杏林康云' })
    )
    expect(text).toContain('企业授权（北京杏林康云）')
    expect(text).toContain('2027-10-26')
    expect(text).toContain('365')
  })

  it('keeps the personal wording when the source is personal', () => {
    const text = statusText(
      member({ subscriptionSource: 'personal', orgName: '北京杏林康云' })
    )
    expect(text).not.toContain('企业授权')
    expect(text).toBe('有效，到期 2027-10-26（剩余 365 天）')
  })

  it('omits the enterprise prefix when the organisation name is missing', () => {
    const text = statusText(member({ subscriptionSource: 'enterprise' }))
    expect(text).not.toContain('企业授权')
    expect(text).toBe('有效，到期 2027-10-26（剩余 365 天）')
  })

  it('marks an expired enterprise licence', () => {
    const text = statusText(
      member({
        subscriptionActive: false,
        subscriptionSource: 'enterprise',
        orgName: '北京杏林康云'
      })
    )
    expect(text).toBe('企业授权（北京杏林康云）；已过期（2027-10-26）')
  })

  it('shows the signed-out state without inventing member data', () => {
    expect(statusText(null)).toBe('未登录')
  })
})
