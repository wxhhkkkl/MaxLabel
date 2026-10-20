import { describe, expect, it } from 'vitest'
import {
  LABELSHOP_MIN_OBJECT_SIZE_MM,
  constrainFabricResize,
  snapResizeMm
} from '@/features/editor/resizeBehavior'
import { barcodeObject } from '../../helpers/color'
import { rectObject } from '../../helpers/canvas'
import { textObject } from '../../helpers/color'

const base = {
  baseWidthPx: 100,
  baseHeightPx: 100,
  scaleX: 1,
  scaleY: 1,
  corner: 'br',
  shiftKey: false,
  pixelsPerMm: 10
}

describe('resize constraints', () => {
  it('snaps to 0.1 mm with a 0.5 mm minimum', () => {
    expect(snapResizeMm(1.24)).toBe(1.2)
    expect(snapResizeMm(1.25)).toBe(1.3)
    expect(snapResizeMm(0.01)).toBe(LABELSHOP_MIN_OBJECT_SIZE_MM)
    expect(snapResizeMm(Number.NaN)).toBe(LABELSHOP_MIN_OBJECT_SIZE_MM)
    expect(snapResizeMm(1.3, 0.25)).toBe(1.25)
  })

  it('snaps barcode dimensions to the output step', () => {
    const result = constrainFabricResize({ ...base, object: barcodeObject(), scaleX: 1.06 })
    expect(result.widthMm).toBe(10.6)
    expect(result.heightMm).toBe(10)
    expect(result.scaleX).toBeCloseTo(1.06, 6)
  })

  it('never shrinks an object below the minimum', () => {
    const result = constrainFabricResize({ ...base, object: barcodeObject(), scaleX: 0.01, scaleY: 0.01 })
    expect(result.widthMm).toBe(0.5)
    expect(result.heightMm).toBe(0.5)
  })

  it('keeps geometric objects square with Shift', () => {
    const result = constrainFabricResize({ ...base, object: rectObject('r', 0, 0), scaleX: 2, scaleY: 1, shiftKey: true })
    expect(result.widthMm).toBe(20)
    expect(result.heightMm).toBe(20)
    expect(result.scaleX).toBe(2)
    expect(result.scaleY).toBe(2)
  })

  it('preserves the text ratio on corner handles and stretches on edge handles', () => {
    const object = textObject()
    const corner = constrainFabricResize({ ...base, baseHeightPx: 50, object, scaleX: 2, scaleY: 2, corner: 'tl' })
    expect(corner.widthMm).toBe(20)
    expect(corner.heightMm).toBe(10)
    const edge = constrainFabricResize({ ...base, baseHeightPx: 50, object, scaleX: 2, scaleY: 1, corner: 'mr' })
    expect(edge.widthMm).toBe(20)
    expect(edge.heightMm).toBe(5)
  })

  it('preserves the drag direction for negative scales', () => {
    const result = constrainFabricResize({ ...base, object: rectObject('r', 0, 0), scaleX: -2, scaleY: 1 })
    expect(result.widthMm).toBe(20)
    expect(result.scaleX).toBe(-2)
  })
})
