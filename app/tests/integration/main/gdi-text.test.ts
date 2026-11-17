import { describe, expect, it } from 'vitest'
import { rasterizeNativeText } from '@main/printing/gdiText'

const winIt = process.platform === 'win32' ? it : it.skip

function inkPixels(bitmap: { width: number; height: number; bytesPerRow: number; bytes: Uint8Array }): number {
  let n = 0
  for (let y = 0; y < bitmap.height; y++) {
    for (let x = 0; x < bitmap.width; x++) {
      if (bitmap.bytes[y * bitmap.bytesPerRow + (x >> 3)] & (0x80 >> (x & 7))) n++
    }
  }
  return n
}

const base = {
  fontFamily: 'Arial',
  fontSizePt: 6,
  dpi: 203,
  boxWidthPx: 480,
  wrap: true, textAlign: 'left' as const,
  lineHeightFactor: 1.16,
  bold: false,
  italic: false,
  underline: false,
  strikeout: false
}

describe('GDI 文本光栅化（Windows 真机）', () => {
  winIt('按 203dpi 6pt 出图，中文经 Arial 字体链接能画出墨迹', () => {
    const bitmap = rasterizeNativeText({ ...base, text: '本品为初级农产品' })
    expect(bitmap.width).toBeGreaterThan(0)
    expect(bitmap.height).toBeGreaterThanOrEqual(17)
    const ink = inkPixels(bitmap)
    const ratio = ink / (bitmap.width * bitmap.height)
    expect(ink).toBeGreaterThan(0)
    expect(ratio).toBeGreaterThan(0.01)
    expect(ratio).toBeLessThan(0.7)
  })

  winIt('1-bit 输出没有灰度：只有 0/1 两个取值', () => {
    const bitmap = rasterizeNativeText({ ...base, text: '柿饼' })
    for (const byte of bitmap.bytes) expect(byte).toBeLessThanOrEqual(0xff)
    expect(bitmap.bytesPerRow).toBe(Math.ceil(bitmap.width / 8))
  })

  winIt('多行按框宽折行，行数增加时高度增加', () => {
    const one = rasterizeNativeText({ ...base, text: '柿饼', boxWidthPx: 480 })
    const two = rasterizeNativeText({ ...base, text: '柿饼', boxWidthPx: 20 })
    expect(two.height).toBeGreaterThan(one.height)
  })

  winIt('黑体与宋体都能出墨迹（字体缺失时由 GDI 回退，不抛错）', () => {
    for (const fontFamily of ['Arial, 宋体', '黑体', 'Definitely Missing Font']) {
      const bitmap = rasterizeNativeText({ ...base, text: '净重：计量称重', fontFamily })
      expect(inkPixels(bitmap)).toBeGreaterThan(0)
    }
  })

  winIt('返回 GDI 折行结果（编辑器复刻版式用）', () => {
    const bitmap = rasterizeNativeText({ ...base, text: '柿饼礼盒', boxWidthPx: 35 })
    expect(bitmap.layout.lines.length).toBeGreaterThan(1)
    expect(bitmap.layout.lines.join('')).toBe('柿饼礼盒')
    expect(bitmap.layout.ppem).toBe(16)
    expect(bitmap.layout.spacingPx).toBeGreaterThanOrEqual(bitmap.layout.ppem)
    expect(bitmap.layout.heightPx).toBe(bitmap.height)
  })

  winIt('空文本返回空位图而不抛错', () => {
    const bitmap = rasterizeNativeText({ ...base, text: '' })
    expect(bitmap.width).toBeGreaterThan(0)
    expect(inkPixels(bitmap)).toBe(0)
  })
  winIt('6pt 中文按 LabelShop 的 16px/字推进：15 字放进设计给定的 240px 不折行', () => {
    const bitmap = rasterizeNativeText({ ...base, text: '柿饼不宜空腹食用，忌与海鲜海带', boxWidthPx: 240 })
    expect(bitmap.lines).toBe(1)
    expect(bitmap.width).toBe(240)
  })

  winIt('8pt 标题按 22px/字推进：8 字放进原版 184px 框不折行', () => {
    const bitmap = rasterizeNativeText({ ...base, text: '本品为初级农产品', fontSizePt: 8, boxWidthPx: 184 })
    expect(bitmap.lines).toBe(1)
    expect(bitmap.width).toBe(184)
  })
})
