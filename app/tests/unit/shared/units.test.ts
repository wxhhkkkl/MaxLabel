import { describe, expect, it } from 'vitest'
import { PRINT_PX_PER_MM, PX_PER_MM, round2, uid } from '@shared/domain/units'
import { dpiToDpm, dot2mm, fmt, mm2dot } from '@shared/print/geometry'

describe('units', () => {
  it('uses the editor and print pixel scales', () => {
    expect(PX_PER_MM).toBe(10)
    expect(PRINT_PX_PER_MM).toBeCloseTo(300 / 25.4, 10)
  })

  it('rounds to two decimals', () => {
    expect(round2(1.234)).toBe(1.23)
    expect(round2(1.236)).toBe(1.24)
    expect(round2(-1.234)).toBe(-1.23)
  })

  it('creates non-empty unique ids', () => {
    const a = uid()
    const b = uid()
    expect(a).not.toBe('')
    expect(a).not.toBe(b)
  })
})

describe('print geometry', () => {
  it.each([
    [203, 80, 639],
    [203, 60, 480],
    [300, 80, 945],
    [600, 60, 1417]
  ])('converts %i dpi and %i mm to dots', (dpi, mm, dots) => {
    expect(mm2dot(mm, dpi)).toBe(dots)
    expect(dpiToDpm(dpi)).toBeCloseTo(dpi / 25.4, 10)
  })

  it('round-trips millimetres within half a dot of quantisation error', () => {
    for (const dpi of [203, 300, 600]) {
      const halfDotMm = 25.4 / dpi / 2
      for (const mm of [10, 40, 60, 80, 100]) {
        const roundTripped = dot2mm(mm2dot(mm, dpi), dpi)
        expect(Math.abs(roundTripped - mm)).toBeLessThanOrEqual(halfDotMm + 1e-9)
      }
    }
  })

  it('formats without trailing zeros', () => {
    expect(fmt(1.5)).toBe('1.5')
    expect(fmt(1.234)).toBe('1.23')
    expect(fmt(2)).toBe('2')
  })
})
