import { renderLabelSvg } from '../../../src/renderer/src/print/renderLabelSvg'
import { renderDriverPage } from '../../../src/renderer/src/print/driverPage'
import { barcodeToSvgFragment } from '../../../src/renderer/src/print/vectorBarcode'
import { validateDriverSvgPage } from '../../../src/shared/print/driverSvg'
import { renderBarcodeCanvasAtDpi } from '../../../src/renderer/src/editor/barcode'
import { prepareBitmapsForScene } from '../../../src/renderer/src/print/bitmapSource'
import { renderLabel, resolveOutputScene } from '../../../src/renderer/src/print/renderLabel'
import { rasterizeTextForPrint } from '../../../src/renderer/src/print/nativeText'
import { OPTIONS_STORAGE_KEY } from '../../../src/renderer/src/features/shell/optionsStorage'
import { defaultPrinterConfig } from '../../../src/shared/domain/printer'
import type { LabelDoc } from '../../../src/shared/domain/document'
import type { BarcodeObj, TextObj } from '../../../src/shared/domain/objects'

const text: TextObj = {
  id: 'text',
  type: 'text',
  x: 4,
  y: 3,
  w: 40,
  h: 6,
  rotation: 0,
  fontFamily: 'Arial',
  fontSize: 3,
  bold: false,
  align: 'left',
  color: '#000000',
  source: { kind: 'constant', value: 'VECTOR TEST' }
}

const barcode: BarcodeObj = {
  id: 'bc',
  type: 'barcode',
  x: 4,
  y: 12,
  w: 52,
  h: 10,
  rotation: 0,
  symbology: 'code128',
  showText: true,
  source: { kind: 'constant', value: 'SN-1001' }
}

const doc: LabelDoc = {
  version: 2,
  name: 'vector harness',
  widthMm: 60,
  heightMm: 40,
  objects: [
    text,
    barcode,
    { id: 'rect', type: 'rect', x: 4, y: 25, w: 20, h: 10, rotation: 0, fill: '#fff', stroke: '#000', strokeWidth: 0.3 },
    { id: 'ellipse', type: 'ellipse', x: 28, y: 25, w: 20, h: 10, rotation: 0, fill: '#fff', stroke: '#000', strokeWidth: 0.3 }
  ]
}

export async function run() {
  const results: string[] = []
  const check = (condition: unknown, message: string) => {
    if (!condition) throw new Error(message)
    results.push(message)
  }

  const svg = await renderLabelSvg(doc, { dpi: 300 })
  check(svg.startsWith('<svg'), 'vector page starts with an svg root')
  check(svg.includes('width="60mm"') && svg.includes('height="40mm"'), 'vector page keeps the physical mm size')
  check(svg.includes('viewBox="0 0 600 400"'), 'vector page uses the model-unit viewBox')
  check(svg.includes('<text') && svg.includes('VECTOR TEST'), 'text is exported as vector text')
  check(svg.includes('<path') || svg.includes('<rect'), 'shapes are exported as vector elements')
  check(svg.includes('<clipPath') && svg.includes('clip-rule="evenodd"'), 'paper clip uses an evenodd path')
  let validationError = ''
  try {
    validateDriverSvgPage(svg)
    results.push('Fabric vector page passes the driver SVG validator')
  } catch (error) {
    validationError = error instanceof Error ? error.message : String(error)
  }

  const barcodeImageCount = (svg.match(/<image/g) ?? []).length
  check(barcodeImageCount === 0, 'barcodes are not embedded as raster images')
  check(svg.includes('<svg') && svg.includes('SN-1001'), 'barcode fragment is present')

  const richLayout = { rows: 2, cols: 1, rowGapMm: 0, colGapMm: 0, shape: 'roundRect' as const }
  const richDoc: LabelDoc = {
    ...doc,
    layout: richLayout,
    objects: [
      text,
      barcode,
      { id: 'table', type: 'table', x: 4, y: 14, w: 52, h: 8, rotation: 0, rows: 2, cols: 2, borderWidth: 0.3, borderColor: '#000' },
      { id: 'img', type: 'image', x: 46, y: 3, w: 8, h: 8, rotation: 0, src: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y9Zl1sAAAAASUVORK5CYII=' },
      { ...text, id: 'arc', y: 1, arc: true, arcRadius: 20, arcExtent: 180 },
      { ...text, id: 'rotated', x: 48, y: 2, rotation: 90 }
    ]
  }
  let richSvg = ''
  let richValidationError = ''
  try {
    richSvg = await renderLabelSvg(richDoc, { dpi: 300, layout: richLayout })
    validateDriverSvgPage(richSvg)
    results.push('rich vector page with table/image/arc/rotation/multi-cell passes the validator')
    check(richSvg.includes('<image'), 'raster image objects are embedded as image elements')
    check(richSvg.includes('clip-rule="evenodd"'), 'multi-cell roundRect page keeps the evenodd clip')
  } catch (error) {
    richValidationError = error instanceof Error ? error.message : String(error)
  }

  const fragment = await barcodeToSvgFragment('code128', 'SN-1001', 10, { showText: true, humanTextStyle: { fontFamily: 'Arial', fontSize: 2.8 } })
  check(fragment.markup.startsWith('<svg') && fragment.markup.includes('<path'), 'barcode SVG contains vector paths')
  check(!fragment.markup.includes('<image'), 'barcode SVG contains no raster image')
  check(fragment.width > 0 && fragment.height > 0, 'barcode SVG reports a natural size')

  const qr = await barcodeToSvgFragment('qrcode', 'MAXLABEL-QR', 10, { showText: false })
  check(qr.markup.includes('<path') || qr.markup.includes('<rect'), 'QR SVG contains vector geometry')

  const qualityWarnings: string[] = []
  const dotQr = await renderBarcodeCanvasAtDpi({ ...barcode, symbology: 'qrcode', w: 12, h: 12, showText: false },
    'MAXLABEL-12345', 203, (message) => qualityWarnings.push(message))
  const { canvas: qrCanvas } = dotQr
  check(qrCanvas.width === 87 && qrCanvas.height === 87 && qualityWarnings.length === 1, 'QR reserves four modules per side and warns at three dots per module')
  const qrData = qrCanvas.getContext('2d')!.getImageData(0, 0, 87, 87).data
  const qrPixel = (x: number, y: number) => qrData[(y * 87 + x) * 4]
  let uniform = true
  for (let y = 0; y < 87; y++) for (let x = 0; x < 87; x++) {
    const inQuietZone = x < 12 || x >= 75 || y < 12 || y >= 75
    if (inQuietZone ? qrPixel(x, y) !== 255 : qrPixel(x, y) !== qrPixel(x - x % 3, y - y % 3)) uniform = false
  }
  check(uniform && qrPixel(12, 12) === 0, 'every QR module stays square and its quiet zone stays white')
  const qr300 = await renderBarcodeCanvasAtDpi({ ...barcode, symbology: 'qrcode', w: 12, h: 12, showText: false },
    'MAXLABEL-12345', 300, (message) => qualityWarnings.push(message))
  check(qr300.canvas.width === 116 && qualityWarnings.length === 1, '300 DPI allows four dots per module in the same QR frame')
  const explicitQr = { ...barcode, symbology: 'qrcode' as const, w: 16, h: 16, showText: false }
  const qr10mil = await renderBarcodeCanvasAtDpi({ ...explicitQr, barcodeOptions: { xSizeMil: 10 } }, 'MAXLABEL-12345', 203)
  const qr20mil = await renderBarcodeCanvasAtDpi({ ...explicitQr, barcodeOptions: { xSizeMm: 0.508 } }, 'MAXLABEL-12345', 203)
  check(qr10mil.canvas.width === 58 && qr20mil.canvas.width === 116, 'explicit QR X sizes determine integer printer dots')
  const oversize = await renderBarcodeCanvasAtDpi({ ...explicitQr, barcodeOptions: { xSizeMil: 40 } }, 'MAXLABEL-12345', 203)
    .then(() => false, (error: Error) => error.message.includes('静区'))
  check(oversize, 'explicit QR X size reports a fit error instead of silently shrinking')

  for (const barcodeAlign of ['left', 'center', 'right'] as const) {
    const code: BarcodeObj = { ...barcode, symbology: 'qrcode', x: 10, y: 12, w: 20, h: 12,
      barcodeAlign, fontSize: 1.8, barcodeOptions: { xSizeMm: 0.2, humanPosition: 'above' } }
    const label = { ...doc, objects: [code] }
    const scene = resolveOutputScene(label, { dpi: 254 })
    const prepared = await prepareBitmapsForScene(scene, { ...defaultPrinterConfig(), dpi: 254 })
    const item = prepared.primitives[0]
    const bitmap = 'bitmap' in item ? item.bitmap : undefined
    const qr = await renderBarcodeCanvasAtDpi(code, 'SN-1001', 254)
    const expectedX = barcodeAlign === 'left' ? 100 : barcodeAlign === 'center' ? 171 : 242
    check(Boolean(bitmap) && Math.round(bitmap!.originXMm! * 10) + qr.symbolLeftPx === expectedX, 'RAW QR symbol aligns ' + barcodeAlign)
    const page = await renderLabel(label, { dpi: 254 })
    const row = page.getContext('2d')!.getImageData(0, 128, page.width, 1).data
    let firstBlack = 0
    while (firstBlack < page.width && row[firstBlack * 4] > 127) firstBlack++
    check(firstBlack === expectedX + 8, 'driver QR aligns ' + barcodeAlign + ' with text above')
  }

  const logoCanvas = document.createElement('canvas')
  logoCanvas.width = 32
  logoCanvas.height = 16
  const logoContext = logoCanvas.getContext('2d')!
  logoContext.fillStyle = '#b0b0b0'
  logoContext.fillRect(0, 0, 16, 16)
  logoContext.fillStyle = '#000000'
  logoContext.fillRect(16, 0, 16, 16)
  const image = { id: 'logo', type: 'image' as const, x: 3, y: 2, w: 12, h: 12, rotation: 0, src: logoCanvas.toDataURL(), imageFit: 'fit' as const }
  const imageDoc = { ...doc, objects: [image, { ...image, id: 'logo2', x: 23 }, { ...image, id: 'logo3', x: 43, flipX: true }] }
  const imageScene = resolveOutputScene(imageDoc, { dpi: 203 })
  const output = await prepareBitmapsForScene(imageScene, { ...defaultPrinterConfig(), dpi: 203 })
  const [left, right, flipped] = output.primitives.map((primitive) => 'bitmap' in primitive ? primitive.bitmap! : undefined!)
  check(Math.abs(right.originXMm! - left.originXMm! - 20) < 0.01, 'the same image keeps its own bitmap origin at each position')
  const blackDots = (bitmap: typeof left, from: number, to: number) => {
    let count = 0
    for (let y = 0; y < bitmap.height; y++) for (let x = from; x < to; x++) {
      if (bitmap.bytes[y * bitmap.bytesPerRow + (x >> 3)] & (0x80 >> (x % 8))) count++
    }
    return count
  }
  const mid = Math.floor(left.width / 2)
  const grayDots = blackDots(left, 0, mid)
  const blackHalf = blackDots(left, mid, left.width)
  check(grayDots > 0 && grayDots < blackHalf / 2, 'grey image pixels dither into visible black dots')
  check(blackDots(flipped, 0, mid) > blackDots(flipped, mid, flipped.width), 'RAW image conversion honors horizontal flip')
  check(left.width > left.height * 1.7, 'RAW image conversion keeps the aspect-ratio fit')

  const tspl = { ...defaultPrinterConfig(), driver: 'tspl' as const, dpi: 254 }
  const solid = document.createElement('canvas')
  solid.width = solid.height = 4
  const solidContext = solid.getContext('2d')!
  solidContext.fillRect(0, 0, 4, 4)
  const edgeLogo = { ...image, x: 55, y: 5, w: 10, h: 10, src: solid.toDataURL() }
  const clippedDoc = { ...doc, objects: [edgeLogo] }
  const edgePage = await prepareBitmapsForScene(resolveOutputScene(clippedDoc, { dpi: 254 }), tspl)
  const inkAt = (bitmap: typeof left, x: number, y: number) =>
    Boolean(bitmap.bytes[y * bitmap.bytesPerRow + (x >> 3)] & (0x80 >> (x % 8)))
  check(Boolean(edgePage.pageBitmap) && inkAt(edgePage.pageBitmap!, 595, 100), 'RAW keeps the in-bounds half of an edge logo')
  const layout = { rows: 1, cols: 2, rowGapMm: 0, colGapMm: 0 }
  const multiPage = await prepareBitmapsForScene(resolveOutputScene(clippedDoc, { dpi: 254, layout }), tspl)
  check(Boolean(multiPage.pageBitmap) && inkAt(multiPage.pageBitmap!, 595, 100) && !inkAt(multiPage.pageBitmap!, 605, 100),
    'an edge logo never spills into the next label cell')
  const ovalDoc: LabelDoc = { ...doc, layout: { ...layout, cols: 1, shape: 'ellipse' },
    objects: [{ id: 'corner', type: 'rect', x: 1, y: 1, w: 20, h: 20, rotation: 0, fill: '#000', stroke: '#000', strokeWidth: 0 }] }
  const ovalPage = await prepareBitmapsForScene(resolveOutputScene(ovalDoc, { dpi: 254 }), tspl)
  check(Boolean(ovalPage.pageBitmap) && !inkAt(ovalPage.pageBitmap!, 20, 20) && inkAt(ovalPage.pageBitmap!, 150, 150),
    'RAW shapes respect the oval paper outline')

  const escpos = { ...defaultPrinterConfig(), driver: 'escpos' as const, dpi: 254 }
  for (const x of [4, 20]) {
    const label = { ...doc, objects: [{ ...image, x, y: 8 }] }
    const scene = await prepareBitmapsForScene(resolveOutputScene(label, { dpi: 254 }), escpos)
    const bitmap = scene.pageBitmap!
    const hasInk = (px: number, py: number) =>
      Boolean(bitmap.bytes[py * bitmap.bytesPerRow + (px >> 3)] & (0x80 >> (px % 8)))
    check(Boolean(bitmap) && hasInk(x * 10 + 90, 140) && !hasInk(x === 4 ? 290 : 130, 140),
      'ESC/POS image ink moves to the template position ' + x)
  }

  const zpl = { ...defaultPrinterConfig(), driver: 'zpl' as const, dpi: 254 }
  for (const flipY of [false, true]) {
    const line = { id: 'diagonal', type: 'line' as const, x: flipY ? 5 : 0, y: flipY ? 5 : 0, w: 20, h: 10,
      rotation: 0, flipY, stroke: '#000', strokeWidth: 0.3 }
    const label = { ...doc, objects: [line] }
    const scene = await prepareBitmapsForScene(resolveOutputScene(label, { dpi: 254 }), zpl)
    const primitive = scene.primitives[0]
    const bitmap = 'bitmap' in primitive ? primitive.bitmap : undefined
    check(Boolean(bitmap) && !scene.pageBitmap, 'ZPL diagonal is emitted as an object bitmap')
    check(bitmap!.originXMm! >= 0 && bitmap!.originYMm! >= 0, 'ZPL line bitmap begins inside the label')
    const avgY = (x: number) => {
      const rows = Array.from({ length: bitmap!.height }, (_, y) => y)
        .filter((y) => bitmap!.bytes[y * bitmap!.bytesPerRow + (x >> 3)] & (0x80 >> (x % 8)))
      return rows.reduce((a, b) => a + b, 0) / rows.length
    }
    const delta = avgY(Math.floor(bitmap!.width * 0.8)) - avgY(Math.floor(bitmap!.width * 0.2))
    check(flipY ? delta < -40 : delta > 40, 'ZPL diagonal keeps its slope direction')
  }

  const tint = document.createElement('canvas')
  tint.width = tint.height = 4
  const tintContext = tint.getContext('2d')!
  const patch = { ...image, x: 2, y: 2, w: 4, h: 4 }
  const baseRect = { id: 'ground', type: 'rect' as const, x: 0, y: 0, w: 10, h: 10, rotation: 0, fill: '#000', stroke: '#000', strokeWidth: 0 }
  for (const onBlack of [false, true]) {
    tintContext.clearRect(0, 0, 4, 4)
    tintContext.fillStyle = onBlack ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.5)'
    tintContext.fillRect(0, 0, 4, 4)
    const overlay = { ...patch, src: tint.toDataURL() }
    const label = { ...doc, objects: onBlack ? [baseRect, overlay] : [overlay] }
    const prepared = await prepareBitmapsForScene(resolveOutputScene(label, { dpi: 254 }), { ...defaultPrinterConfig(), dpi: 254 })
    const first = prepared.primitives[0]
    const bitmap = prepared.pageBitmap ?? ('bitmap' in first ? first.bitmap : undefined)
    check(Boolean(bitmap) && (!onBlack || Boolean(prepared.pageBitmap)), 'image is composited with its actual background')
    let dots = 0
    const x0 = 32 - Math.round((bitmap!.originXMm ?? 0) * 10)
    const y0 = 32 - Math.round((bitmap!.originYMm ?? 0) * 10)
    for (let y = y0; y < y0 + 4; y++) for (let x = x0; x < x0 + 4; x++) {
      if (bitmap!.bytes[y * bitmap!.bytesPerRow + (x >> 3)] & (0x80 >> (x % 8))) dots++
    }
    check(dots === 8, 'half-transparent pixels produce eight ink dots on ' + (onBlack ? 'black' : 'white'))
  }

  if (/Windows/i.test(navigator.userAgent)) {
    Object.defineProperty(window, 'maxlabel', { configurable: true, value: {
      nativeTextRasterize: async () => ({ ok: true, width: 8, height: 2, bytesPerRow: 1, bytes: btoa('\xff\xff') })
    } })
    try { localStorage.setItem(OPTIONS_STORAGE_KEY, JSON.stringify({ gdiText: true })) } catch { /* Standalone harness has no storage. */ }
    const chinese = { ...text, fontSize: 2, source: { kind: 'constant' as const, value: '小字' } }
    for (const color of ['white', 'rgb(255,255,255)', '#fff', 'rgba(255,255,255,0.5)', 'transparent']) {
      const glyph = await rasterizeTextForPrint({ ...chinese, color }, '小字', 203)
      const pixel = glyph!.canvas.getContext('2d')!.getImageData(0, 0, 1, 1).data
      const alpha = color === 'transparent' ? 0 : color.startsWith('rgba') ? 128 : 255
      check(pixel[3] === alpha && (alpha === 0 || pixel[0] === 255 && pixel[1] === 255 && pixel[2] === 255), 'GDI preserves CSS color ' + color)
    }
    const mixed = await renderDriverPage({ ...doc, objects: [chinese, ...doc.objects.slice(1)] }, { dpi: 203, nativeText: true })
    check(mixed.kind === 'svg' && mixed.svg.includes('<image') && mixed.svg.includes('image-rendering="pixelated"') &&
      mixed.svg.includes('SN-1001') && mixed.svg.includes('<path'),
      'native small text embeds just its bitmap and keeps the remaining page vector')
  }

  const fallbackDoc: LabelDoc = {
    ...doc,
    objects: [{ id: 'svg-image', type: 'image', x: 4, y: 4, w: 20, h: 20, rotation: 0, src: 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciLz4=' }]
  }
  const fallback = await renderDriverPage(fallbackDoc, { dpi: 300 })
  check(fallback.kind === 'raster', 'unsupported image source falls back to a raster page')
  check(fallback.kind === 'raster' && fallback.dataUrl.startsWith('data:image/png;base64,'), 'raster fallback returns a PNG data URL')

  const blockBarcode: BarcodeObj = {
    ...barcode,
    id: 'block-barcode',
    colorChange: { mode: 'index', tableSource: 'shared', privateTable: [], changeMode: 'block', blockRows: 2, blockCols: 2, variableName: '', inputValue: '0123' }
  }
  const blockFallback = await renderDriverPage({ ...doc, objects: [blockBarcode] }, { dpi: 300 })
  check(blockFallback.kind === 'raster', 'block/gradient barcode falls back to a raster page')

  return { results, svg, validationError, richSvg: richValidationError ? richSvg : '', richValidationError }
}
