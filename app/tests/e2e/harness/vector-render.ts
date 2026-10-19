import { renderLabelSvg } from '../../../src/renderer/src/print/renderLabelSvg'
import { renderDriverPage } from '../../../src/renderer/src/print/driverPage'
import { barcodeToSvgFragment } from '../../../src/renderer/src/print/vectorBarcode'
import { validateDriverSvgPage } from '../../../src/shared/print/driverSvg'
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

  const fallbackDoc: LabelDoc = {
    ...doc,
    objects: [{ id: 'svg-image', type: 'image', x: 4, y: 4, w: 20, h: 20, rotation: 0, src: 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciLz4=' }]
  }
  const fallback = await renderDriverPage(fallbackDoc, { dpi: 300 })
  check(fallback.kind === 'raster', 'unsupported image source falls back to a raster page')
  check(fallback.kind === 'raster' && fallback.dataUrl.startsWith('data:image/png;base64,'), 'raster fallback returns a PNG data URL')

  return { results, svg, validationError, richSvg: richValidationError ? richSvg : '', richValidationError }
}
