// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import type { BarcodeObj } from '@shared/domain/objects'
import { objectBitmapBoundsMm } from '@/print/bitmapSource'
import { dataCtx } from '../../helpers/factories'

function barcode(overrides: Partial<BarcodeObj>): BarcodeObj {
  return {
    id: 'bc',
    type: 'barcode',
    x: 10,
    y: 10,
    w: 20,
    h: 10,
    rotation: 0,
    symbology: 'databaromni',
    showText: false,
    source: { kind: 'constant', value: '6901234567892' },
    ...overrides
  }
}

describe('对象位图的裁切范围', () => {
  it('GS1 DataBar 比对象框宽时，裁切范围按实际符号宽度扩出去（否则打印左右被截）', async () => {
    const bounds = await objectBitmapBoundsMm(barcode({}), 0.4, dataCtx())
    // DataBar 14 位在默认 X 尺寸下约 34 mm，比 20 mm 的对象框宽。
    expect(bounds.w).toBeGreaterThan(25)
  })

  it('符号居中溢出到标签左侧时从 0 起裁，不产生负坐标 BITMAP', async () => {
    const bounds = await objectBitmapBoundsMm(barcode({ x: 2 }), 0.4, dataCtx())
    expect(bounds.x).toBe(0)
    expect(bounds.w).toBeGreaterThan(25)
  })

  it('放得下的条码保持对象框范围，不受实测影响', async () => {
    const bounds = await objectBitmapBoundsMm(
      barcode({ symbology: 'code128', w: 50, h: 10, source: { kind: 'constant', value: 'ABC123' } }),
      0.4,
      dataCtx()
    )
    expect(bounds.w).toBeCloseTo(50.8, 3)
  })
})
