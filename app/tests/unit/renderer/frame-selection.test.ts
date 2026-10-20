import { describe, expect, it } from 'vitest'
import { clientRectFromPoints, objectClientBounds, rectIntersects } from '@/editor/frameSelection'
import { CANVAS_RECT, rectObject } from '../../helpers/canvas'
import { sampleDoc } from '../../helpers/factories'

describe('frame selection', () => {
  it('normalises a drag rectangle in any direction', () => {
    expect(clientRectFromPoints(10, 20, 5, 5)).toEqual({ left: 5, top: 5, right: 10, bottom: 20 })
  })

  it('detects containment and disjoint rectangles', () => {
    expect(rectIntersects({ left: 0, top: 0, right: 10, bottom: 10 }, { left: 5, top: 5, right: 15, bottom: 15 })).toBe(true)
    expect(rectIntersects({ left: 0, top: 0, right: 10, bottom: 10 }, { left: 10, top: 10, right: 20, bottom: 20 })).toBe(true)
    expect(rectIntersects({ left: 0, top: 0, right: 10, bottom: 10 }, { left: 11, top: 11, right: 20, bottom: 20 })).toBe(false)
  })

  it('maps object bounds into client space at zero rotation', () => {
    const doc = sampleDoc()
    const object = rectObject('r', 10, 5, 20, 10)
    expect(objectClientBounds(object, doc, CANVAS_RECT as DOMRect, 1, 0)).toEqual({ left: 100, top: 50, right: 300, bottom: 150 })
  })

  it('accounts for zoom and rotation', () => {
    const doc = sampleDoc()
    const object = rectObject('r', 10, 5, 20, 10)
    expect(objectClientBounds(object, doc, CANVAS_RECT as DOMRect, 2, 0)).toEqual({ left: -100, top: -100, right: 300, bottom: 100 })
    const rotated = objectClientBounds(object, doc, CANVAS_RECT as DOMRect, 1, 90)
    expect(rotated.left).toBeCloseTo(350, 6)
    expect(rotated.top).toBeCloseTo(0, 6)
    expect(rotated.right).toBeCloseTo(450, 6)
    expect(rotated.bottom).toBeCloseTo(200, 6)
  })
})
