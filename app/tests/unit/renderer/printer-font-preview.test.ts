import { describe, expect, it } from 'vitest'
import { printerFontMetrics, printerFontPreviewStyle, printerFontSpec } from '@/features/object-properties/printerFontPreview'

/**
 * 打印机内建字体没法在浏览器里还原真实字形：示例区按公开的点阵规格做近似预览。
 * 这里锁定「字库 → 规格」映射和预览缩放，避免不同字库显示成一模一样。
 */
describe('打印机内建字体近似预览', () => {
  it('TSPL Font1-8 返回各自的点阵格宽/格高', () => {
    expect(printerFontMetrics('Font1', 'tspl')).toMatchObject({ widthDots: 8, heightDots: 12 })
    expect(printerFontMetrics('Font5', 'tspl')).toMatchObject({ widthDots: 32, heightDots: 48 })
    expect(printerFontSpec('Font1', 'tspl')).toBe('8×12')
  })

  it('TSPL Font0 是内建 8×12 点阵，与 Font1 同规格', () => {
    expect(printerFontMetrics('Font0', 'tspl')).toMatchObject({ widthDots: 8, heightDots: 12 })
    expect(printerFontPreviewStyle('Font0', 'tspl', 16)).not.toBeNull()
    expect(printerFontSpec('Font0', 'tspl')).toBe('8×12')
  })

  it('ZPL 字母字库按大写匹配，0 是可缩放字体', () => {
    expect(printerFontMetrics('a', 'zpl')).toMatchObject({ widthDots: 5, heightDots: 9 })
    expect(printerFontSpec('X', 'zpl')).toBe('140×140')
    expect(printerFontPreviewStyle('0', 'zpl', 16)).toBeNull()
  })

  it('CPCL / 未知字库没有取证规格：退回对象自身字体，不编造预览', () => {
    expect(printerFontMetrics('Font1', 'cpcl')).toBeNull()
    expect(printerFontPreviewStyle('Font1', undefined, 16)).toBeNull()
  })

  it('预览字号随格高缩放并带上格宽/格高比', () => {
    const preview = printerFontPreviewStyle('Font1', 'tspl', 16)
    expect(preview?.fontSizePx).toBeCloseTo(12, 5)
    expect(preview?.scaleX).toBeCloseTo((8 / 12) / 0.6, 5)
    expect(preview?.fontFamily).toMatch(/monospace/)
    // 大字号字库被夹在预览框能容纳的上限
    expect(printerFontPreviewStyle('Font8', 'tspl', 34)?.fontSizePx).toBeLessThanOrEqual(48)
  })
})
