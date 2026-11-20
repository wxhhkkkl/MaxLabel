// ---------- 1-bit PCX 编码（PGL / SATO 内联位图） ----------
//
// LabelShop 的 Printronix PGL 与 SATO SBPL 都用 1-bit PCX 传对象位图：
//   - PGL：`~LOGO;<name>;PCX` … `~RASTEREND`
//   - SATO：`<ESC>GP<长度>,<PCX 字节>`
// 这里按 golden 的文件头（版本 5、RLE、1 位、72 dpi、1 平面、调色板 0=黑 1=白）
// 编码，打印点阵与原图一致。

import type { MonoBitmap } from '../domain/units'

const HEADER_SIZE = 128
/** PCX 调色板：索引 0 黑、1 白（与 golden 一致）。 */
function writePalette(header: Uint8Array): void {
  header[16] = 0x00
  header[17] = 0x00
  header[18] = 0x00
  header[19] = 0xff
  header[20] = 0xff
  header[21] = 0xff
}

function writeU16(bytes: Uint8Array, offset: number, value: number): void {
  bytes[offset] = value & 0xff
  bytes[offset + 1] = (value >> 8) & 0xff
}

/**
 * 把 `MonoBitmap`（1 = 墨点）编码成 1-bit PCX。
 *
 * PCX 的位极性相反：0 = 墨、1 = 纸；每行字节数必须是偶数，因此右端补白。
 */
export function encodePcx(bitmap: MonoBitmap): Uint8Array {
  const width = Math.max(1, Math.min(0xffff, bitmap.width))
  const height = Math.max(1, Math.min(0xffff, bitmap.height))
  const sourceBytesPerRow = Math.max(1, bitmap.bytesPerRow)
  const bytesPerLine = sourceBytesPerRow + (sourceBytesPerRow % 2)
  const header = new Uint8Array(HEADER_SIZE)
  header[0] = 0x0a
  header[1] = 0x05
  header[2] = 0x01
  header[3] = 0x01
  writeU16(header, 4, 0)
  writeU16(header, 6, 0)
  writeU16(header, 8, width - 1)
  writeU16(header, 10, height - 1)
  writeU16(header, 12, 72)
  writeU16(header, 14, 72)
  writePalette(header)
  header[65] = 1
  writeU16(header, 66, bytesPerLine)
  header[68] = 1

  const out: number[] = []
  for (let y = 0; y < height; y++) {
    const row: number[] = []
    for (let x = 0; x < bytesPerLine; x++) {
      row.push(x < sourceBytesPerRow ? (~bitmap.bytes[y * sourceBytesPerRow + x] & 0xff) : 0xff)
    }
    // PCX 的 RLE 以扫描行为单位，游程不能跨行。
    let index = 0
    while (index < row.length) {
      const value = row[index]
      let run = 1
      while (index + run < row.length && row[index + run] === value && run < 63) run++
      if (run > 1 || (value & 0xc0) === 0xc0) {
        out.push(0xc0 | run, value)
      } else {
        out.push(value)
      }
      index += run
    }
  }

  const result = new Uint8Array(HEADER_SIZE + out.length)
  result.set(header, 0)
  result.set(out, HEADER_SIZE)
  return result
}
