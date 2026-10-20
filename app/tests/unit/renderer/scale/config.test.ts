import { describe, expect, it } from 'vitest'
import type { KeyboardSource } from '@shared/domain/datasource'
import { withWeighDefaults } from '@/features/scale/config'

describe('weigh source defaults', () => {
  it('seeds every serial setting, including the visible port, when switching to weigh', () => {
    const source: KeyboardSource = { kind: 'keyboard', label: '重量' }
    expect(withWeighDefaults(source)).toMatchObject({
      kind: 'keyboard',
      label: '重量',
      inputDevice: 'weigh',
      weighProtocol: 'kasda',
      weighPort: 'COM1',
      weighBaud: '9600',
      weighUnit: 'kg',
      weighDecimals: 2
    })
  })

  it('keeps an existing weigh configuration untouched', () => {
    const configured: KeyboardSource = {
      kind: 'keyboard',
      label: '重量',
      inputDevice: 'weigh',
      weighProtocol: 'ad',
      weighPort: 'COM7',
      weighBaud: '19200',
      weighUnit: 'jin',
      weighDecimals: 3,
      weighAutoPrint: true,
      weighUnitConv: true
    }
    expect(withWeighDefaults(configured)).toEqual(configured)
  })

  it('does not hide an explicitly cleared port behind a default', () => {
    const cleared: KeyboardSource = { kind: 'keyboard', label: '重量', inputDevice: 'weigh', weighPort: '' }
    expect(withWeighDefaults(cleared).weighPort).toBe('')
  })
})
