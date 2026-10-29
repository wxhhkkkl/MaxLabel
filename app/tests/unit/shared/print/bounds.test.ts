import { describe, expect, it } from 'vitest'
import { rotatedObjectBounds } from '@shared/print/bounds'

describe('对象旋转包围盒', () => {
  it('不旋转时就是对象框，留白按四边加', () => {
    expect(rotatedObjectBounds({ x: 10, y: 20, w: 30, h: 10, rotation: 0 }, 0)).toEqual({ x: 10, y: 20, w: 30, h: 10 })
    expect(rotatedObjectBounds({ x: 10, y: 20, w: 30, h: 10, rotation: 0 }, 0.4)).toEqual({ x: 9.6, y: 19.6, w: 30.8, h: 10.8 })
  })

  it('绕左上角旋转 90°：宽高互换，落在枢轴左侧', () => {
    const bounds = rotatedObjectBounds({ x: 10, y: 20, w: 30, h: 10, rotation: 90, align: 'left', verticalAlign: 'top' }, 0)
    expect(bounds.x).toBeCloseTo(0, 6)
    expect(bounds.y).toBeCloseTo(20, 6)
    expect(bounds.w).toBeCloseTo(10, 6)
    expect(bounds.h).toBeCloseTo(30, 6)
  })

  it('绕中心旋转 45°：包围盒按对角线张开', () => {
    const bounds = rotatedObjectBounds({ x: 0, y: 0, w: 10, h: 10, rotation: 45, align: 'center', verticalAlign: 'middle' }, 0)
    expect(bounds.w).toBeCloseTo(14.142, 2)
    expect(bounds.h).toBeCloseTo(14.142, 2)
    expect(bounds.x).toBeCloseTo(-2.071, 2)
    expect(bounds.y).toBeCloseTo(-2.071, 2)
  })
})
