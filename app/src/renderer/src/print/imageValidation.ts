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
