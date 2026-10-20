import { describe, expect, it } from 'vitest'
import { LITERAL_ACCELERATOR_PATTERN, acceleratorOf, displayMfcCaption } from '@shared/mfcCaption'

describe('MFC caption display', () => {
  it('hides a single ampersand accelerator marker', () => {
    expect(displayMfcCaption('条码符号类型(码制)(&B):')).toBe('条码符号类型(码制)(B):')
    expect(displayMfcCaption('&File')).toBe('File')
    expect(displayMfcCaption('trailing&')).toBe('trailing')
  })

  it('renders an escaped ampersand as one ampersand', () => {
    expect(displayMfcCaption('A && B')).toBe('A & B')
    expect(displayMfcCaption('&&')).toBe('&')
  })

  it('returns the accelerator character', () => {
    expect(acceleratorOf('(&B)')).toBe('B')
    expect(acceleratorOf('&File')).toBe('F')
    expect(acceleratorOf('A && B')).toBeNull()
    expect(acceleratorOf('plain')).toBeNull()
  })

  it('detects literal accelerators that leaked into source text', () => {
    expect(LITERAL_ACCELERATOR_PATTERN.test('宽度(&W):')).toBe(true)
    expect(LITERAL_ACCELERATOR_PATTERN.test('A && B')).toBe(false)
  })
})
