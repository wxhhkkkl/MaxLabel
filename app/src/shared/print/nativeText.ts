// 打印用 GDI 文本光栅化：只放与平台无关的判定/换算/落点数学。
// 真正的 GDI 调用在 main/printing/gdiText.ts；渲染层通过这些纯函数决定
// 哪些文本走 GDI 位图、位图贴到哪里。

import type { TextObj } from '../domain/objects'

export const NATIVE_TEXT_MAX_CHARS = 4096
export const NATIVE_TEXT_MAX_FONT_STACK = 512
export const NATIVE_TEXT_MAX_BOX_PX = 32768
export const NATIVE_TEXT_MIN_DPI = 72
export const NATIVE_TEXT_MAX_DPI = 1200
export const NATIVE_TEXT_MIN_PT = 0.5
export const NATIVE_TEXT_MAX_PT = 400
export const NATIVE_TEXT_MIN_LINE_HEIGHT = 0.8
export const NATIVE_TEXT_MAX_LINE_HEIGHT = 4
/**
 * 小字增强的字号上限。203dpi 下 3mm ≈ 24 个打印点。
 */
export const NATIVE_TEXT_SMALL_MM = 3

export interface NativeTextRequest {
  text: string
  /** 模板字体栈，由 GDI 渲染端按文字内容选择字体。 */
  fontFamily: string
  fontWidthScale?: number
  /** Fabric 字符间距，单位为千分之一 em。 */
  charSpacing?: number
  /** 字号（磅）：lsdx/对象模型里存的是毫米，调用方换算。 */
  fontSizePt: number
  dpi: number
  /** 折行框宽（设备像素）；wrap=false 时不参与折行，只用于对齐。 */
  boxWidthPx: number
  /** 是否按 boxWidthPx 折行（单行文本不折行，与 fabric.Text / Textbox 的区分一致）。 */
  wrap: boolean
  /** 折行时的行内对齐（与 fabric.Textbox 的 textAlign 一致）。 */
  textAlign: 'left' | 'center' | 'right'
  /** 行高倍数，与编辑器的 fabric lineHeight 同口径。 */
  lineHeightFactor: number
  bold: boolean
  italic: boolean
  underline: boolean
  strikeout: boolean
}

/** GDI 排版结果：折行后的每一行及其像素宽度，供编辑器复刻同一版式。 */
export interface NativeTextLayout {
  fontFace?: string
  /** Advance box width and the bitmap's left overhang, in device dots. */
  widthPx?: number
  leftOverhangPx?: number
  lines: string[]
  lineWidthsPx: number[]
  /** 字身像素（ppem），编辑器把它换算成字号。 */
  ppem: number
  /** 行间距（像素），编辑器把它换算成 lineHeight。 */
  spacingPx: number
  heightPx: number
}

/** 单色位图（1 bit/像素，行优先、每行按字节对齐），墨迹位为 1。 */
export interface NativeTextBitmap {
  width: number
  height: number
  bytesPerRow: number
  bytes: Uint8Array
  /** 实际折出来的行数（便于诊断与测试）。 */
  lines: number
  layout: NativeTextLayout
}

const CJK_PATTERN = /[⺀-鿿豈-﫿︰-﹏＀-￯]/

export function hasCjk(text: string): boolean {
  return CJK_PATTERN.test(text)
}

/** `Arial, 宋体` → `Arial`；引号与空白剥掉，空串回退 Arial。 */
export function firstFontFamily(stack: string): string {
  const first = (stack ?? '').split(',')[0]?.trim().replace(/^['"]+|['"]+$/g, '').trim()
  return first || 'Arial'
}

const CJK_FAMILY_PATTERN = /[㐀-鿿]|simsun|simhei|simkai|simfang|yahei|kaiti|fangsong|dengxian|noto sans cjk|source han|pingfang|hiragino|jhenghei|nsimsun|msjh|msyh/i

/**
 * GDI / 编辑画布实际使用的字体名：
 * - 纯拉丁文本用字体栈第一项；
 * - 含中文时必须显式指定中文载体字体（宋体），**不能**交给字符集让 GDI 自己挑 ——
 *   客户机上 GDI 可能挑到微软雅黑/黑体，打印明显变粗（与 LabelShop 的宋体不一致）。
 */
export function gdiFontFamily(stack: string, text: string): string {
  if (!hasCjk(text)) return firstFontFamily(stack)
  const cjk = cjkFontFamily(stack)
  return CJK_FAMILY_PATTERN.test(cjk) ? cjk : '宋体'
}

/** 从 CSS 字体栈里挑出承载中文的字体族（GDI 用 GB2312 字符集时实际选中的就是它）。 */
export function cjkFontFamily(stack: string): string {
  const parts = (stack ?? '')
    .split(',')
    .map((part) => part.trim().replace(/^['"]+|['"]+$/g, '').trim())
    .filter(Boolean)
  return parts.find((part) => CJK_FAMILY_PATTERN.test(part)) ?? parts[0] ?? 'Arial'
}

export function ptFromMm(mm: number): number {
  return (mm * 72) / 25.4
}

/**
 * GDI 的 ppem：与原版 LabelShop 一致取**向下取整**。
 * 6pt@203dpi = 16.916 → 16px/字（2.03mm）。实测 .lsdx 里同一行相邻对象的间距就是
 * 2.0mm/字：例如「柿饼不宜…海带」共 15 字，从 2.73mm 起恰好落在下一个对象的
 * 32.73mm。若按四舍五入取 17px，每字多 0.13mm，整行多 2mm，末字就会压到邻框上。
 */
export function gdiPpem(fontSizePt: number, dpi: number): number {
  return Math.max(1, Math.floor((fontSizePt * dpi) / 72))
}

function finitePositive(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0
}

/** IPC 载荷校验：只保留白名单字段，越界一律拒绝。 */
export function validateNativeTextRequest(raw: unknown): NativeTextRequest {
  if (!raw || typeof raw !== 'object') throw new Error('GDI 文本参数无效')
  const value = raw as Record<string, unknown>
  if (typeof value.text !== 'string') throw new Error('GDI 文本内容无效')
  if (value.text.length > NATIVE_TEXT_MAX_CHARS) throw new Error('GDI 文本过长')
  if (typeof value.fontFamily !== 'string' || !value.fontFamily.trim()) throw new Error('GDI 字体名无效')
  if (value.fontFamily.length > NATIVE_TEXT_MAX_FONT_STACK || /[\u0000-\u001f\u007f]/.test(value.fontFamily)) {
    throw new Error('GDI 字体名无效')
  }
  if (!finitePositive(value.fontSizePt) || value.fontSizePt < NATIVE_TEXT_MIN_PT || value.fontSizePt > NATIVE_TEXT_MAX_PT) {
    throw new Error('GDI 字号无效')
  }
  if (!finitePositive(value.dpi) || value.dpi < NATIVE_TEXT_MIN_DPI || value.dpi > NATIVE_TEXT_MAX_DPI) {
    throw new Error('GDI 分辨率无效')
  }
  if (!finitePositive(value.boxWidthPx) || value.boxWidthPx > NATIVE_TEXT_MAX_BOX_PX) {
    throw new Error('GDI 折行宽度无效')
  }
  if (typeof value.wrap !== 'boolean') throw new Error('GDI 折行标志无效')
  if (value.textAlign !== 'left' && value.textAlign !== 'center' && value.textAlign !== 'right') {
    throw new Error('GDI 对齐方式无效')
  }
  const lh = value.lineHeightFactor
  if (typeof lh !== 'number' || !Number.isFinite(lh) || lh < NATIVE_TEXT_MIN_LINE_HEIGHT || lh > NATIVE_TEXT_MAX_LINE_HEIGHT) {
    throw new Error('GDI 行高无效')
  }
  const widthScale = value.fontWidthScale
  if (widthScale !== undefined && (!finitePositive(widthScale) || widthScale < 0.1 || widthScale > 10)) {
    throw new Error('GDI 字宽无效')
  }
  const charSpacing = value.charSpacing
  if (charSpacing !== undefined && (typeof charSpacing !== 'number' || !Number.isFinite(charSpacing) || charSpacing < 0 || charSpacing > 100)) {
    throw new Error('GDI 字距无效')
  }
  return {
    text: value.text,
    fontFamily: value.fontFamily.trim(),
    fontSizePt: value.fontSizePt,
    dpi: value.dpi,
    boxWidthPx: value.boxWidthPx,
    wrap: value.wrap,
    textAlign: value.textAlign,
    lineHeightFactor: lh,
    ...(widthScale === undefined ? {} : { fontWidthScale: widthScale }),
    ...(charSpacing === undefined ? {} : { charSpacing }),
    bold: value.bold === true,
    italic: value.italic === true,
    underline: value.underline === true,
    strikeout: value.strikeout === true
  }
}

function rightAngle(rotation: number): boolean {
  const normalized = ((rotation % 360) + 360) % 360
  return normalized === 0 || normalized === 90 || normalized === 180 || normalized === 270
}

/**
 * 是否适合用 GDI 出图：只接普通横排文本。
 * 弧形/圆形/竖排/反白/底纹/逐字变色/两端对齐保留原有渲染，
 * 位图旋转也只接 90° 倍数（任意角度旋转位图会重采样，反而更糊）。
 */
export function nativeTextEligible(obj: TextObj): boolean {
  if (!obj || obj.type !== 'text') return false
  if (obj.arc || obj.textType === 'circle' || obj.vertical) return false
  if (obj.flipX || obj.flipY) return false
  if (obj.reverse) return false
  if (obj.backgroundColor && obj.backgroundColor !== 'transparent') return false
  if (obj.colorChange) return false
  if (obj.align === 'justify') return false
  if (!finitePositive(obj.fontSize)) return false
  return rightAngle(obj.rotation ?? 0)
}

export function nativeTextApplies(obj: TextObj, text: string): boolean {
  return nativeTextEligible(obj) && text.trim().length > 0
}

export function isSmallPrintText(obj: TextObj, text: string): boolean {
  return finitePositive(obj.fontSize) && obj.fontSize <= NATIVE_TEXT_SMALL_MM && text.trim().length > 0
}

export function nativeTextAppliesSmall(obj: TextObj, text: string): boolean {
  return isSmallPrintText(obj, text) && nativeTextEligible(obj)
}

export function sceneNeedsNativeText(
  primitives: ReadonlyArray<{ kind: string; object: unknown; value?: string }>
): boolean {
  return primitives.some((primitive) => {
    if (primitive.kind !== 'text') return false
    const obj = primitive.object as TextObj
    return nativeTextAppliesSmall(obj, primitive.value ?? '')
  })
}

/**
 * 按宽度折行（纯函数，逐字宽度由调用方注入，与 GDI 的按字推进一致）。
 * 规则：
 * - 先按显式换行拆段；
 * - 每段逐字累加，超宽回退；拉丁词优先在空格处断开；
 * - 单个字符就超宽时独占一行，避免死循环。
 */
export function wrapTextLines(text: string, charWidthPx: (char: string) => number, maxWidthPx: number, gapPx = 0): string[] {
  const lines: string[] = []
  for (const paragraph of text.split(/\r?\n/)) {
    if (!paragraph) {
      lines.push('')
      continue
    }
    if (!(maxWidthPx > 0)) {
      lines.push(paragraph)
      continue
    }
    let current = ''
    let currentWidth = 0
    // 1px 容差：.lsdx 的框是 GDI 紧包围盒，取整误差不该把最后一个字挤到下一行。
    const limit = maxWidthPx + 1
    for (const char of Array.from(paragraph)) {
      const width = charWidthPx(char)
      if (current && currentWidth + gapPx + width > limit) {
        // 拉丁词回退到最后一个空格，避免把单词劈开；中文按字断。
        const space = current.lastIndexOf(' ')
        if (space > 0 && /[A-Za-z0-9,.!?;:'")\]]$/.test(current)) {
          lines.push(current.slice(0, space))
          const rest = current.slice(space + 1)
          current = rest + char
          const restChars = Array.from(rest)
          currentWidth = restChars.reduce((sum, item) => sum + charWidthPx(item), 0) + restChars.length * gapPx + width
        } else {
          lines.push(current)
          current = char
          currentWidth = width
        }
      } else {
        currentWidth += width + (current ? gapPx : 0)
        current += char
      }
    }
    if (current) lines.push(current)
  }
  return lines.length ? lines : ['']
}

/** 位图左上角在页面上的毫米坐标（指令打印的 MonoBitmap 需要绝对原点）。 */
export function nativeTextOriginMm(draw: NativeTextDraw, dpi: number): { xMm: number; yMm: number } {
  const dpm = dpi / 25.4
  return {
    xMm: (draw.anchorXPx - draw.offsetXPx) / dpm,
    yMm: (draw.anchorYPx - draw.offsetYPx) / dpm
  }
}

export interface NativeTextDraw {
  /** 旋转锚点（设备像素，已取整，避免重采样）。 */
  anchorXPx: number
  anchorYPx: number
  /** 位图左上角相对锚点的偏移（设备像素）。 */
  offsetXPx: number
  offsetYPx: number
  angle: number
}

/**
 * 与 fabric 的 origin 语义保持一致：水平按 align 锚在 x / x+w/2 / x+w，
 * 垂直按 verticalAlign 锚在 y / y+h/2 / y+h。位图因此在锚点上按偏移摆放。
 */
export function computeNativeTextDraw(input: {
  object: TextObj
  dpi: number
  widthPx: number
  heightPx: number
  layout?: NativeTextLayout
}): NativeTextDraw {
  const { object, dpi, widthPx, heightPx } = input
  const dpm = dpi / 25.4
  const align = object.align === 'justify' ? 'left' : object.align
  const vAlign = object.verticalAlign ?? 'top'
  const anchorXMm = align === 'center' ? object.x + object.w / 2 : align === 'right' ? object.x + object.w : object.x
  const anchorYMm = vAlign === 'middle' ? object.y + object.h / 2 : vAlign === 'bottom' ? object.y + object.h : object.y
  const layoutWidth = input.layout?.widthPx ?? widthPx
  const offsetX = align === 'center' ? layoutWidth / 2 : align === 'right' ? layoutWidth : 0
  const offsetY = vAlign === 'middle' ? heightPx / 2 : vAlign === 'bottom' ? heightPx : 0
  return {
    anchorXPx: Math.round(anchorXMm * dpm),
    anchorYPx: Math.round(anchorYMm * dpm),
    offsetXPx: Math.round(offsetX) + (input.layout?.leftOverhangPx ?? 0),
    offsetYPx: Math.round(offsetY),
    angle: ((object.rotation ?? 0) % 360 + 360) % 360
  }
}
