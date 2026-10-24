import { describe, expect, it, vi } from 'vitest'
import { serialBumpFor } from '@/features/printing/entitlementPrint'
import { FEATURE_MATRIX, type EntitlementState } from '@shared/domain/entitlement'

function state(editable: boolean): EntitlementState {
  return {
    editable,
    edition: editable ? 'enterprise' : 'none',
    editionLabel: editable ? '企业版' : '未订阅',
    source: editable ? 'member' : 'none',
    features: editable ? { ...FEATURE_MATRIX.enterprise } : { ...FEATURE_MATRIX.none },
    subscriptionActive: editable,
    offline: false,
    dongle: { present: false, valid: false, checkedAt: '' },
    checkedAt: ''
  }
}

describe('read-only printing', () => {
  it('skips serial advancement and auto-save when read-only', async () => {
    const bump = vi.fn(async () => ({ ok: true }))
    const guarded = serialBumpFor(state(false), bump)
    await expect(guarded('tab-1', 1, 1)).resolves.toEqual({ ok: true })
    expect(bump).not.toHaveBeenCalled()
  })

  it('uses the real serial bump when authorized', async () => {
    const bump = vi.fn(async () => ({ ok: true }))
    const guarded = serialBumpFor(state(true), bump)
    await guarded('tab-1', 1, 1)
    expect(bump).toHaveBeenCalledTimes(1)
  })
})
