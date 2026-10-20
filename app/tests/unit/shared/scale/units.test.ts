import { describe, expect, it } from 'vitest'
import { convertWeight, formatWeight, normalizeUnitToken } from '@shared/scale/units'
import { formatScaleValue } from '@/features/scale/resolveWeights'
import type { KeyboardSource } from '@shared/domain/datasource'
import type { ScaleReading } from '@shared/scale/types'

function weighSource(overrides: Partial<KeyboardSource> = {}): KeyboardSource {
  return { kind: 'keyboard', label: '重量', inputDevice: 'weigh', weighUnit: 'kg', weighDecimals: 2, weighUnitConv: true, ...overrides }
}

function reading(value: number, unit: ScaleReading['unit']): ScaleReading {
  return { value, unit, stable: true, raw: '', timestamp: 0 }
}

describe('scale units', () => {
  it('normalizes unit tokens case-insensitively', () => {
    expect(normalizeUnitToken('KG')).toBe('kg')
    expect(normalizeUnitToken(' g ')).toBe('g')
    expect(normalizeUnitToken('lb')).toBe('lb')
    expect(normalizeUnitToken('oz')).toBe('oz')
    expect(normalizeUnitToken('jin')).toBe('jin')
    expect(normalizeUnitToken('斤')).toBe('jin')
    expect(normalizeUnitToken('stone')).toBeUndefined()
    expect(normalizeUnitToken(undefined)).toBeUndefined()
  })

  it('converts between supported units using exact factors', () => {
    expect(convertWeight(1.234, 'kg', 'g')).toBeCloseTo(1234, 6)
    expect(convertWeight(1.234, 'kg', 'lb')).toBeCloseTo(2.7206, 3)
    expect(convertWeight(1, 'jin', 'g')).toBeCloseTo(500, 6)
    expect(convertWeight(1, 'lb', 'g')).toBeCloseTo(453.59237, 6)
    expect(convertWeight(1, 'oz', 'g')).toBeCloseTo(28.349523125, 9)
  })

  it('formats with the configured decimals and keeps the sign', () => {
    expect(formatWeight(1.234, 'kg', 2)).toBe('1.23')
    expect(formatWeight(1234, 'g', 0)).toBe('1234')
    expect(formatWeight(-1.235, 'kg', 2)).toBe('-1.24')
    expect(formatWeight(1, 'kg', 4)).toBe('1.0000')
  })

  it('converts to the label output unit when conversion is enabled', () => {
    expect(formatScaleValue(weighSource(), reading(1.234, 'kg'))).toBe('1.23')
    expect(formatScaleValue(weighSource({ weighUnit: 'g', weighDecimals: 0 }), reading(1.234, 'kg'))).toBe('1234')
    expect(formatScaleValue(weighSource({ weighUnit: 'lb' }), reading(1, 'kg'))).toBe('2.20')
    expect(formatScaleValue(weighSource({ weighUnit: 'oz' }), reading(1, 'kg'))).toBe('35.27')
    expect(formatScaleValue(weighSource({ weighUnit: 'jin' }), reading(1, 'kg'))).toBe('2.00')
  })

  it('keeps the reported unit when conversion is disabled', () => {
    expect(formatScaleValue(weighSource({ weighUnit: 'g', weighUnitConv: false }), reading(1.234, 'kg'))).toBe('1.23')
    expect(formatScaleValue(weighSource({ weighUnit: 'g', weighUnitConv: false, weighDecimals: 0 }), reading(1234, 'g'))).toBe('1234')
  })

  it('honours every decimal setting from 0 to 4', () => {
    for (let decimals = 0; decimals <= 4; decimals += 1) {
      expect(formatScaleValue(weighSource({ weighDecimals: decimals }), reading(1.23456, 'kg'))).toBe(1.23456.toFixed(decimals))
    }
  })
})
