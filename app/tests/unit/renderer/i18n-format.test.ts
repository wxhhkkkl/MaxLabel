import { describe, expect, it } from 'vitest'
import { formatDateTime, formatNumber } from '@/features/i18n/format'

describe('locale display formatting', () => {
  it('formats dates with the active locale while keeping an invalid value empty', () => {
    const options: Intl.DateTimeFormatOptions = { year: 'numeric', month: '2-digit', day: '2-digit', timeZone: 'UTC' }
    expect(formatDateTime('2026-10-19T12:00:00Z', 'en-US', options)).toBe('10/19/2026')
    expect(formatDateTime('2026-10-19T12:00:00Z', 'zh-CN', options)).toBe('2026/10/19')
    expect(formatDateTime(undefined, 'en-US', options)).toBe('')
    expect(formatDateTime('not-a-date', 'en-US', options)).toBe('')
  })

  it('formats numbers without changing the underlying value', () => {
    expect(formatNumber(1234.5, 'en-US')).toBe('1,234.5')
    expect(formatNumber(0.25, 'en-US', { style: 'percent' })).toBe('25%')
  })
})
