import { describe, expect, it } from 'vitest'
import { dataUrlImageSize, imagePixelSize } from '@shared/print/imageBytes'

function png(width: number, height: number): Uint8Array {
  const bytes = new Uint8Array(33)
  bytes.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], 0)
  bytes.set([0, 0, 0, 13, 0x49, 0x48, 0x44, 0x52], 8)
  new DataView(bytes.buffer).setUint32(16, width)
  new DataView(bytes.buffer).setUint32(20, height)
  return bytes
}

describe('imagePixelSize', () => {
  it('reads PNG/GIF/BMP dimensions', () => {
    expect(imagePixelSize(png(92, 85))).toEqual({ width: 92, height: 85 })

    const gif = new Uint8Array(10)
    gif.set([0x47, 0x49, 0x46, 0x38, 0x39, 0x61], 0)
    new DataView(gif.buffer).setUint16(6, 40, true)
    new DataView(gif.buffer).setUint16(8, 30, true)
    expect(imagePixelSize(gif)).toEqual({ width: 40, height: 30 })

    const bmp = new Uint8Array(26)
    bmp.set([0x42, 0x4d], 0)
    new DataView(bmp.buffer).setInt32(18, 12, true)
    new DataView(bmp.buffer).setInt32(22, -9, true)
    expect(imagePixelSize(bmp)).toEqual({ width: 12, height: 9 })
  })

  it('reads JPEG SOF dimensions', () => {
    const jpeg = new Uint8Array([
      0xff, 0xd8,
      0xff, 0xe0, 0x00, 0x04, 0x00, 0x00,
      0xff, 0xc0, 0x00, 0x11, 0x08, 0x00, 0x55, 0x00, 0x5c, 0x03, 0x01, 0x11, 0x00, 0x02, 0x11, 0x01, 0x03, 0x11, 0x01
    ])
    expect(imagePixelSize(jpeg)).toEqual({ width: 92, height: 85 })
  })

  it('returns null for unknown data and data URLs that are not base64', () => {
    expect(imagePixelSize(new Uint8Array([1, 2, 3]))).toBeNull()
    expect(dataUrlImageSize('data:image/png,notbase64')).toBeNull()
  })
})

describe('dataUrlImageSize', () => {
  it('decodes the base64 payload header', () => {
    const bytes = png(92, 85)
    const base64 = Buffer.from(bytes).toString('base64')
    expect(dataUrlImageSize(`data:image/png;base64,${base64}`)).toEqual({ width: 92, height: 85 })
  })
})
