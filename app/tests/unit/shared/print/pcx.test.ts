import { describe, expect, it } from 'vitest'
import { encodePcx } from '@shared/print/pcx'
import { tinyMono } from '../../../helpers/factories'

function u16(bytes: Uint8Array, offset: number): number {
  return bytes[offset] | (bytes[offset + 1] << 8)
}

describe('1-bit PCX 编码', () => {
  it('writes a 1-bit RLE PCX header like the LabelShop goldens', () => {
    const pcx = encodePcx(tinyMono(16, 8))
    expect([...pcx.slice(0, 4)]).toEqual([0x0a, 0x05, 0x01, 0x01])
    expect(u16(pcx, 8)).toBe(15)
    expect(u16(pcx, 10)).toBe(7)
    expect(u16(pcx, 12)).toBe(72)
    expect(u16(pcx, 14)).toBe(72)
    expect(pcx[65]).toBe(1)
    expect(u16(pcx, 66)).toBe(2)
    expect(pcx[68]).toBe(1)
  })

  it('inverts polarity and pads odd rows to even bytes', () => {
    const pcx = encodePcx(tinyMono(4, 2))
    // 4 点宽 → 1 字节/行，PCX 要求偶数 → 2 字节/行，右端补白（1）。
    expect(u16(pcx, 66)).toBe(2)
    // 全墨点取反为 0x00（单字节原样输出）；右端补白 0xFF 需要转义 → [0xC1, 0xFF]。
    expect([...pcx.slice(128)]).toEqual([0x00, 0xc1, 0xff, 0x00, 0xc1, 0xff])
  })

  it('emits a complete record for runs longer than 63 bytes', () => {
    const pcx = encodePcx(tinyMono(8 * 70, 1))
    // 70 个 0x00 拆成 63 + 7 两个游程。
    expect([...pcx.slice(128)]).toEqual([0xff, 0x00, 0xc7, 0x00])
  })
})
