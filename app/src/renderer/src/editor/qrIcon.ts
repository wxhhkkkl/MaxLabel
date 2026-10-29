import type { BarcodeOptions } from '../types'

/** 图标宽度占码宽的百分比：默认 20%，可调 5–40%。 */
export const QR_ICON_DEFAULT_PCT = 20
export const QR_ICON_MIN_PCT = 5
export const QR_ICON_MAX_PCT = 40
/** 上传图片先等比缩到这个边长以内再二值化，避免模板被大图撑大。 */
export const QR_ICON_MAX_PX = 256

/** 只有二维码 / 微型二维码支持中心图标。 */
export function barcodeHasQrIcon(symbology: string, bo?: BarcodeOptions): boolean {
  if (symbology !== 'qrcode' && symbology !== 'microqrcode') return false
  const image = bo?.qrIconImage
  return typeof image === 'string' && image.startsWith('data:image/')
}

/** 图标大小百分比（非法值回落到默认 20，并夹到 5–40）。 */
export function qrIconSizePct(value?: number): number {
  if (value === undefined || !Number.isFinite(value)) return QR_ICON_DEFAULT_PCT
  return Math.min(QR_ICON_MAX_PCT, Math.max(QR_ICON_MIN_PCT, Math.round(value)))
}

/**
 * 中心图标以及它下面白色留白块的边长（像素）。
 * 图标按码宽百分比缩放；「图标区域」的模块数决定白块，白块永远不小于图标，
 * 避免图标压到数据模块上。
 */
export function qrIconGeometry(input: {
  symbolPx: number
  /** 单个模块的像素宽度；没有「图标区域」时可以不给。 */
  modulePx?: number
  /** 「图标区域」留白的模块数，0 = 不留额外白边。 */
  areaModules?: number
  sizePct?: number
}): { iconPx: number; whitePx: number } {
  const symbolPx = Math.max(1, input.symbolPx)
  const iconPx = Math.max(1, Math.round((symbolPx * qrIconSizePct(input.sizePct)) / 100))
  const areaPx = (input.areaModules ?? 0) > 0 && (input.modulePx ?? 0) > 0
    ? Math.round((input.areaModules as number) * (input.modulePx as number))
    : 0
  const whitePx = Math.max(iconPx, Math.min(symbolPx, areaPx))
  return { iconPx, whitePx }
}

/** 二值化：亮像素转为透明、暗像素转为纯黑（白底画在下面一层）。半透明像素先按白底合成。 */
export function binarizeIconPixels(pixels: Uint8ClampedArray, _width: number, _height: number): Uint8ClampedArray {
  const output = new Uint8ClampedArray(pixels.length)
  for (let i = 0; i < pixels.length; i += 4) {
    const alpha = pixels[i + 3] / 255
    const luminance =
      0.299 * (pixels[i] * alpha + 255 * (1 - alpha)) +
      0.587 * (pixels[i + 1] * alpha + 255 * (1 - alpha)) +
      0.114 * (pixels[i + 2] * alpha + 255 * (1 - alpha))
    if (luminance < 128) {
      output[i] = 0
      output[i + 1] = 0
      output[i + 2] = 0
      output[i + 3] = 255
    }
  }
  return output
}

/** data URL / blob URL → 可绘制的图片。 */
export function loadIconImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image()
    image.onload = () => resolve(image)
    image.onerror = () => reject(new Error('图标图片无法解码'))
    image.src = src
  })
}

/** 上传的图片 → 等比缩到 ≤256px、二值化、透明底的 PNG data URL。 */
export async function prepareQrIcon(blob: Blob): Promise<string> {
  const url = URL.createObjectURL(blob)
  try {
    const image = await loadIconImage(url)
    const scale = Math.min(1, QR_ICON_MAX_PX / Math.max(image.naturalWidth || 1, image.naturalHeight || 1))
    const width = Math.max(1, Math.round((image.naturalWidth || 1) * scale))
    const height = Math.max(1, Math.round((image.naturalHeight || 1) * scale))
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const context = canvas.getContext('2d')
    if (!context) throw new Error('无法读取图标')
    context.drawImage(image, 0, 0, width, height)
    const pixels = context.getImageData(0, 0, width, height)
    pixels.data.set(binarizeIconPixels(pixels.data, width, height))
    context.putImageData(pixels, 0, 0)
    return canvas.toDataURL('image/png')
  } finally {
    URL.revokeObjectURL(url)
  }
}
