import { describe, expect, it } from 'vitest'
import { historyPhysicalCount, historyStatusKey, sortLogsNewestFirst } from '@/features/printing/printHistory'

describe('print history presentation', () => {
  it('maps stored statuses to catalog keys', () => {
    expect(historyStatusKey('partial')).toBe('history.status.partial')
    expect(historyStatusKey('failed')).toBe('history.status.failed')
    expect(historyStatusKey('canceled')).toBe('history.status.canceled')
    expect(historyStatusKey('unknown')).toBe('history.status.unknown')
    expect(historyStatusKey('completed')).toBe('history.status.submitted')
    expect(historyStatusKey(undefined)).toBe('history.status.submitted')
  })

  it('falls back to count × copies for the planned physical count', () => {
    expect(historyPhysicalCount({ count: 3, copies: 2 })).toBe(6)
    expect(historyPhysicalCount({ count: 3, copies: 2, physicalCount: 5 })).toBe(5)
    expect(historyPhysicalCount({ count: 0, copies: 0 })).toBe(0)
  })

  it('sorts newest first without mutating the input', () => {
    const rows = [
      { time: '2026-10-20T09:00:00.000Z', title: 'a' },
      { time: '2026-10-20T11:00:00.000Z', title: 'c' },
      { time: '2026-10-20T10:00:00.000Z', title: 'b' }
    ]
    const sorted = sortLogsNewestFirst(rows)
    expect(sorted.map((row) => row.title)).toEqual(['c', 'b', 'a'])
    expect(rows.map((row) => row.title)).toEqual(['a', 'c', 'b'])
  })
})
