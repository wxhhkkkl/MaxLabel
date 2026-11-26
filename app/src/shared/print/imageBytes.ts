/** 按文件头识别图片格式；主进程下载云图片和导入内嵌图片共用。 */
export type SupportedImageMime = 'image/png' | 'image/jpeg' | 'image/gif' | 'image/bmp' | 'image/webp'

export function sniffImageMime(bytes: Uint8Array): SupportedImageMime | null {
  if (bytes.length >= 8 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) return 'image/png'
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'image/jpeg'
  if (bytes.length >= 6 && bytes[0] === 0x47 && bytes[1] === 0x49 && bytes[2] === 0x46) return 'image/gif'
  if (bytes.length >= 2 && bytes[0] === 0x42 && bytes[1] === 0x4d) return 'image/bmp'
  if (bytes.length >= 12 && bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46 &&
    bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50) return 'image/webp'
  return null
}

const JPEG_SOF = new Set([0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf])

function positiveSize(width: number, height: number): { width: number; height: number } | null {
  return width > 0 && height > 0 ? { width, height } : null
}

/**
 * 读取图片的像素尺寸（不依赖 DOM 解码，主进程/渲染进程和测试都能用）。
 * WebP 头部变体多，返回 null，由调用方使用 lsdx 的 srcwidth/srcheight 兜底。
 */
export function imagePixelSize(bytes: Uint8Array): { width: number; height: number } | null {
  const mime = sniffImageMime(bytes)
  if (mime === 'image/png' && bytes.length >= 24) {
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
    return positiveSize(view.getUint32(16), view.getUint32(20))
  }
  if (mime === 'image/gif' && bytes.length >= 10) {
    return positiveSize(bytes[6] | (bytes[7] << 8), bytes[8] | (bytes[9] << 8))
  }
  if (mime === 'image/bmp' && bytes.length >= 26) {
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
    return positiveSize(view.getInt32(18, true), Math.abs(view.getInt32(22, true)))
  }
  if (mime === 'image/jpeg') {
    let index = 2
    while (index + 9 < bytes.length) {
      if (bytes[index] !== 0xff) { index += 1; continue }
      let marker = bytes[index + 1]
      while (marker === 0xff && index + 2 < bytes.length) {
        index += 1
        marker = bytes[index + 1]
      }
      if (marker === 0xd8 || marker === 0xd9 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
        index += 2
        continue
      }
      if (index + 4 > bytes.length) break
      const length = (bytes[index + 2] << 8) | bytes[index + 3]
      if (length < 2 || index + 2 + length > bytes.length) break
      if (JPEG_SOF.has(marker)) {
        return positiveSize((bytes[index + 7] << 8) | bytes[index + 8], (bytes[index + 5] << 8) | bytes[index + 6])
      }
      index += 2 + length
    }
  }
  return null
}

/** 从 data URL 读取像素尺寸；非 base64 data URL 返回 null。 */
export function dataUrlImageSize(dataUrl: string): { width: number; height: number } | null {
  const comma = dataUrl.indexOf(',')
  if (comma < 0) return null
  const meta = dataUrl.slice(0, comma)
  if (!/;base64$/i.test(meta)) return null
  try {
    const binary = atob(dataUrl.slice(comma + 1))
    const bytes = new Uint8Array(binary.length)
    for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index)
    return imagePixelSize(bytes)
  } catch {
    return null
  }
}
