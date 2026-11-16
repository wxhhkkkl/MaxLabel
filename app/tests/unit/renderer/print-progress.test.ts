import { describe, expect, it } from 'vitest'
import { printProgressPercent } from '@/features/printing/PrintProgressOverlay'

describe('print progress percent', () => {
  it('maps done/total to a clamped percentage', () => {
    expect(printProgressPercent(0, 10)).toBe(0)
    expect(printProgressPercent(1, 4)).toBe(25)
    expect(printProgressPercent(3, 3)).toBe(100)
    // 计数偶尔超过总数（比如按批更新时）不应超过 100%，也不应回退。
    expect(printProgressPercent(5, 3)).toBe(100)
    expect(printProgressPercent(-1, 4)).toBe(0)
  })

  it('returns null while the total is unknown so the bar shows an indeterminate state', () => {
    expect(printProgressPercent(0, 0)).toBeNull()
    expect(printProgressPercent(1, Number.NaN)).toBeNull()
    expect(printProgressPercent(1, Number.POSITIVE_INFINITY)).toBeNull()
  })
})
