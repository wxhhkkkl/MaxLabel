// 打印用 GDI 文本光栅化（Windows）。
//
// 为什么要 GDI：小字号中文（6pt @203dpi ≈ 17px）在浏览器/Skia 下只有字体轮廓 +
// 抗锯齿，细横画会变成灰色 1px，二值化后断笔；LabelShop 走 GDI，小字号命中字体
// 内嵌点阵/字节码 hinting，边缘是干净的黑白。这里用真正的 GDI（CreateFontW +
// TextOutW，画进 1bpp DIB）复刻同一条渲染链路。
//
// 只暴露 Window 上可用；非 Windows 直接抛错，由渲染层回退 Skia。

import { gdiFontFamily, gdiPpem, nativeTextLineSpacingPx, wrapTextLines, type NativeTextBitmap, type NativeTextRequest } from '../../shared/print/nativeText'

const MAX_PIXELS = 16_000_000

interface Size {
  cx: number
  cy: number
}

interface TextMetrics {
  tmHeight: number
  tmAscent: number
  tmDescent: number
  tmExternalLeading: number
  tmAveCharWidth: number
  tmMaxCharWidth: number
}

interface GdiApi {
  createCompatibleDC: () => number | bigint
  deleteDC: (dc: number | bigint) => boolean
  createDIBSection: (dc: number | bigint, bmi: unknown, usage: number, bits: [unknown], section: number | bigint, offset: number) => number | bigint
  selectObject: (dc: number | bigint, obj: number | bigint) => number | bigint
  deleteObject: (obj: number | bigint) => boolean
  createFont: (request: NativeTextRequest, ppem: number, averageWidth: number) => number | bigint
  setTextColor: (dc: number | bigint, color: number) => number
  setBkMode: (dc: number | bigint, mode: number) => number
  textOut: (dc: number | bigint, x: number, y: number, text: string) => boolean
  spacedTextOut: (dc: number | bigint, x: number, y: number, text: string, advances: number[]) => boolean
  textFace: (dc: number | bigint) => string
  textExtent: (dc: number | bigint, text: string) => Size
  textMetrics: (dc: number | bigint) => TextMetrics
  flush: () => boolean
  decode: (pointer: unknown, length: number) => Uint8Array
  sizeofBITMAPINFO: number
}

let cached: GdiApi | null = null

function loadGdi(): GdiApi {
  if (cached) return cached
  if (process.platform !== 'win32') throw new Error('GDI 文本光栅化仅支持 Windows')
  // 延迟 require：非 Windows 永不加载原生模块。
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const koffi = require('koffi') as typeof import('koffi')
  const gdi32 = koffi.load('gdi32.dll')

  const RGBQUAD = koffi.struct('RGBQUAD', { rgbBlue: 'uint8', rgbGreen: 'uint8', rgbRed: 'uint8', rgbReserved: 'uint8' })
  const BITMAPINFOHEADER = koffi.struct('BITMAPINFOHEADER', {
    biSize: 'uint32', biWidth: 'int32', biHeight: 'int32', biPlanes: 'uint16', biBitCount: 'uint16',
    biCompression: 'uint32', biSizeImage: 'uint32', biXPelsPerMeter: 'int32', biYPelsPerMeter: 'int32',
    biClrUsed: 'uint32', biClrImportant: 'uint32'
  })
  const BITMAPINFO = koffi.struct('BITMAPINFO', { bmiHeader: BITMAPINFOHEADER, bmiColors: koffi.array(RGBQUAD, 2) })
  koffi.struct('SIZE', { cx: 'int32', cy: 'int32' })
  koffi.struct('TEXTMETRICW', {
    tmHeight: 'int32', tmAscent: 'int32', tmDescent: 'int32', tmInternalLeading: 'int32', tmExternalLeading: 'int32',
    tmAveCharWidth: 'int32', tmMaxCharWidth: 'int32', tmWeight: 'int32', tmOverhang: 'int32',
    tmDigitizedAspectX: 'int32', tmDigitizedAspectY: 'int32', tmFirstChar: 'uint16', tmLastChar: 'uint16',
    tmDefaultChar: 'uint16', tmBreakChar: 'uint16', tmItalic: 'uint8', tmUnderlined: 'uint8', tmStruckOut: 'uint8',
    tmPitchAndFamily: 'uint8', tmCharSet: 'uint8'
  })

  const CreateCompatibleDC = gdi32.func('intptr CreateCompatibleDC(intptr)')
  const DeleteDC = gdi32.func('bool DeleteDC(intptr)')
  const CreateDIBSection = gdi32.func('intptr CreateDIBSection(intptr, BITMAPINFO *, uint32, _Out_ void **, intptr, uint32)')
  const SelectObject = gdi32.func('intptr SelectObject(intptr, intptr)')
  const DeleteObject = gdi32.func('bool DeleteObject(intptr)')
  const CreateFontW = gdi32.func('intptr CreateFontW(int32, int32, int32, int32, int32, uint32, uint32, uint32, uint32, uint32, uint32, uint32, uint32, str16)')
  const SetTextColor = gdi32.func('uint32 SetTextColor(intptr, uint32)')
  const SetBkMode = gdi32.func('int32 SetBkMode(intptr, int32)')
  const TextOutW = gdi32.func('bool TextOutW(intptr, int32, int32, str16, int32)')
  const ExtTextOutW = gdi32.func('bool ExtTextOutW(intptr, int32, int32, uint32, void *, str16, uint32, int32 *)')
  const GetTextFaceW = gdi32.func('int32 GetTextFaceW(intptr, int32, void *)')
  const GetTextExtentPoint32W = gdi32.func('bool GetTextExtentPoint32W(intptr, str16, int32, _Out_ SIZE *)')
  const GetTextMetricsW = gdi32.func('bool GetTextMetricsW(intptr, _Out_ TEXTMETRICW *)')
  const GdiFlush = gdi32.func('bool GdiFlush()')

  cached = {
    createCompatibleDC: () => CreateCompatibleDC(0),
    deleteDC: (dc) => DeleteDC(dc),
    createDIBSection: (dc, bmi, usage, bits, section, offset) =>
      CreateDIBSection(dc, bmi as never, usage, bits, section, offset),
    selectObject: (dc, obj) => SelectObject(dc, obj),
    deleteObject: (obj) => DeleteObject(obj),
    createFont: (request, ppem, averageWidth) => CreateFontW(
      -ppem, averageWidth, 0, 0,
      request.bold ? 700 : 400,
      request.italic ? 1 : 0,
      request.underline ? 1 : 0,
      request.strikeout ? 1 : 0,
      // DEFAULT_CHARSET：中文靠 gdiFontFamily 显式指定（宋体），不再让 GDI 按字符集
      // 自己挑字体——客户机上曾挑到更粗的字体，打印明显比 LabelShop 粗。
      1,
      0, 0, 3, 0, // NONANTIALIASED_QUALITY: use the same monochrome mode on each Windows host.
      gdiFontFamily(request.fontFamily, request.text)
    ),
    setTextColor: (dc, color) => SetTextColor(dc, color),
    setBkMode: (dc, mode) => SetBkMode(dc, mode),
    textOut: (dc, x, y, text) => TextOutW(dc, x, y, text, text.length),
    spacedTextOut: (dc, x, y, text, advances) => ExtTextOutW(dc, x, y, 0, null, text, text.length, advances),
    textFace: (dc) => {
      const name = Buffer.alloc(128)
      if (!GetTextFaceW(dc, name.length / 2, name)) return ''
      return name.toString('utf16le').replace(/\0.*$/s, '')
    },
    textExtent: (dc, text) => {
      const size = [{ cx: 0, cy: 0 }]
      GetTextExtentPoint32W(dc, text, text.length, size)
      return size[0]
    },
    textMetrics: (dc) => {
      const metrics = [{}]
      GetTextMetricsW(dc, metrics)
      return metrics[0] as TextMetrics
    },
    flush: () => GdiFlush(),
    decode: (pointer, length) => koffi.decode(pointer as never, 'uint8', length) as Uint8Array,
    sizeofBITMAPINFO: koffi.sizeof(BITMAPINFO)
  }
  return cached
}

function dibRowBytes(width: number): number {
  return ((width + 31) >> 5) << 2
}

/**
 * 把文本按目标分辨率画成 1-bit 位图（墨迹为 1，行优先、自上而下）。
 * 走 GDI 的 CreateFontW/TextOutW，1bpp DIB 保证没有灰度抗锯齿。
 */
export function rasterizeNativeText(request: NativeTextRequest): NativeTextBitmap {
  const api = loadGdi()
  const ppem = gdiPpem(request.fontSizePt, request.dpi)
  const dc = api.createCompatibleDC()
  if (!dc) throw new Error('GDI 设备上下文创建失败')
  let font: number | bigint = 0
  let scaledFont: number | bigint = 0
  let bitmap: number | bigint = 0
  let previousFont: number | bigint = 0
  let previousBitmap: number | bigint = 0
  try {
    font = api.createFont(request, ppem, 0)
    if (!font) throw new Error('GDI 字体创建失败')
    previousFont = api.selectObject(dc, font)
    if (!previousFont) throw new Error('GDI 字体选择失败')
    const widthScale = request.fontWidthScale ?? 1
    if (widthScale !== 1) {
      const naturalWidth = api.textMetrics(dc).tmAveCharWidth
      if (!naturalWidth) throw new Error('GDI 字体度量无效')
      scaledFont = api.createFont(request, ppem, Math.max(1, Math.round(naturalWidth * widthScale)))
      if (!scaledFont || !api.selectObject(dc, scaledFont)) throw new Error('GDI 字体选择失败')
    }
    const fontFace = api.textFace(dc)
    api.setBkMode(dc, 1) // TRANSPARENT
    api.setTextColor(dc, 0x000000) // 调色板 1 = 黑；0 = 白底

    const metrics = api.textMetrics(dc)
    if (!metrics.tmHeight) throw new Error('GDI 字体度量无效')

    const widths = new Map<string, number>()
    const charWidth = (char: string): number => {
      const cachedWidth = widths.get(char)
      if (cachedWidth !== undefined) return cachedWidth
      const width = char ? api.textExtent(dc, char).cx : 0
      widths.set(char, width)
      return width
    }
    const gap = ppem * (request.charSpacing ?? 0) / 1000 * widthScale
    const lineWidth = (line: string) => {
      const chars = Array.from(line)
      return Math.round(chars.reduce((sum, char) => sum + charWidth(char), 0) + Math.max(0, chars.length - 1) * gap)
    }
    const lineWidths: number[] = []

    const lines = request.wrap
      ? wrapTextLines(request.text, charWidth, request.boxWidthPx, gap)
      : request.text.split(/\r?\n/)
    const longest = lines.reduce((max, line) => Math.max(max, lineWidth(line)), 0)
    const layoutWidth = Math.max(1, Math.ceil(request.wrap ? Math.max(request.boxWidthPx, longest) : longest))
    // Glyph bearings can take ink outside the advance box, especially for italic and fallback faces.
    const guard = Math.max(ppem, metrics.tmMaxCharWidth)
    const dibWidth = layoutWidth + 2 * guard
    const spacing = nativeTextLineSpacingPx(ppem, request.lineHeightFactor)
    const height = Math.max(1, spacing * (lines.length - 1) + metrics.tmHeight + 1)
    if (dibWidth * height > MAX_PIXELS) throw new Error('GDI 文本渲染尺寸过大')

    const bytesPerRow = dibRowBytes(dibWidth)
    const bmi = {
      bmiHeader: {
        biSize: 40, biWidth: dibWidth, biHeight: height, biPlanes: 1, biBitCount: 1,
        biCompression: 0, biSizeImage: bytesPerRow * height,
        biXPelsPerMeter: 0, biYPelsPerMeter: 0, biClrUsed: 2, biClrImportant: 2
      },
      // 调色板 0 = 白，1 = 黑；SetTextColor(0) 落在索引 1。
      bmiColors: [
        { rgbBlue: 255, rgbGreen: 255, rgbRed: 255, rgbReserved: 0 },
        { rgbBlue: 0, rgbGreen: 0, rgbRed: 0, rgbReserved: 0 }
      ]
    }
    const bits: [unknown] = [null]
    bitmap = api.createDIBSection(dc, bmi, 0, bits, 0, 0)
    if (!bitmap || !bits[0]) throw new Error('GDI 位图创建失败')
    previousBitmap = api.selectObject(dc, bitmap)
    if (!previousBitmap) throw new Error('GDI 位图选择失败')

    const align = (line: string) => {
      const w = lineWidth(line)
      if (request.wrap) {
        // 折行时按框宽对齐（与 fabric.Textbox 的 textAlign 一致）
        if (request.textAlign === 'center') return Math.max(0, Math.floor((layoutWidth - w) / 2))
        if (request.textAlign === 'right') return Math.max(0, layoutWidth - w)
        return 0
      }
      return 0
    }
    lines.forEach((line, index) => {
      lineWidths.push(lineWidth(line))
      if (!line) return
      const x = guard + align(line)
      const y = index * spacing
      if (gap === 0) {
        if (!api.textOut(dc, x, y, line)) throw new Error('GDI 文本绘制失败')
        return
      }
      const advances: number[] = []
      let advance = 0
      for (const char of line) {
        const next = advance + charWidth(char) + gap
        if (char.length === 2) advances.push(0)
        advances.push(Math.round(next) - Math.round(advance))
        advance = next
      }
      if (!api.spacedTextOut(dc, x, y, line, advances)) throw new Error('GDI 文本绘制失败')
    })
    api.flush()

    const raw = api.decode(bits[0], bytesPerRow * height)
    const hasInk = (row: number, x: number) => raw[row + (x >> 3)] & (0x80 >> (x & 7))
    let left = guard
    let right = guard + layoutWidth
    for (let y = 0; y < height; y++) {
      const row = y * bytesPerRow
      for (let x = 0; x < left; x++) if (hasInk(row, x)) left = x
      for (let x = right; x < dibWidth; x++) if (hasInk(row, x)) right = x + 1
    }
    const width = right - left
    const monoBytesPerRow = Math.ceil(width / 8)
    const bytes = new Uint8Array(monoBytesPerRow * height)
    for (let y = 0; y < height; y++) {
      const sourceRow = (height - 1 - y) * bytesPerRow // DIB 是自下而上
      for (let x = 0; x < width; x++) {
        if (hasInk(sourceRow, x + left)) {
          bytes[y * monoBytesPerRow + (x >> 3)] |= 0x80 >> (x & 7)
        }
      }
    }
    return {
      width,
      height,
      bytesPerRow: monoBytesPerRow,
      bytes,
      lines: lines.length,
      layout: { lines, lineWidthsPx: lineWidths, ppem, spacingPx: spacing, heightPx: height,
        widthPx: layoutWidth, leftOverhangPx: guard - left, ...(fontFace ? { fontFace } : {}) }
    }
  } finally {
    if (previousBitmap) api.selectObject(dc, previousBitmap)
    if (previousFont) api.selectObject(dc, previousFont)
    if (bitmap) api.deleteObject(bitmap)
    if (scaledFont) api.deleteObject(scaledFont)
    if (font) api.deleteObject(font)
    api.deleteDC(dc)
  }
}
