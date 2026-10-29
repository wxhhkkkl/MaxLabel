// @vitest-environment jsdom
import * as fabric from 'fabric'
import { describe, expect, it } from 'vitest'
import { barcodePlacement } from '@/rendering/fabricObjects'
import { syncFromFabric } from '@/features/canvas/syncFromFabric'
import { BARCODE_PIXELS_PER_MM } from '@/editor/barcode'
import type { BarcodeObj } from '@/shared/domain/objects'
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
})
