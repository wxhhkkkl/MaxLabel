import { describe, expect, it } from 'vitest'
import {
  NATIVE_TEXT_MAX_CHARS,
  computeNativeTextDraw,
  firstFontFamily,
  gdiPpem,
  hasCjk,
  nativeTextApplies,
  nativeTextAppliesSmall,
  nativeTextEligible,
  cjkFontFamily,
  nativeTextOriginMm,
  ptFromMm,
  sceneNeedsNativeText,
  validateNativeTextRequest,
  wrapTextLines
} from '@shared/print/nativeText'
import type { TextObj } from '@shared/domain/objects'
import { textObject } from '../../../helpers/color'
import type { ResolvedPrintPrimitive } from '@shared/print/scene'

function text(overrides: Partial<TextObj> = {}): TextObj {
  return textObject({ x: 10, y: 5, w: 40, h: 4, fontFamily: 'Arial, 宋体', fontSize: 6 * 25.4 / 72, ...overrides })
}

describe('字体栈与单位换算', () => {
  it('取字体栈的第一项，去掉引号和空白', () => {
    expect(firstFontFamily('Arial, 宋体')).toBe('Arial')
    expect(firstFontFamily('"Microsoft YaHei", sans-serif')).toBe('Microsoft YaHei')
    expect(firstFontFamily("  '黑体' ,Arial")).toBe('黑体')
    expect(firstFontFamily('')).toBe('Arial')
  })

  it('从字体栈里挑出中文载体字体（GDI 用 GB2312 时实际选中的那一个）', () => {
    expect(cjkFontFamily('Arial, 宋体')).toBe('宋体')
    expect(cjkFontFamily('"Microsoft YaHei", sans-serif')).toBe('Microsoft YaHei')
    expect(cjkFontFamily('黑体')).toBe('黑体')
    expect(cjkFontFamily('Arial')).toBe('Arial')
    expect(cjkFontFamily('')).toBe('Arial')
  })

  it('毫米转磅、磅转设备像素按 LabelShop 的向下取整', () => {
    expect(ptFromMm(25.4)).toBeCloseTo(72, 5)
    expect(gdiPpem(6, 203)).toBe(16)
    expect(gdiPpem(6, 300)).toBe(25)
    expect(gdiPpem(8, 203)).toBe(22)
  })

  it('识别中文与全角字符', () => {
    expect(hasCjk('生产日期：2026')).toBe(true)
    expect(hasCjk('ABC 123')).toBe(false)
  })
})

describe('GDI 文本生效条件', () => {
  it('普通的横排中文文本可以走 GDI', () => {
    expect(nativeTextEligible(text())).toBe(true)
    expect(nativeTextApplies(text(), '本品为初级农产品')).toBe(true)
  })

  it('只有小字号中文走 GDI，大字号继续用矢量渲染', () => {
    expect(nativeTextAppliesSmall(text(), '柿饼')).toBe(true)
    expect(nativeTextAppliesSmall(text({ fontSize: 5 }), '柿饼')).toBe(false)
    expect(nativeTextAppliesSmall(text(), 'ABC 123')).toBe(false)
  })

  it('不含中文的文本不走 GDI（保留现有矢量拉丁字）', () => {
    expect(nativeTextApplies(text(), 'ABC 123')).toBe(false)
  })

  it('弧形/圆形/竖排/反白/逐字变色/字宽缩放/字间距都不走 GDI', () => {
    expect(nativeTextEligible(text({ arc: true }))).toBe(false)
    expect(nativeTextEligible(text({ textType: 'circle' }))).toBe(false)
    expect(nativeTextEligible(text({ vertical: true }))).toBe(false)
    expect(nativeTextEligible(text({ reverse: true }))).toBe(false)
    expect(nativeTextEligible(text({ backgroundColor: '#000000' }))).toBe(false)
    expect(nativeTextEligible(text({ colorChange: { mode: 'cycle', colors: ['#ff0000'], perChar: true } } as never))).toBe(false)
    expect(nativeTextEligible(text({ fontWidthScale: 0.85 }))).toBe(false)
    expect(nativeTextEligible(text({ charSpacing: 2 }))).toBe(false)
    expect(nativeTextEligible(text({ align: 'justify' }))).toBe(false)
  })

  it('只接受 90° 倍数的旋转，任意角度回退矢量', () => {
    expect(nativeTextEligible(text({ rotation: 90 }))).toBe(true)
    expect(nativeTextEligible(text({ rotation: 270 }))).toBe(true)
    expect(nativeTextEligible(text({ rotation: 15 }))).toBe(false)
  })
})

describe('整页是否需要栅格 GDI 文本', () => {
  const primitive = (object: TextObj, value: string) => ({ kind: 'text', object, value, labelIndex: 1 }) as unknown as ResolvedPrintPrimitive

  it('存在小字号中文时才触发栅格页', () => {
    expect(sceneNeedsNativeText([primitive(text(), '柿饼')])).toBe(true)
    expect(sceneNeedsNativeText([primitive(text({ fontSize: 5 }), '柿饼')])).toBe(false)
    expect(sceneNeedsNativeText([primitive(text(), 'ABC')])).toBe(false)
    expect(sceneNeedsNativeText([{ kind: 'rect', object: { type: 'rect' }, labelIndex: 1 } as unknown as ResolvedPrintPrimitive])).toBe(false)
  })
})

describe('GDI 折行', () => {
  const charWidth = (_ch: string) => 10

  it('单行不折行', () => {
    expect(wrapTextLines('柿饼', charWidth, 0)).toEqual(['柿饼'])
    expect(wrapTextLines('柿饼', charWidth, 1000)).toEqual(['柿饼'])
  })

  it('按显式换行拆行', () => {
    expect(wrapTextLines('甲\n乙', charWidth, 1000)).toEqual(['甲', '乙'])
  })

  it('超宽时按宽度折行', () => {
    expect(wrapTextLines('柿饼礼盒', charWidth, 25)).toEqual(['柿饼', '礼盒'])
    expect(wrapTextLines('柿饼礼盒', charWidth, 15)).toEqual(['柿', '饼', '礼', '盒'])
  })

  it('拉丁词优先在空格处断开', () => {
    expect(wrapTextLines('ABC DEF GHI', charWidth, 50)).toEqual(['ABC', 'DEF', 'GHI'])
  })
})

describe('GDI 文本落点', () => {
  it('左对齐/顶对齐按对象左上角定位', () => {
    const plan = computeNativeTextDraw({ object: text({ rotation: 0 }), dpi: 203, widthPx: 40, heightPx: 20 })
    expect(plan).toEqual({ anchorXPx: Math.round(10 * 203 / 25.4), anchorYPx: Math.round(5 * 203 / 25.4), offsetXPx: 0, offsetYPx: 0, angle: 0 })
  })

  it('居中/右对齐与垂直居中/底对齐按锚点偏移', () => {
    const centered = computeNativeTextDraw({ object: text({ align: 'center', verticalAlign: 'middle' }), dpi: 203, widthPx: 40, heightPx: 20 })
    expect(centered.offsetXPx).toBe(20)
    expect(centered.offsetYPx).toBe(10)
    const right = computeNativeTextDraw({ object: text({ align: 'right', verticalAlign: 'bottom' }), dpi: 203, widthPx: 40, heightPx: 20 })
    expect(right.offsetXPx).toBe(40)
    expect(right.offsetYPx).toBe(20)
  })

  it('旋转按对象 rotation 原样传出', () => {
    expect(computeNativeTextDraw({ object: text({ rotation: 90 }), dpi: 203, widthPx: 10, heightPx: 10 }).angle).toBe(90)
  })
})

describe('IPC 载荷校验', () => {
  const ok = {
    text: '柿饼', fontFamily: 'Arial', fontSizePt: 6, dpi: 203,
    boxWidthPx: 300, wrap: true, textAlign: 'left', lineHeightFactor: 1.16,
    bold: false, italic: false, underline: false, strikeout: false
  }

  it('接受合法载荷并补齐布尔默认值', () => {
    expect(validateNativeTextRequest(ok)).toEqual(ok)
    expect(validateNativeTextRequest({ ...ok, bold: undefined })).toMatchObject({ bold: false })
  })

  it('拒绝超长文本、非法字体名、越界 dpi 和框宽', () => {
    expect(() => validateNativeTextRequest({ ...ok, text: 'x'.repeat(NATIVE_TEXT_MAX_CHARS + 1) })).toThrow()
    expect(() => validateNativeTextRequest({ ...ok, text: 42 })).toThrow()
    expect(() => validateNativeTextRequest({ ...ok, fontFamily: 'Arial\u0000' })).toThrow()
    expect(() => validateNativeTextRequest({ ...ok, fontFamily: 'x'.repeat(200) })).toThrow()
    expect(() => validateNativeTextRequest({ ...ok, dpi: 0 })).toThrow()
    expect(() => validateNativeTextRequest({ ...ok, dpi: 5000 })).toThrow()
    expect(() => validateNativeTextRequest({ ...ok, boxWidthPx: 0 })).toThrow()
    expect(() => validateNativeTextRequest({ ...ok, fontSizePt: 0 })).toThrow()
    expect(() => validateNativeTextRequest(null)).toThrow()
  })
})

describe('GDI 位图落点（指令打印用）', () => {
  it('位图原点 = 锚点 − 对齐偏移，换算回毫米', () => {
    const centered = computeNativeTextDraw({ object: text({ align: 'center', verticalAlign: 'middle' }), dpi: 203, widthPx: 40, heightPx: 20 })
    const origin = nativeTextOriginMm(centered, 203)
    const dpm = 203 / 25.4
    expect(origin.xMm).toBeCloseTo((Math.round((10 + 20) * dpm) - 20) / dpm, 5)
    expect(origin.yMm).toBeCloseTo((Math.round((5 + 2) * dpm) - 10) / dpm, 5)
  })

  it('左对齐/顶对齐时原点就是锚点', () => {
    const plan = computeNativeTextDraw({ object: text(), dpi: 203, widthPx: 10, heightPx: 10 })
    expect(nativeTextOriginMm(plan, 203)).toEqual({ xMm: plan.anchorXPx / (203 / 25.4), yMm: plan.anchorYPx / (203 / 25.4) })
  })
})
