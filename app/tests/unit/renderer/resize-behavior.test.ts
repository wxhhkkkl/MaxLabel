import { describe, expect, it } from 'vitest'
import {
  MIN_OBJECT_SIZE_MM,
  constrainFabricResize,
  fixedResizePoint,
  snapResizeMm
} from '@/features/editor/resizeBehavior'
import { barcodeObject } from '../../helpers/color'
import { isSquareMatrixSymbol } from '@/editor/barcodeTypes'
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
    expect(snapResizeMm(0.01)).toBe(MIN_OBJECT_SIZE_MM)
    expect(snapResizeMm(Number.NaN)).toBe(MIN_OBJECT_SIZE_MM)
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

  it('already-stretched text keeps its rendered ratio on corner handles', () => {
    const object = textObject()
    // 纵向拉伸过的文字：画布对象被压扁成 scaleX=0.5、scaleY=1，字框仍是 100×50。
    // 视觉比例 = 50 / (100 × 0.5) = 1，所以角手柄应该得到「高 = 宽」，而不是回到未拉伸的 1:2。
    const result = constrainFabricResize({ ...base, baseWidthPx: 100, baseHeightPx: 50, object, scaleX: 0.5, scaleY: 1, baseScaleX: 0.5, baseScaleY: 1, corner: 'br' })
    expect(result.widthMm).toBe(5)
    expect(result.heightMm).toBe(5)
  })

  it('preserves the drag direction for negative scales', () => {
    const result = constrainFabricResize({ ...base, object: rectObject('r', 0, 0), scaleX: -2, scaleY: 1 })
    expect(result.widthMm).toBe(20)
    expect(result.scaleX).toBe(-2)
  })

  it('方形二维码（QR / 微型 QR / 汉信码）等比缩放，不改图片比例', () => {
    for (const symbology of ['qrcode', 'microqrcode', 'hanxin']) {
      expect(isSquareMatrixSymbol(symbology)).toBe(true)
      const qr = { ...barcodeObject({ symbology }), w: 20, h: 20 }
      const corner = constrainFabricResize({ ...base, baseWidthPx: 100, baseHeightPx: 100, object: qr, scaleX: 1.5, scaleY: 1, corner: 'br' })
      expect(corner.widthMm).toBe(15)
      expect(corner.heightMm).toBe(15)
      const edge = constrainFabricResize({ ...base, baseWidthPx: 100, baseHeightPx: 100, object: qr, scaleX: 1.5, scaleY: 1, corner: 'mr' })
      expect(edge.widthMm).toBe(15)
      expect(edge.heightMm).toBe(15)
    }
    expect(isSquareMatrixSymbol('datamatrix')).toBe(false)
    expect(isSquareMatrixSymbol('pdf417')).toBe(false)
  })

  it('带人读文字的二维码：按图片（码 + 文字）比例等比缩放，不把码拉宽', () => {
    const qr = { ...barcodeObject({ symbology: 'qrcode' }), w: 20, h: 20 }
    // 画布图片 = 码 100px + 下方文字 40px；创建缩放 1.25。
    const result = constrainFabricResize({
      ...base,
      baseWidthPx: 100,
      baseHeightPx: 140,
      object: qr,
      scaleX: 1.875,
      scaleY: 1.25,
      baseScaleX: 1.25,
      baseScaleY: 1.25,
      corner: 'mr'
    })
    expect(result.widthMm / result.heightMm).toBeCloseTo(100 / 140, 2)
    expect(result.scaleX / 1.25).toBeCloseTo(result.scaleY / 1.25, 2)
  })

  it('finds the point that must stay fixed for every handle', () => {
    // getCoords() 的顺序：左上 / 右上 / 右下 / 左下
    const coords = [
      { x: 0, y: 0 },
      { x: 100, y: 0 },
      { x: 100, y: 50 },
      { x: 0, y: 50 }
    ]
    expect(fixedResizePoint(coords, 'tl')).toEqual({ x: 100, y: 50 })
    expect(fixedResizePoint(coords, 'tr')).toEqual({ x: 0, y: 50 })
    expect(fixedResizePoint(coords, 'br')).toEqual({ x: 0, y: 0 })
    expect(fixedResizePoint(coords, 'bl')).toEqual({ x: 100, y: 0 })
    expect(fixedResizePoint(coords, 'mr')).toEqual({ x: 0, y: 25 })
    expect(fixedResizePoint(coords, 'ml')).toEqual({ x: 100, y: 25 })
    expect(fixedResizePoint(coords, 'mt')).toEqual({ x: 50, y: 50 })
    expect(fixedResizePoint(coords, 'mb')).toEqual({ x: 50, y: 0 })
    expect(fixedResizePoint(coords, 'rotate')).toBeNull()
  })
})
