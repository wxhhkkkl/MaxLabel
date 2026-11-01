import { describe, expect, it } from 'vitest'
import { FONT_SIZE_MAX_PT, clampFontSizePt, formatFontSizePt, PT_TO_MM } from '@/editor/fontSizePt'

describe('字号输入框的磅值规则', () => {
  it('导入的 13pt 显示成 13，不会因为毫米两位小数回显成 13.0x', () => {
    // 模型存毫米：13pt → 4.59mm（两位小数）→ 换算回来是 13.0045pt
    const stored = Math.round(13 * PT_TO_MM * 100) / 100
    expect(formatFontSizePt(stored / PT_TO_MM)).toBe('13')
  })

  it('任意磅值都保留两位：7.88pt 不被四舍五入成 7.9', () => {
    const stored = Math.round(7.88 * PT_TO_MM * 100) / 100
    expect(formatFontSizePt(stored / PT_TO_MM)).toBe('7.88')
  })

  it('接受档位表里没有的值（13 / 7.88）', () => {
    expect(clampFontSizePt('13')).toBe(13)
    expect(clampFontSizePt('7.88')).toBe(7.88)
  })

  it('空值与非法输入不提交', () => {
    expect(clampFontSizePt('')).toBeNull()
    expect(clampFontSizePt('  ')).toBeNull()
    expect(clampFontSizePt('abc')).toBeNull()
    expect(clampFontSizePt('7.8.8')).toBeNull()
  })

  it('越界按模型允许的范围收口', () => {
    expect(clampFontSizePt('0')).toBe(0.5)
    expect(clampFontSizePt('-3')).toBe(0.5)
    expect(clampFontSizePt('99999')).toBe(FONT_SIZE_MAX_PT)
  })
})
