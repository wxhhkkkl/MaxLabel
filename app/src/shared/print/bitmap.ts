// ---------- 单色位图编码（纯 TS，无 DOM 依赖，可单测） ----------
// 将行优先 1-bit 位图编码为打印机可消费的格式：
//  - TSPL PUTBMP：1-bit Windows BMP 文件（含文件头）
//  - ZPL ^GFA：ASCII 十六进制行
import type { MonoBitmap } from '../model'

/** 构造 1-bit Windows BMP 文件（TSPL PUTBMP / 通用位图下载用） */
export function monoToBmp(m: MonoBitmap): Uint8Array {
  const pixelBytes = m.bytesPerRow * m.height
  const paletteSize = 8 // 2 色 × 4 字节
  const dataOffset = 14 + 40 + paletteSize
  const fileSize = dataOffset + pixelBytes
  const out = new Uint8Array(fileSize)
  const dv = new DataView(out.buffer)

  // BITMAPFILEHEADER (14)
  out[0] = 0x42 // 'B'
  out[1] = 0x4d // 'M'
  dv.setUint32(2, fileSize, true)
  dv.setUint16(6, 0, true)
  dv.setUint16(8, 0, true)
  dv.setUint32(10, dataOffset, true)

  // BITMAPINFOHEADER (40)
  dv.setUint32(14, 40, true)
  dv.setInt32(18, m.width, true)
  dv.setInt32(22, m.height, true) // 正高度 = 自底向上；打印机会自动处理
  dv.setUint16(26, 1, true) // planes
  dv.setUint16(28, 1, true) // 1 bit
  dv.setUint32(30, 0, true) // no compression
  dv.setUint32(34, pixelBytes, true)
  dv.setInt32(38, 2835, true) // X ppm (~72dpi)
  dv.setInt32(42, 2835, true)
  dv.setUint32(46, 0, true)
  dv.setUint32(50, 0, true)

  // 调色板：0=白, 1=黑
  dv.setUint32(54, 0x00ffffff, true) // RGB(255,255,255) + reserved 0
  dv.setUint32(58, 0x00000000, true) // RGB(0,0,0)

  // 像素数据（逐行复制）
  out.set(m.bytes, dataOffset)
  return out
}

export interface GfaData {
  totalBytes: number
  bytesPerRow: number
  hex: string
}

/** ZPL ^GFA 数据：每行字节数 + 总字节数 + 十六进制（ASCII） */
export function monoToGfa(m: MonoBitmap): GfaData {
  let hex = ''
  for (let y = 0; y < m.height; y++) {
    for (let x = 0; x < m.bytesPerRow; x++) {
      hex += m.bytes[y * m.bytesPerRow + x].toString(16).padStart(2, '0')
    }
  }
  return { totalBytes: m.bytes.length, bytesPerRow: m.bytesPerRow, hex }
}

/** 生成完整 ZPL ^GFA 指令（含 ^FO 定位与 ^FS 结尾） */
export function zplGfaCommand(x: number, y: number, m: MonoBitmap): string {
  const g = monoToGfa(m)
  // ZPL 要求行尾 0 填充到 2 的倍数：bytesPerRow 已是整数，通常为偶数行；若奇数补一个 0 字节在行内
  const bpr = g.bytesPerRow % 2 === 1 ? g.bytesPerRow + 1 : g.bytesPerRow
  const hex = g.hex
  return `^FO${x},${y}^GFA,${g.totalBytes},${g.totalBytes},${bpr},${hex}^FS`
}

/** 简单文本 → 估算条数用：按 8x16 等宽估算（编辑器/预览仅提示用） */
export function estimateTextWidthChars(text: string, fontSizeDot: number, dpi: number): number {
  return Math.max(1, Math.round((fontSizeDot * text.length * 0.55) / (dpi / 25.4)))
}
