// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { barcodePlacement } from '@/rendering/fabricObjects'
import { BARCODE_PIXELS_PER_MM } from '@/editor/barcode'
import { barcodeObject } from '../../helpers/color'

/** 96dpi 下 1mm 对应的画布像素 */
const SC = 96 / 25.4
/** bwip-js 以 scale=8 生成，1mm = 8 * 72/25.4 像素 */
const natural = (mm: number) => mm * BARCODE_PIXELS_PER_MM

describe('条形码摆位', () => {
  it('一维码高度恒定：数据变长不再把整条压矮', () => {
    const obj = barcodeObject({ h: 10 })
    const short = barcodePlacement(obj, SC, 400, natural(10))
    const long = barcodePlacement(obj, SC, 2000, natural(10))

    expect(short.scaleY).toBeCloseTo(long.scaleY, 6)
    // 画出来的高度就是对象高度，与数据长短无关
    expect(short.scaleY * natural(obj.h)).toBeCloseTo(obj.h * SC, 3)
  })

  it('一维码变长后靠对齐摆位，允许超出对象框（与实际打印一致）', () => {
    const obj = barcodeObject({ h: 10, barcodeAlign: 'left' })
    const placement = barcodePlacement(obj, SC, 2000, natural(10))

    expect(placement.left).toBeCloseTo(obj.x * SC, 6)
    expect(2000 * placement.scaleX).toBeGreaterThan(obj.w * SC)
  })

  it('右对齐时条码右边缘贴住对象框右边缘', () => {
    const obj = barcodeObject({ h: 10, barcodeAlign: 'right' })
    const placement = barcodePlacement(obj, SC, 600, natural(10))

    expect(placement.left + 600 * placement.scaleX).toBeCloseTo((obj.x + obj.w) * SC, 3)
  })

  it('「X 尺寸 = 固定宽度」时按对象框宽度等比缩放', () => {
    const obj = barcodeObject({ h: 10, w: 40, barcodeOptions: { xSizeFixed: true } } as never)
    const placement = barcodePlacement(obj, SC, 2000, natural(10))
    // 超宽时缩到刚好占满框宽
    expect(2000 * placement.scaleX).toBeCloseTo(obj.w * SC, 3)
    expect(natural(10) * placement.scaleY).toBeCloseTo(obj.h * SC, 3)
  })

  it('二维码按对象框高度 1:1 绘制：码区占满框，人读文字在框外溢出', () => {
    const obj = barcodeObject({ symbology: 'qrcode', w: 20, h: 20 })
    // 图片 = 20mm 的码 + 下方更宽的供人识读文字
    const symbolPx = natural(20)
    const imagePx = symbolPx + 160
    const placement = barcodePlacement(obj, SC, imagePx, symbolPx + 100, symbolPx)

    expect(placement.originY).toBe('top')
    expect(placement.scaleX).toBeCloseTo(SC / BARCODE_PIXELS_PER_MM, 6)
    expect(placement.scaleY).toBeCloseTo(placement.scaleX, 6)
    expect(symbolPx * placement.scaleX).toBeCloseTo(obj.h * SC, 3)
    expect(placement.top).toBeCloseTo(obj.y * SC, 6)
    // 码区水平居中在对象框里（图片比码区宽出来的部分不影响居中）
    const symbolCenter = placement.left + imagePx * placement.scaleX / 2
    expect(symbolCenter).toBeCloseTo((obj.x + obj.w / 2) * SC, 3)
  })

  it('二维码文字在上方时，码区顶部仍钉在对象框顶部', () => {
    const obj = barcodeObject({ symbology: 'qrcode', w: 20, h: 20, barcodeOptions: { humanPosition: 'above' } })
    const symbolPx = natural(20)
    const imageHeight = symbolPx + 80
    const placement = barcodePlacement(obj, SC, symbolPx + 100, imageHeight, symbolPx)
    // 码区在图片底部：图片底边 = 对象框顶部 + 码高
    const imageBottom = placement.top + imageHeight * placement.scaleX
    expect(imageBottom).toBeCloseTo((obj.y + 20) * SC, 3)
  })
})
