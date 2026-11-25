// @vitest-environment jsdom
import * as fabric from 'fabric'
import { describe, expect, it } from 'vitest'
import { barcodePlacement } from '@/rendering/fabricObjects'
import { syncFromFabric } from '@/features/canvas/syncFromFabric'
import { BARCODE_PIXELS_PER_MM } from '@/editor/barcode'
import type { BarcodeObj } from '@shared/domain/objects'
import { barcodeObject } from '../../helpers/color'

const SC = 96 / 25.4
const natural = (mm: number) => mm * BARCODE_PIXELS_PER_MM

/** 用 Rect 冒充条码图片对象：fabricObjects 里条码落位只读这些几何字段。 */
function barcodeImage(o: BarcodeObj, naturalWidthMm: number) {
  const ratio = SC / BARCODE_PIXELS_PER_MM
  const node = new fabric.Rect({
    width: natural(naturalWidthMm),
    height: natural(o.h),
    scaleX: ratio,
    scaleY: ratio,
    left: o.x * SC,
    top: (o.y + o.h / 2) * SC,
    originX: 'left',
    originY: 'center'
  })
  ;(node as unknown as { dataBoxScaleX?: number }).dataBoxScaleX = ratio
  ;(node as unknown as { dataBoxScaleY?: number }).dataBoxScaleY = ratio
  return node
}

describe('条码拖小高度后切记录不会回弹', () => {
  it('拖小高度会把新高度写回模型', () => {
    const obj = barcodeObject({ h: 10 })
    const node = barcodeImage(obj, 30)

    // 用户把高度拖到 60%
    node.set({ scaleY: (node.scaleY ?? 1) * 0.6 })
    node.setCoords()

    const synced = syncFromFabric(obj, node, SC) as BarcodeObj
    expect(synced.h).toBeCloseTo(6, 1)
  })

  it('按新高度重新渲染时画出来还是新高度（不会回到原高度）', () => {
    const obj = barcodeObject({ h: 10 })
    const node = barcodeImage(obj, 30)
    node.set({ scaleY: (node.scaleY ?? 1) * 0.6 })
    node.setCoords()
    const synced = syncFromFabric(obj, node, SC) as BarcodeObj

    // 下一条记录：按新的 o.h 重新生成图片，再按同一套落位规则摆一次
    const placement = barcodePlacement(synced, SC, natural(30), natural(synced.h))
    const drawnHeightMm = (natural(synced.h) * placement.scaleY) / SC
    expect(drawnHeightMm).toBeCloseTo(synced.h, 2)
    expect(drawnHeightMm).toBeLessThan(9)
  })

  // 现场回归：QR + 人读文字时画布图片是「码区 + 框外文字」的长方形，且 HRI 字号会被
  // 可用宽度压小。按模型字号估算文字高会多减 1~2mm，导致每次拖完松手二维码都缩小。
  it('带人读文字的方形二维码按拖动倍数缩放，不会越拖越小', () => {
    const obj = barcodeObject({ symbology: 'qrcode', w: 10, h: 10, showText: true })
    const ratio = SC / BARCODE_PIXELS_PER_MM
    // 码区 10mm 见方，人读文字把图片拉高到 12.45mm（实际 HRI 块 2.45mm）。
    const node = new fabric.Rect({
      width: natural(10),
      height: natural(12.45),
      scaleX: ratio,
      scaleY: ratio,
      left: obj.x * SC,
      top: (obj.y + obj.h / 2) * SC,
      originX: 'left',
      originY: 'center'
    })
    ;(node as unknown as { dataBoxScaleX?: number }).dataBoxScaleX = ratio
    ;(node as unknown as { dataBoxScaleY?: number }).dataBoxScaleY = ratio

    // 用户把二维码拖大 20%
    node.set({ scaleX: ratio * 1.2, scaleY: ratio * 1.2 })
    node.setCoords()

    const synced = syncFromFabric(obj, node, SC) as BarcodeObj
    expect(synced.w).toBeCloseTo(12, 1)
    expect(synced.h).toBeCloseTo(12, 1)
  })
})
