import { describe, expect, it, vi } from 'vitest'
import { DEFAULT_ENTITLEMENT, FEATURE_MATRIX, resolveEntitlement } from '@shared/domain/entitlement'
import { effectiveAllowScript, featureAllowed, guardEdit, guardFeature, isReadOnly } from '@/features/entitlement/entitlementGuards'

const tr = (key: string) => key
const dongle = (valid = false) => ({ present: valid, valid, checkedAt: '2026-10-23T00:00:00.000Z' })

describe('entitlement guards', () => {
  it('treats the default state as read-only', () => {
    expect(isReadOnly(DEFAULT_ENTITLEMENT)).toBe(true)
    expect(featureAllowed(DEFAULT_ENTITLEMENT, 'print')).toBe(true)
  })

  it('allows edits for an authorized member and rejects them when read-only', () => {
    const readonly = resolveEntitlement({ member: null, dongle: dongle() })
    const standard = resolveEntitlement({
      member: { subscriptionActive: true, edition: 'standard', subscriptionEndTime: '2099-01-01T00:00:00.000Z' },
      dongle: dongle()
    })
    const status = vi.fn()
    const action = vi.fn()

    expect(guardEdit(readonly, tr, status, action)).toBe(false)
    expect(action).not.toHaveBeenCalled()
    expect(status).toHaveBeenCalledWith('entitlement.readOnly')

    expect(guardEdit(standard, tr, status, action)).toBe(true)
    expect(action).toHaveBeenCalledTimes(1)
  })

  it('rejects a version-locked feature while allowing an included one', () => {
    const standard = resolveEntitlement({
      member: { subscriptionActive: true, edition: 'standard', subscriptionEndTime: '2099-01-01T00:00:00.000Z' },
      dongle: dongle()
    })
    const status = vi.fn()
    const action = vi.fn()

    // 数据库连接在清单里是「标准」级，登录即可用。
    expect(guardFeature(standard, 'databaseSources', tr, status, action)).toBe(true)
    expect(action).toHaveBeenCalledTimes(1)

    // 云模板不在标准档；被拦时给出「版本不支持」的提示。
    expect(guardFeature(standard, 'cloudTemplates', tr, status, action)).toBe(false)
    expect(status).toHaveBeenCalledWith('entitlement.featureLocked')

    expect(guardFeature(standard, 'print', tr, status, action)).toBe(true)
    expect(action).toHaveBeenCalledTimes(2)
  })

  it('executes scripts only when both the setting and the edition allow it', () => {
    const standard = resolveEntitlement({
      member: { subscriptionActive: true, edition: 'standard', subscriptionEndTime: '2099-01-01T00:00:00.000Z' },
      dongle: dongle()
    })
    const enterprise = resolveEntitlement({
      member: { subscriptionActive: true, edition: 'enterprise', subscriptionEndTime: '2099-01-01T00:00:00.000Z' },
      dongle: dongle()
    })
    // 脚本是清单里的标准级数据源类型，登录即可执行；开关仍要打开。
    expect(effectiveAllowScript(true, standard)).toBe(true)
    expect(effectiveAllowScript(true, enterprise)).toBe(true)
    expect(effectiveAllowScript(false, enterprise)).toBe(false)
  })

  it('lets a valid dongle pass every feature guard', () => {
    const dongleState = resolveEntitlement({ member: null, dongle: dongle(true) })
    for (const key of Object.keys(FEATURE_MATRIX.enterprise)) {
      expect(featureAllowed(dongleState, key as keyof typeof FEATURE_MATRIX.enterprise)).toBe(true)
    }
  })
})
