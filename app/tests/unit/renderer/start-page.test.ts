import { describe, expect, it } from 'vitest'
import { cloudScope, cloudSectionState, profileFields } from '@/pages/start/profile'
import { FEATURE_MATRIX, resolveEntitlement, type EntitlementState } from '@shared/domain/entitlement'
import type { MallMember } from '@shared/ipcContract'

const absentDongle = { present: false, valid: false, checkedAt: '2026-10-23T00:00:00.000Z' }

function member(overrides: Partial<MallMember> = {}): MallMember {
  return {
    userId: 1,
    mobileMasked: '138****0000',
    companyName: '测试公司',
    subscriptionActive: true,
    edition: 'standard',
    subscriptionEndTime: '2099-01-01T00:00:00.000Z',
    ...overrides
  }
}

const standard: EntitlementState = resolveEntitlement({
  member: member(),
  dongle: absentDongle
})

describe('start page profile fields', () => {
  it('maps member fields and falls back when the profile is incomplete', () => {
    expect(profileFields(member(), standard)).toMatchObject({
      loggedIn: true,
      mobile: '138****0000',
      company: '测试公司',
      editionLabel: '标准版',
      subscriptionActive: true
    })
    const incomplete = profileFields(member({ companyName: undefined, avatarUrl: undefined }), standard)
    expect(incomplete.company).toBe('')
    expect(incomplete.avatarUrl).toBeUndefined()
  })

  it('shows the signed-out state without inventing member data', () => {
    const readonly = resolveEntitlement({ member: null, dongle: absentDongle })
    expect(profileFields(null, readonly)).toMatchObject({
      loggedIn: false,
      mobile: '',
      company: '',
      editionLabel: '未订阅',
      subscriptionActive: false
    })
  })

  it('shows the dongle label when only a dongle is present', () => {
    const dongle = resolveEntitlement({ member: null, dongle: { present: true, valid: true, checkedAt: '' } })
    expect(profileFields(null, dongle).editionLabel).toBe('加密狗（全部功能）')
  })

  it('shows the enterprise source and company for a seat member', () => {
    const seat = member({
      edition: 'enterprise',
      subscriptionSource: 'enterprise',
      orgName: '北京杏林康云'
    })
    const state = resolveEntitlement({ member: seat, dongle: absentDongle })
    const fields = profileFields(seat, state)
    expect(fields.editionLabel).toBe('企业版')
    expect(fields.enterpriseSource).toBe('企业授权 · 北京杏林康云')
  })

  it('omits the enterprise source for a personal subscription', () => {
    const personal = member({ edition: 'professional', subscriptionSource: 'personal' })
    const state = resolveEntitlement({ member: personal, dongle: absentDongle })
    expect(profileFields(personal, state).enterpriseSource).toBeUndefined()
  })

  it('keeps expired memberships visible as expired', () => {
    const expired = member({ subscriptionActive: false, subscriptionEndTime: '2020-01-01T00:00:00.000Z' })
    const state = resolveEntitlement({ member: expired, dongle: absentDongle })
    const fields = profileFields(expired, state)
    expect(fields.subscriptionActive).toBe(false)
    expect(fields.expiresAt).toBe('2020-01-01T00:00:00.000Z')
    // 已登录即使订阅过期也保留标准版（只读只针对未登录/无加密狗）
    expect(state.editable).toBe(true)
    expect(fields.editionLabel).toBe('标准版')
  })

  it('keeps the enterprise matrix for a dongle user', () => {
    const dongle = resolveEntitlement({ member: null, dongle: { present: true, valid: true, checkedAt: '' } })
    expect(dongle.features).toEqual(FEATURE_MATRIX.enterprise)
  })
})

describe('start page cloud scope', () => {
  it('shows the public library when signed out and my templates when signed in', () => {
    expect(cloudScope(null)).toBe('public')
    expect(cloudScope(member())).toBe('mine')
  })

  it('selects exactly one cloud section state', () => {
    expect(cloudSectionState(true, 'err', 3)).toBe('loading')
    expect(cloudSectionState(false, 'err', 3)).toBe('error')
    expect(cloudSectionState(false, '', 0)).toBe('empty')
    expect(cloudSectionState(false, '', 2)).toBe('list')
  })
})
