import { describe, expect, it } from 'vitest'
import { closingIncludesTrackedTab } from '@/features/printing/operationTracking'

describe('print operation tab tracking', () => {
  it('cancels when the tracked tab is closed', () => {
    expect(closingIncludesTrackedTab('tab-1', ['tab-2', 'tab-1'])).toBe(true)
  })

  it('keeps running when another tab is closed', () => {
    expect(closingIncludesTrackedTab('tab-1', ['tab-2'])).toBe(false)
  })

  it('does nothing when no operation is tracked', () => {
    expect(closingIncludesTrackedTab(null, ['tab-1'])).toBe(false)
  })
})
