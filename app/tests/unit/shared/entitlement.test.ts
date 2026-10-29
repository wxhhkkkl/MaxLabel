import { describe, expect, it } from 'vitest'
import {
  DEFAULT_ENTITLEMENT,
  FEATURE_KEYS,
  FEATURE_MATRIX,
  dataSourceKindAllowed,
  resolveEntitlement,
  type DongleState
} from '@shared/domain/entitlement'

const NOW = new Date('2026-10-23T12:00:00.000Z').getTime()

function dongle(overrides: Partial<DongleState> = {}): DongleState {
  return { present: false, valid: false, checkedAt: '2026-10-23T12:00:00.000Z', ...overrides }
}

function member(overrides: Record<string, unknown> = {}) {
  return {
    subscriptionActive: true,
    edition: 'standard' as const,
    subscriptionEndTime: '2027-01-01T00:00:00.000Z',
    ...overrides
  }
}

describe('entitlement resolver', () => {
  it('is read-only when there is no member and no dongle', () => {
    const state = resolveEntitlement({ member: null, dongle: dongle(), now: NOW })
    expect(state.editable).toBe(false)
    expect(state.source).toBe('none')
    expect(state.edition).toBe('none')
    expect(state.features.print).toBe(true)
    for (const key of FEATURE_KEYS) {
      if (key !== 'print') expect(state.features[key]).toBe(false)
    }
  })

  it('enables standard edition features for a standard member', () => {
    const state = resolveEntitlement({ member: member(), dongle: dongle(), now: NOW })
    expect(state.editable).toBe(true)
    expect(state.edition).toBe('standard')
    expect(state.features).toEqual(FEATURE_MATRIX.standard)
    expect(state.features.cloudTemplates).toBe(false)
  })

  it('gives professional members every feature', () => {
    // 2026-10-28：凡付费来源（个人订阅/企业授权/加密狗）一律全部功能。
    const state = resolveEntitlement({ member: member({ edition: 'professional' }), dongle: dongle(), now: NOW })
    expect(state.features).toEqual(FEATURE_MATRIX.enterprise)
    expect(Object.values(state.features).every(Boolean)).toBe(true)
  })

  it('enables every feature for enterprise members', () => {
    const state = resolveEntitlement({ member: member({ edition: 'enterprise' }), dongle: dongle(), now: NOW })
    expect(state.features).toEqual(FEATURE_MATRIX.enterprise)
    expect(Object.values(state.features).every(Boolean)).toBe(true)
  })

  it('lets a valid dongle unlock everything without a member', () => {
    const state = resolveEntitlement({ member: null, dongle: dongle({ present: true, valid: true }), now: NOW })
    expect(state.editable).toBe(true)
    expect(state.source).toBe('dongle')
    expect(state.editionLabel).toBe('加密狗（全部功能）')
    expect(Object.values(state.features).every(Boolean)).toBe(true)
  })

  it('keeps the member edition visible when a dongle is also present', () => {
    const state = resolveEntitlement({
      member: member({ edition: 'professional' }),
      dongle: dongle({ present: true, valid: true }),
      now: NOW
    })
    expect(state.source).toBe('member+dongle')
    expect(state.editable).toBe(true)
    expect(Object.values(state.features).every(Boolean)).toBe(true)
  })

  it('falls back to standard edition for a logged-in member with an expired subscription', () => {
    const state = resolveEntitlement({
      member: member({ subscriptionEndTime: '2026-10-23T11:59:59.000Z' }),
      dongle: dongle(),
      now: NOW
    })
    expect(state.editable).toBe(true)
    expect(state.edition).toBe('standard')
    expect(state.subscriptionActive).toBe(false)
    expect(state.source).toBe('member')
  })

  it('grants standard edition to a logged-in member without any subscription', () => {
    const state = resolveEntitlement({
      member: { subscriptionActive: false },
      dongle: dongle(),
      now: NOW
    })
    expect(state.editable).toBe(true)
    expect(state.edition).toBe('standard')
    expect(state.editionLabel).toBe('标准版')
    expect(state.features).toEqual(FEATURE_MATRIX.standard)
  })

  it('treats a date-only end date as valid through that day', () => {
    const state = resolveEntitlement({
      member: member({ subscriptionEndTime: null, subscriptionEndDate: '2026-10-23' }),
      dongle: dongle(),
      now: NOW
    })
    expect(state.editable).toBe(true)
  })

  it('does not let malformed or missing editions elevate privileges', () => {
    const state = resolveEntitlement({
      member: member({ edition: 'enterprise-plus' }),
      dongle: dongle(),
      now: NOW
    })
    // 已登录兜底到标准版；非法版本不能被当成企业版
    expect(state.edition).toBe('standard')
    expect(state.features).toEqual(FEATURE_MATRIX.standard)
  })

  it('always allows printing, even in read-only mode', () => {
    const state = resolveEntitlement({ member: null, dongle: dongle(), now: NOW })
    expect(state.features.print).toBe(true)
  })

  it('exposes a conservative default until the main process reports state', () => {
    expect(DEFAULT_ENTITLEMENT.editable).toBe(false)
    expect(DEFAULT_ENTITLEMENT.features.print).toBe(true)
  })
})

describe('data source kind gating', () => {
  it('keeps constants everywhere and gates each source type by its feature', () => {
    // 清单里 6.2「数据源」七种类型全是标准级：登录即可用，未登录只剩常量（只读）。
    expect(dataSourceKindAllowed('constant', FEATURE_MATRIX.none)).toBe(true)
    for (const kind of ['database', 'serial', 'date', 'time', 'keyboard', 'script']) {
      expect(dataSourceKindAllowed(kind, FEATURE_MATRIX.standard)).toBe(true)
      expect(dataSourceKindAllowed(kind, FEATURE_MATRIX.professional)).toBe(true)
    }
    expect(dataSourceKindAllowed('database', FEATURE_MATRIX.none)).toBe(false)
    expect(dataSourceKindAllowed('script', FEATURE_MATRIX.none)).toBe(false)
  })
})
