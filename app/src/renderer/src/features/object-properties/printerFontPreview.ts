import type { CommandSet } from '../../../../shared/domain/printer'

/**
 * 打印机内建字库的近似预览。
 *
 * 程序里没有打印机 ROM 字库的点阵数据，浏览器无法还原真实字形；这里按各字库公开的
 * 「点阵格宽 × 格高」做近似：用等宽字体、按格高缩放字号、按格宽/格高比拉伸，
 * 让不同字库在「示例」里至少有可区分的字号与宽高比。真实效果以打印机为准。
 */
export interface PrinterFontMetrics {
  /** 点阵格宽（打印机 dot） */
  widthDots: number
  /** 点阵格高（打印机 dot） */
  heightDots: number
  /** TrueType / 可缩放字库：按对象字号显示，不做点阵近似 */
  scalable?: boolean
}

const TSPL_METRICS: Record<string, PrinterFontMetrics> = {
  Font0: { widthDots: 0, heightDots: 0, scalable: true },
  Font1: { widthDots: 8, heightDots: 12 },
  Font2: { widthDots: 12, heightDots: 20 },
  Font3: { widthDots: 16, heightDots: 24 },
  Font4: { widthDots: 24, heightDots: 32 },
  Font5: { widthDots: 32, heightDots: 48 },
  Font6: { widthDots: 14, heightDots: 19 },
  Font7: { widthDots: 21, heightDots: 27 },
  Font8: { widthDots: 28, heightDots: 36 }
}

// ZPL 字库规格：格宽 × 格高（dot）。'0' 是可缩放字体，与 TrueType 同口径。
const ZPL_METRICS: Record<string, PrinterFontMetrics> = {
  A: { widthDots: 5, heightDots: 9 },
  B: { widthDots: 7, heightDots: 11 },
  C: { widthDots: 10, heightDots: 18 },
  D: { widthDots: 10, heightDots: 18 },
  E: { widthDots: 15, heightDots: 28 },
  F: { widthDots: 13, heightDots: 26 },
  G: { widthDots: 40, heightDots: 60 },
  H: { widthDots: 22, heightDots: 34 },
  I: { widthDots: 10, heightDots: 24 },
  J: { widthDots: 15, heightDots: 24 },
  K: { widthDots: 20, heightDots: 42 },
  L: { widthDots: 28, heightDots: 42 },
  M: { widthDots: 39, heightDots: 48 },
  N: { widthDots: 28, heightDots: 48 },
  O: { widthDots: 28, heightDots: 72 },
  P: { widthDots: 42, heightDots: 72 },
  Q: { widthDots: 42, heightDots: 72 },
  R: { widthDots: 70, heightDots: 105 },
  S: { widthDots: 70, heightDots: 105 },
  T: { widthDots: 31, heightDots: 42 },
  U: { widthDots: 40, heightDots: 52 },
  V: { widthDots: 53, heightDots: 72 },
  W: { widthDots: 105, heightDots: 105 },
  X: { widthDots: 140, heightDots: 140 },
  Y: { widthDots: 140, heightDots: 105 },
  Z: { widthDots: 140, heightDots: 140 },
  '0': { widthDots: 0, heightDots: 0, scalable: true }
}

/** 等宽近似字体：打印机点阵字库基本都是等宽的。 */
const MONO_FONT_STACK = 'Consolas, "Courier New", monospace'
/** 以 16 dot 格高为基准（与 TSPL 指令里的字号换算口径一致）。 */
const BASE_HEIGHT_DOTS = 16
/** 等宽字体的大致字符宽高比，用来把字库的格宽/格高比换算成横向拉伸。 */
const MONO_ASPECT = 0.6

/** 当前驱动下该字库的点阵规格；未知字库 / CPCL（规格未取证）返回 null。 */
export function printerFontMetrics(font: string | undefined, driver: CommandSet | undefined): PrinterFontMetrics | null {
  if (!font) return null
  if (driver === 'tspl') return TSPL_METRICS[font] ?? null
  if (driver === 'zpl') return ZPL_METRICS[font.toUpperCase()] ?? null
  return null
}

/** 下拉里跟在字库名后的规格，例如 `Font1 (8×12)`；可缩放字库返回 null。 */
export function printerFontSpec(font: string, driver: CommandSet | undefined): string | null {
  const metrics = printerFontMetrics(font, driver)
  if (!metrics || metrics.scalable) return null
  return `${metrics.widthDots}×${metrics.heightDots}`
}

export interface PrinterFontPreview {
  fontFamily: string
  fontSizePx: number
  /** 相对对象字号的水平拉伸，用来近似字库的格宽/格高比。 */
  scaleX: number
}

/**
 * 「示例」区的近似预览样式；不是点阵字库（Font0 / ZPL 0 / 未知字库）时返回 null，
 * 调用方继续用对象自身的字体显示。
 */
export function printerFontPreviewStyle(
  font: string | undefined,
  driver: CommandSet | undefined,
  baseFontPx: number
): PrinterFontPreview | null {
  const metrics = printerFontMetrics(font, driver)
  if (!metrics || metrics.scalable) return null
  const fontSizePx = Math.max(10, Math.min(48, baseFontPx * metrics.heightDots / BASE_HEIGHT_DOTS))
  return {
    fontFamily: MONO_FONT_STACK,
    fontSizePx,
    scaleX: (metrics.widthDots / metrics.heightDots) / MONO_ASPECT
  }
}
