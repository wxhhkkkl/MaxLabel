// 打印路径的 GDI 文本位图：把文本对象交给主进程用 Windows GDI 画成 1-bit 位图，
// 渲染层着色后贴到打印页上（只用于打印，编辑器/预览仍走 fabric）。
//
import type { TextObj } from '../../../shared/domain/objects'
import type { NativeTextRasterResult } from '../../../shared/ipcContract'
import { computeNativeTextDraw, isSmallPrintText, nativeTextAppliesSmall, nativeTextOriginMm, ptFromMm, type NativeTextDraw, type NativeTextLayout, type NativeTextRequest } from '../../../shared/print/nativeText'

import { OPTIONS_STORAGE_KEY } from '../features/shell/optionsStorage'

export const GDI_RENDER_FALLBACK = '部分小字的 GDI 渲染失败，已使用普通渲染'
const GDI_STYLE_FALLBACK = '部分小字的样式不支持 GDI，已使用普通渲染'
const GDI_UNAVAILABLE = '当前环境无法使用 GDI 小字增强，已使用普通渲染'

export function nativeTextPrintRequested(): boolean {
  if (typeof window === 'undefined') return false
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

function nativeTextAvailable(): boolean {
  return typeof navigator !== 'undefined' && /Windows/i.test(navigator.userAgent) &&
    typeof window.maxlabel?.nativeTextRasterize === 'function'
}

export function nativeTextPrintEnabled(): boolean {
  return nativeTextPrintRequested() && nativeTextAvailable()
}

/** 与 fabricObjects 的 lineHeight 口径一致。 */
export function nativeTextLineHeightFactor(obj: TextObj): number {
  if (obj.lineSpacingMm !== undefined) {
    return (obj.fontSize + Math.max(0, obj.lineSpacingMm)) / Math.max(0.1, obj.fontSize)
  }
  return obj.lineSpacing ?? (obj.vertical ? 1 : 1.16)
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
    fontFamily: obj.fontFamily.trim() || 'Arial',
    fontWidthScale: obj.fontWidthScale,
    charSpacing: obj.charSpacing,
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

async function requestPrintText(obj: TextObj, text: string, dpi: number, warn?: (message: string) => void): Promise<NativeTextRasterResult | null> {
  if (!nativeTextPrintRequested() || !isSmallPrintText(obj, text)) return null
  if (!nativeTextAvailable()) {
    warn?.(GDI_UNAVAILABLE)
    return null
  }
  if (!nativeTextAppliesSmall(obj, text)) {
    warn?.(GDI_STYLE_FALLBACK)
    return null
  }
  try {
    const result = await window.maxlabel.nativeTextRasterize(buildRequest(obj, text, dpi))
    if (result.ok && result.width && result.height && result.bytesPerRow && result.bytes) return result
  } catch {
    // A single failed IPC must not disable native text for subsequent objects or jobs.
  }
  warn?.(GDI_RENDER_FALLBACK)
  return null
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
 * 指令打印的正交旋转由整页合成处理。
 */
export async function rasterizeTextMonoForPrint(obj: TextObj, text: string, dpi: number, warn?: (message: string) => void): Promise<NativeTextMonoBitmap | null> {
  if (nativeTextAppliesSmall(obj, text) && (obj.rotation ?? 0) % 360 !== 0) return null
  const result = await requestPrintText(obj, text, dpi, warn)
  if (!result?.bytes || !result.width || !result.height || !result.bytesPerRow) return null
  try {
    const draw = computeNativeTextDraw({ object: obj, dpi, widthPx: result.width, heightPx: result.height, layout: result.layout })
    const cropX = Math.max(0, draw.offsetXPx - draw.anchorXPx)
    const cropY = Math.max(0, draw.offsetYPx - draw.anchorYPx)
    const source = decodeBase64(result.bytes)
    const origin = nativeTextOriginMm(draw, dpi)
    if (cropX || cropY) {
      const width = Math.max(1, result.width - cropX)
      const height = Math.max(1, result.height - cropY)
      const bytesPerRow = Math.ceil(width / 8)
      const bytes = new Uint8Array(bytesPerRow * height)
      for (let y = cropY; y < result.height; y++) {
        for (let x = cropX; x < result.width; x++) {
          if (!(source[y * result.bytesPerRow + (x >> 3)] & (0x80 >> (x & 7)))) continue
          const px = x - cropX
          bytes[(y - cropY) * bytesPerRow + (px >> 3)] |= 0x80 >> (px & 7)
        }
      }
      return { width, height, bytesPerRow, bytes, originXMm: Math.max(0, origin.xMm), originYMm: Math.max(0, origin.yMm) }
    }
    return {
      width: result.width,
      height: result.height,
      bytesPerRow: result.bytesPerRow,
      bytes: source,
      originXMm: origin.xMm,
      originYMm: origin.yMm
    }
  } catch {
    warn?.(GDI_RENDER_FALLBACK)
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
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (bytes[y * bytesPerRow + (x >> 3)] & (0x80 >> (x & 7))) {
        const offset = (y * width + x) * 4
        image.data[offset + 3] = 255
      }
    }
  }
  context.putImageData(image, 0, 0)
  context.globalCompositeOperation = 'source-in'
  context.fillStyle = color ?? '#000'
  context.fillRect(0, 0, width, height)
  context.globalCompositeOperation = 'source-over'
  return canvas
}

/**
 * 把文本对象渲染成可贴到打印页上的位图；不适用/失败时返回 null。
 * 这里只负责取图与着色，是否该走 GDI 由调用方用 nativeTextApplies 判定。
 */
export async function rasterizeTextForPrint(obj: TextObj, text: string, dpi: number, warn?: (message: string) => void): Promise<NativeTextImage | null> {
  const result = await requestPrintText(obj, text, dpi, warn)
  if (!result?.width || !result.height) return null
  try {
    const canvas = bitmapToCanvas(result, obj.color)
    if (canvas) return { canvas, draw: computeNativeTextDraw({ object: obj, dpi, widthPx: result.width, heightPx: result.height, layout: result.layout }) }
  } catch {
    // Keep printing with the original renderer if the bitmap cannot be decoded.
  }
  warn?.(GDI_RENDER_FALLBACK)
  return null
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
      return null
    }
  })()
  layoutCache.set(key, task)
  void task.then((layout) => {
    if (!layout && layoutCache.get(key) === task) layoutCache.delete(key)
  })
  if (layoutCache.size > EDITOR_CACHE_LIMIT) {
    const oldest = layoutCache.keys().next().value
    if (oldest !== undefined) layoutCache.delete(oldest)
  }
  return task
}
