import { describe, expect, it } from 'vitest'
import { formatMmValue } from '@/dialogs/CustomLabelFormatDialog'
import { clampCustomGrid, isCustomLabelSizeValid } from '@/features/label-formats/customFormat'

describe('custom label format validation', () => {
  it('accepts sizes within 5–500 mm', () => {
    expect(isCustomLabelSizeValid(5, 5)).toBe(true)
    expect(isCustomLabelSizeValid(500, 500)).toBe(true)
    expect(isCustomLabelSizeValid(80, 50)).toBe(true)
  })

  it('rejects sizes outside 5–500 mm or non-finite values', () => {
    expect(isCustomLabelSizeValid(4.99, 50)).toBe(false)
    expect(isCustomLabelSizeValid(80, 500.01)).toBe(false)
    expect(isCustomLabelSizeValid(Number.NaN, 50)).toBe(false)
    expect(isCustomLabelSizeValid(80, Number.POSITIVE_INFINITY)).toBe(false)
  })

  it('formats millimetre fields with two decimals while editing', () => {
    expect(formatMmValue('100')).toBe('100.00')
    expect(formatMmValue('2.5')).toBe('2.50')
    expect(formatMmValue('')).toBe('')
    expect(formatMmValue('abc')).toBe('abc')
  })

  it('clamps custom rows and columns to integers within 1–100', () => {
    expect(clampCustomGrid(2)).toBe(2)
    expect(clampCustomGrid(2.9)).toBe(2)
    expect(clampCustomGrid(0)).toBe(1)
    expect(clampCustomGrid(-5)).toBe(1)
    expect(clampCustomGrid(200)).toBe(100)
    expect(clampCustomGrid(Number.NaN)).toBe(1)
    expect(clampCustomGrid(Number.POSITIVE_INFINITY)).toBe(1)
  })
})
