const MAX_IMAGE_BYTES = 32 * 1024 * 1024
import { MAX_IMAGE_DECOMPRESSED_BYTES, MAX_IMAGE_PIXELS } from '../../../shared/print/limits'
const ALLOWED_IMAGE_TYPES = new Set(['image/png', 'image/jpeg', 'image/gif', 'image/webp', 'image/bmp'])

/** Read an embedded image only after validating both compressed and decoded size. */
export async function readValidatedImageFile(file: File): Promise<string> {
  if (!ALLOWED_IMAGE_TYPES.has(file.type) || file.size > MAX_IMAGE_BYTES || file.size > MAX_IMAGE_DECOMPRESSED_BYTES) {
    throw new Error('仅支持 PNG/JPG/GIF/WEBP/BMP 图片，且大小不能超过 32 MB')
  }
  const src = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result ?? ''))
    reader.onerror = () => reject(new Error('无法读取图片文件'))
    reader.readAsDataURL(file)
  })
  await validateImageDataUrl(src)
  return src
}

export async function validateImageDataUrl(src: string): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const probe = new Image()
    probe.onload = () => {
      if (probe.naturalWidth <= 0 || probe.naturalHeight <= 0) reject(new Error('图片尺寸无效'))
      else if (probe.naturalWidth * probe.naturalHeight > MAX_IMAGE_PIXELS) reject(new Error('图片像素尺寸过大（最大 4000 万像素）'))
      else resolve()
    }
    probe.onerror = () => reject(new Error('图片内容无法解码'))
    probe.src = src
  })
}

/**
 * 帮助 color_main.html：「图片只有单色的黑白图片支持可变颜色」。
 * 真正解码位图后统计非透明像素里的不同颜色数：≤2 视为单色黑白（黑/白或黑/透明）。
 * 采样上限 128×128，避免大图卡住属性对话框。
 * 返回 'mono' | 'color' | 'unknown'（unknown=无法解码，调用方按保守策略处理）。
 */
export async function detectMonochrome(src: string): Promise<'mono' | 'color' | 'unknown'> {
  if (!src) return 'unknown'
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const probe = new Image()
      probe.onload = () => resolve(probe)
      probe.onerror = () => reject(new Error('图片内容无法解码'))
      probe.src = src
    })
    const w = Math.max(1, Math.min(128, img.naturalWidth))
    const h = Math.max(1, Math.min(128, img.naturalHeight))
    const canvas = document.createElement('canvas')
    canvas.width = w
    canvas.height = h
    const ctx = canvas.getContext('2d')
    if (!ctx) return 'unknown'
    ctx.drawImage(img, 0, 0, w, h)
    const data = ctx.getImageData(0, 0, w, h).data
    const seen = new Set<number>()
    for (let i = 0; i < data.length; i += 4) {
      if (data[i + 3] < 8) continue // 全透明像素不参与判定
      seen.add((data[i] << 16) | (data[i + 1] << 8) | data[i + 2])
      if (seen.size > 2) return 'color'
    }
    return 'mono'
  } catch {
    return 'unknown'
  }
}
