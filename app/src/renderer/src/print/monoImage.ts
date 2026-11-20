const BAYER_4 = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5]

/** Quantize the composited page, leaving foreground-only text and line pixels to the normal threshold. */
export function ditherImagePixels(data: Uint8ClampedArray, width: number, originX: number, originY: number, coverage?: Uint8ClampedArray): void {
  for (let offset = 0; offset < data.length; offset += 4) {
    if (coverage && coverage[offset + 3] === 0) continue
    const index = offset / 4
    const x = originX + index % width
    const y = originY + Math.floor(index / width)
    const threshold = (BAYER_4[(y & 3) * 4 + (x & 3)] + 0.5) * 16
    const luma = 0.299 * data[offset] + 0.587 * data[offset + 1] + 0.114 * data[offset + 2]
    const color = luma < threshold ? 0 : 255
    data[offset] = data[offset + 1] = data[offset + 2] = color
  }
}
