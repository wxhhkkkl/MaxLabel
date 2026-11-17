// 打印路径的 GDI 文本位图：把文本对象交给主进程用 Windows GDI 画成 1-bit 位图，
// 渲染层着色后贴到打印页上（只用于打印，编辑器/预览仍走 fabric）。
//
// 任何失败（非 Windows、IPC 失败、参数超限）都静默回退 fabric，绝不阻塞打印。

import type { TextObj } from '../../../shared/domain/objects'
import type { NativeTextRequest } from '../../../shared/print/nativeText'
import { computeNativeTextDraw, firstFontFamily, nativeTextAppliesSmall, nativeTextOriginMm, ptFromMm, type NativeTextDraw, type NativeTextLayout } from '../../../shared/print/nativeText'

import { OPTIONS_STORAGE_KEY } from '../features/shell/optionsStorage'

let disabled = false

export function nativeTextPrintEnabled(): boolean {
  if (disabled) return false
  if (typeof window === 'undefined') return false
  // GDI 只在 Windows 存在；其他平台保持原有矢量打印（避免白白退化成栅格页）。
  if (typeof navigator === 'undefined' || !/Windows/i.test(navigator.userAgent)) return false
  if (typeof window.maxlabel?.nativeTextRasterize !== 'function') return false
  // 系统设置 → 打印和数据库 → 「小字清晰打印（GDI）」，默认关闭。
  try {
    const raw = window.localStorage.getItem(OPTIONS_STORAGE_KEY)
    if (!raw) return false
    return (JSON.parse(raw) as { gdiText?: unknown }).gdiText === true
  } catch {
    // 无源文档（about:blank / sandbox）读不到 localStorage：按开启处理，
    // 让 harness 等无 origin 的渲染进程也能走真实 GDI 路径。应用窗口里不受影响。
    return true
  }
}

export function disableNativeText(): void {
  disabled = true
}

/** 与 fabricObjects 的 lineHeight 口径一致。 */
export function nativeTextLineHeightFactor(obj: TextObj): number {
  if (obj.lineSpacingMm !== undefined) {
    return (obj.fontSize + Math.max(0, obj.lineSpacingMm)) / Math.max(0.1, obj.fontSize)
  }
  return obj.lineSpacing ?? (obj.vertical ? 1 : 1.16)
}

function parseColor(color: string | undefined): [number, number, number] {
  const value = (color ?? '').trim()
  const short = /^#([0-9a-f]{3})$/i.exec(value)
  if (short) {
    const [r, g, b] = short[1].split('')
    return [parseInt(r + r, 16), parseInt(g + g, 16), parseInt(b + b, 16)]
  }
  const full = /^#([0-9a-f]{6})$/i.exec(value)
  if (full) {
    const n = parseInt(full[1], 16)
    return [(n >> 16) & 0xff, (n >> 8) & 0xff, n & 0xff]
  }
  return [0, 0, 0]
}

function decodeBase64(value: string): Uint8Array {
  const binary = atob(value)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return bytes
}

function buildRequest(obj: TextObj, text: string, dpi: number): NativeTextRequest {
  const dpm = dpi / 25.4
  const multiline = obj.textType === 'multi' || obj.lineWidth !== undefined
  return {
    text,
    fontFamily: firstFontFamily(obj.fontFamily),
    fontSizePt: ptFromMm(obj.fontSize),
    dpi,
    boxWidthPx: Math.max(1, Math.round((obj.lineWidth ?? obj.w) * dpm)),
    wrap: multiline,
    textAlign: obj.align === 'center' ? 'center' : obj.align === 'right' ? 'right' : 'left',
    lineHeightFactor: nativeTextLineHeightFactor(obj),
    bold: obj.bold === true,
    italic: obj.italic === true,
    underline: obj.underline === true,
    strikeout: obj.strikeout === true
  }
}

export interface NativeTextImage {
  canvas: HTMLCanvasElement
  draw: NativeTextDraw
}

/** 指令打印（TSPL/ZPL/CPCL）用的单色位图 + 绝对原点。 */
export interface NativeTextMonoBitmap {
  width: number
  height: number
  bytesPerRow: number
  bytes: Uint8Array
  originXMm: number
  originYMm: number
}

/**
 * 指令打印路径：把文本对象直接转成 1-bit 位图（不再经过 canvas 阈值化）。
 * 位图不带旋转；90° 倍数留给 Skia 原路径，避免位图旋转重采样。
 */
export async function rasterizeTextMonoForPrint(obj: TextObj, text: string, dpi: number): Promise<NativeTextMonoBitmap | null> {
  if (!nativeTextPrintEnabled()) return null
  if (!nativeTextAppliesSmall(obj, text)) return null
  const rotation = (((obj.rotation ?? 0) % 360) + 360) % 360
  if (rotation !== 0) return null
  try {
    const result = await window.maxlabel.nativeTextRasterize(buildRequest(obj, text, dpi))
    if (!result.ok || !result.bytes || !result.width || !result.height || !result.bytesPerRow) return null
    const draw = computeNativeTextDraw({ object: obj, dpi, widthPx: result.width, heightPx: result.height })
    const origin = nativeTextOriginMm(draw, dpi)
    return {
      width: result.width,
      height: result.height,
      bytesPerRow: result.bytesPerRow,
      bytes: decodeBase64(result.bytes),
      originXMm: origin.xMm,
      originYMm: origin.yMm
    }
  } catch {
    disableNativeText()
    return null
  }
}

function bitmapToCanvas(
  result: { ok?: boolean; width?: number; height?: number; bytesPerRow?: number; bytes?: string },
  color: string | undefined
): HTMLCanvasElement | null {
  if (!result.ok || !result.bytes || !result.width || !result.height || !result.bytesPerRow) return null
  const bytes = decodeBase64(result.bytes)
  const width = result.width
  const height = result.height
  const bytesPerRow = result.bytesPerRow
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const context = canvas.getContext('2d')
  if (!context) return null
  const image = context.createImageData(width, height)
  const [r, g, b] = parseColor(color)
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (bytes[y * bytesPerRow + (x >> 3)] & (0x80 >> (x & 7))) {
        const offset = (y * width + x) * 4
        image.data[offset] = r
        image.data[offset + 1] = g
        image.data[offset + 2] = b
        image.data[offset + 3] = 255
      }
    }
  }
  context.putImageData(image, 0, 0)
  return canvas
}

/**
 * 把文本对象渲染成可贴到打印页上的位图；不适用/失败时返回 null。
 * 这里只负责取图与着色，是否该走 GDI 由调用方用 nativeTextApplies 判定。
 */
export async function rasterizeTextForPrint(obj: TextObj, text: string, dpi: number): Promise<NativeTextImage | null> {
  if (!nativeTextPrintEnabled()) return null
  try {
    const result = await window.maxlabel.nativeTextRasterize(buildRequest(obj, text, dpi))
    if (!result.ok || !result.width || !result.height) return null
    const canvas = bitmapToCanvas(result, obj.color)
    if (!canvas) return null
    return { canvas, draw: computeNativeTextDraw({ object: obj, dpi, widthPx: result.width, heightPx: result.height }) }
  } catch {
    // 一次失败后不再重试，避免每个文本对象都等一次 IPC 往返。
    disableNativeText()
    return null
  }
}

/**
 * 编辑画布默认按打印机的 dpi 量版式：只有 dpi 相同，GDI 的 ppem 取整才和打印一致
 * （6pt 在 203dpi 是 16px，在 406dpi 是 33px 而不是 32px，物理字宽会差 3%）。
 */
export const EDITOR_TEXT_FALLBACK_DPI = 203

const layoutCache = new Map<string, Promise<EditorTextLayout | null>>()
const EDITOR_CACHE_LIMIT = 256

export interface EditorTextLayout extends NativeTextLayout {
  dpi: number
}

/**
 * 编辑画布用的 GDI 版式（折行结果 + 每行像素宽 + ppem/行距）。编辑器据此用矢量文字
 * 复刻同一版式：屏幕上字是平滑的，但位置、折行、字宽与打印逐行一致。
 * 结果按请求缓存，文档重建（拖动、属性修改、重绘）复用同一份版式。
 */
export function layoutTextForEditor(obj: TextObj, text: string, dpi = EDITOR_TEXT_FALLBACK_DPI): Promise<EditorTextLayout | null> {
  if (!nativeTextPrintEnabled()) return Promise.resolve(null)
  if (!nativeTextAppliesSmall(obj, text)) return Promise.resolve(null)
  const request = buildRequest(obj, text, dpi)
  const key = JSON.stringify(request)
  const cached = layoutCache.get(key)
  if (cached) return cached
  const task = (async (): Promise<EditorTextLayout | null> => {
    try {
      const result = await window.maxlabel.nativeTextRasterize(request)
      if (!result.ok || !result.layout) return null
      return { ...result.layout, dpi }
    } catch {
      disableNativeText()
      return null
    }
  })()
  layoutCache.set(key, task)
  if (layoutCache.size > EDITOR_CACHE_LIMIT) {
    const oldest = layoutCache.keys().next().value
    if (oldest !== undefined) layoutCache.delete(oldest)
  }
  return task
}
