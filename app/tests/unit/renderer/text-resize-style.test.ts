import { describe, expect, it } from 'vitest'
import { textStretchAfterResize } from '@/features/canvas/syncFromFabric'
import { textObject } from '../../helpers/color'

describe('文字缩放回写模型', () => {
  it('等比拉动角手柄：字号按比例放大，宽度缩放保持 1', () => {
    const result = textStretchAfterResize(textObject({ fontSize: 4, fontWidthScale: 1 }), { scaleX: 1.25, scaleY: 1.25 })
    expect(result.fontSize).toBe(5)
    expect(result.fontWidthScale).toBe(1)
  })

  it('横向拉边手柄：只改宽度缩放，字号不变', () => {
    const result = textStretchAfterResize(textObject({ fontSize: 4, fontWidthScale: 1 }), { scaleX: 1.2, scaleY: 1 })
    expect(result.fontSize).toBe(4)
    expect(result.fontWidthScale).toBe(1.2)
  })

  it('纵向拉边手柄：字号变大、宽度缩放等比补偿，字形不被拉宽', () => {
    const result = textStretchAfterResize(textObject({ fontSize: 4, fontWidthScale: 1 }), { scaleX: 1, scaleY: 1.5 })
    expect(result.fontSize).toBe(6)
    expect(result.fontWidthScale).toBe(0.67)
  })

  it('创建时已带宽度缩放：基准缩放参与换算，不重复放大', () => {
    const object = textObject({ fontSize: 4, fontWidthScale: 2 })
    const result = textStretchAfterResize(object, { scaleX: 2, scaleY: 1, dataBoxScaleX: 2 })
    expect(result.fontSize).toBe(4)
    expect(result.fontWidthScale).toBe(2)
  })
})
