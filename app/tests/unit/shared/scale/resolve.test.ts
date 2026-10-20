import { describe, expect, it } from 'vitest'
import { resolveSourceText, type DataCtx } from '@shared/domain/datasource'
import type { KeyboardSource } from '@shared/domain/datasource'

function ctx(overrides: Partial<DataCtx> = {}): DataCtx {
  return {
    labelIndex: 1,
    recordIndex: 0,
    copy: 1,
    count: 1,
    totalLabels: 1,
    title: '',
    printerName: '',
    datasets: {},
    sharedVars: {},
    keyboardValues: {},
    ...overrides
  }
}

const weighSource: KeyboardSource = {
  kind: 'keyboard',
  label: '重量',
  inputDevice: 'weigh',
  weighProtocol: 'standard',
  weighPort: 'COM3',
  weighBaud: '9600',
  weighUnit: 'kg',
  weighDecimals: 2
}

const keyboardSource: KeyboardSource = { kind: 'keyboard', label: '重量', inputDevice: 'keyboard' }

describe('scale value resolution', () => {
  it('indexes scale values by logical label', () => {
    const scaleValues = { 重量: ['1.11', '2.22'] }
    expect(resolveSourceText(weighSource, ctx({ labelIndex: 1, scaleValues }))).toBe('1.11')
    expect(resolveSourceText(weighSource, ctx({ labelIndex: 2, scaleValues }))).toBe('2.22')
  })

  it('returns an empty value when the label index was not captured', () => {
    expect(resolveSourceText(weighSource, ctx({ labelIndex: 3, scaleValues: { 重量: ['1.11'] } }))).toBe('')
  })

  it('falls back to keyboard values when no scale reading exists', () => {
    expect(resolveSourceText(weighSource, ctx({ keyboardValues: { 重量: '手动值' } }))).toBe('手动值')
  })

  it('uses keyboard values for keyboard-input sources even if scale values exist', () => {
    expect(resolveSourceText(keyboardSource, ctx({ keyboardValues: { 重量: '9.99' }, scaleValues: { 重量: ['1.11'] } }))).toBe('9.99')
  })
})
