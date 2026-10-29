import { describe, expect, it } from 'vitest'
import {
  barcodeHasQrIcon,
  binarizeIconPixels,
  qrIconGeometry,
  qrIconSizePct
} from '@/editor/qrIcon'

describe('二维码中心图标', () => {
  it('只对二维码 / 微型二维码生效', () => {
    const bo = { qrIconImage: 'data:image/png;base64,AA==' }
    expect(barcodeHasQrIcon('qrcode', bo)).toBe(true)
    expect(barcodeHasQrIcon('microqrcode', bo)).toBe(true)
    expect(barcodeHasQrIcon('datamatrix', bo)).toBe(false)
    expect(barcodeHasQrIcon('qrcode', {})).toBe(false)
  })

  it('图标大小夹在 5–40%，默认 20%', () => {
    expect(qrIconSizePct(undefined)).toBe(20)
    expect(qrIconSizePct(3)).toBe(5)
    expect(qrIconSizePct(60)).toBe(40)
    expect(qrIconSizePct(25)).toBe(25)
  })

  it('按码宽百分比算图标尺寸，留白至少覆盖图标', () => {
    // 210px 码、20% → 42px；没有图标区域时白块就是图标大小
    expect(qrIconGeometry({ symbolPx: 210, sizePct: 20 })).toEqual({ iconPx: 42, whitePx: 42 })
    // 5 个模块 × 10px = 50px 留白，比图标大 → 用留白
    expect(qrIconGeometry({ symbolPx: 210, modulePx: 10, areaModules: 5, sizePct: 20 })).toEqual({ iconPx: 42, whitePx: 50 })
    // 图标区域小于图标 → 白块跟着图标放大，避免图标压到数据模块
    expect(qrIconGeometry({ symbolPx: 210, modulePx: 10, areaModules: 2, sizePct: 20 })).toEqual({ iconPx: 42, whitePx: 42 })
  })

  it('二值化：亮像素透明、暗像素纯黑', () => {
    const white = new Uint8ClampedArray([255, 255, 255, 255])
    const black = new Uint8ClampedArray([10, 10, 10, 255])
    const pixels = new Uint8ClampedArray([...white, ...black])
    const out = binarizeIconPixels(pixels, 2, 1)
    expect([...out.slice(0, 4)]).toEqual([0, 0, 0, 0])
    expect([...out.slice(4, 8)]).toEqual([0, 0, 0, 255])
  })

  it('半透明像素先按白底合成再二值化', () => {
    // 25% 黑叠白底 ≈ 191 → 亮 → 透明
    expect([...binarizeIconPixels(new Uint8ClampedArray([0, 0, 0, 64]), 1, 1)]).toEqual([0, 0, 0, 0])
    // 90% 黑叠白底 ≈ 25 → 暗 → 黑
    expect([...binarizeIconPixels(new Uint8ClampedArray([0, 0, 0, 230]), 1, 1)]).toEqual([0, 0, 0, 255])
  })
})
