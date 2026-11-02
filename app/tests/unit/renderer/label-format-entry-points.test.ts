import { describe, expect, it } from 'vitest'
import { LABEL_FORMAT_SETTINGS_MODAL, geometryEditable } from '@/features/label-formats/templateGeometry'

describe('label format entry points', () => {
  it('标签格式设置 edits the current document instead of creating a new one', () => {
    expect(LABEL_FORMAT_SETTINGS_MODAL).toBe('labelFormat')
  })

  it('keeps preset geometry read-only while custom geometry stays editable', () => {
    expect(geometryEditable('preset')).toBe(false)
    expect(geometryEditable('custom')).toBe(true)
  })
})
