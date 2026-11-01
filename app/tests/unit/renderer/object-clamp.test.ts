import { describe, expect, it } from 'vitest'
import { clampObjectToLabel } from '@/features/editor/objectFactory'
import type { LabelObject } from '@/types'

/**
 * 新建对象必须收进标签范围（020 现场：一维码默认 44mm 宽，40mm 标签上一建就红框）。
 */
function obj(over: Partial<LabelObject>): LabelObject {
  return { id: 'o', type: 'rect', x: 0, y: 0, w: 10, h: 10, rotation: 0, ...over } as LabelObject
}

describe('新建对象收进标签范围', () => {
  it('宽高超出标签时收到标签尺寸', () => {
    const fitted = clampObjectToLabel(obj({ w: 44, h: 10 }), 40, 30)
    expect([fitted.w, fitted.h]).toEqual([40, 10])
  })

  it('位置越界时夹回标签内（右下角）', () => {
    const fitted = clampObjectToLabel(obj({ x: 30, y: 28, w: 40, h: 10 }), 40, 30)
    expect([fitted.x, fitted.y]).toEqual([0, 20])
  })

  it('本来就放得下时原样返回（不产生新对象）', () => {
    const source = obj({ x: 2, y: 2, w: 20, h: 8 })
    expect(clampObjectToLabel(source, 40, 30)).toBe(source)
  })

  it('高为 0 的线对象不被抬成非零高度', () => {
    const fitted = clampObjectToLabel(obj({ x: 5, y: 5, w: 30, h: 0, type: 'line' }), 40, 30)
    expect(fitted.h).toBe(0)
  })
})
