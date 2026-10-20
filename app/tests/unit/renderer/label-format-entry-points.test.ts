import { describe, expect, it } from 'vitest'
import { LABEL_FORMAT_SETTINGS_MODAL, geometryEditable } from '@/features/label-formats/templateGeometry'

describe('label format entry points', () => {
  it('opens the New Label dialog for 标签格式设置 instead of editing the current document', () => {
    expect(LABEL_FORMAT_SETTINGS_MODAL).toBe('new')
  })

  it('keeps preset geometry read-only while custom geometry stays editable', () => {
    expect(geometryEditable('preset')).toBe(false)
    expect(geometryEditable('custom')).toBe(true)
  })
})
