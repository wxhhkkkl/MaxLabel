import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import type { LabelDoc, MonoBitmap, PrinterConfig } from '../src/shared/model'
import { buildCommands } from '../src/shared/print/engine'

const outputDir = join(process.cwd(), 'fixtures', 'protocol')
mkdirSync(outputDir, { recursive: true })

const checker: MonoBitmap = {
  width: 16,
  height: 16,
  bytesPerRow: 2,
  bytes: Uint8Array.from(Array.from({ length: 16 }, (_, y) => y % 2 ? [0x55, 0x55] : [0xaa, 0xaa]).flat())
}

const doc: LabelDoc = {
  version: 1,
  name: 'Native protocol validation',
  widthMm: 80,
  heightMm: 60,
  objects: [
    { id: 'border', type: 'rect', x: 1, y: 1, w: 78, h: 58, rotation: 0, fill: '#fff', stroke: '#000', strokeWidth: 0.3 },
    { id: 'title', type: 'text', x: 4, y: 3, w: 60, h: 5, rotation: 0, fontFamily: 'Arial', fontSize: 4, bold: false, align: 'left', color: '#000', source: { kind: 'constant', value: 'MAXLABEL NATIVE TEST' } },
    { id: 'rot', type: 'text', x: 74, y: 4, w: 5, h: 18, rotation: 90, fontFamily: 'Arial', fontSize: 3, bold: false, align: 'left', color: '#000', source: { kind: 'constant', value: 'R90' } },
    { id: 'c128', type: 'barcode', x: 4, y: 10, w: 48, h: 12, rotation: 0, symbology: 'code128', showText: true, barcodeOptions: { xSizeMm: 0.25, w2n: 2 }, source: { kind: 'constant', value: 'ML-128-0001' } },
    { id: 'qr', type: 'barcode', x: 56, y: 9, w: 18, h: 18, rotation: 0, symbology: 'qrcode', showText: false, barcodeOptions: { xSizeMm: 0.5, eclevel: 'M' }, source: { kind: 'constant', value: 'https://example.com/ml/1' } },
    { id: 'dm', type: 'barcode', x: 4, y: 29, w: 18, h: 18, rotation: 0, symbology: 'datamatrix', showText: false, barcodeOptions: { xSizeMm: 0.5 }, source: { kind: 'constant', value: 'DM-0001' } },
    { id: 'pdf', type: 'barcode', x: 25, y: 30, w: 48, h: 13, rotation: 0, symbology: 'pdf417', showText: false, barcodeOptions: { eclevel: '2' }, source: { kind: 'constant', value: 'PDF417-MAXLABEL-0001' } },
    { id: 'img', type: 'image', x: 4, y: 50, w: 4, h: 4, rotation: 0, src: 'fixture://checker' },
    { id: 'footer', type: 'text', x: 11, y: 50, w: 62, h: 4, rotation: 0, fontFamily: 'Arial', fontSize: 3, bold: false, align: 'left', color: '#000', source: { kind: 'constant', value: 'SIZE 80x60mm / COPY 1' } }
  ]
}

function printer(driver: PrinterConfig['driver']): PrinterConfig {
  return {
    driver,
    dpi: 203,
    speed: 3,
    density: 8,
    printMode: 'thermal',
    labelType: 'gap',
    topOffsetMm: 0,
    mediaHandle: 'tear',
    backfeedMm: 0,
    port: { type: 'file', encoding: 'utf8' }
  }
}

for (const driver of ['tspl', 'zpl', 'cpcl'] as const) {
  // CPCL's capability profile deliberately rasterizes right-angle rotation;
  // the fixture generator has no browser canvas, so use the native subset for
  // the textual CPCL fixture and keep rotation covered by the renderer tests.
  const fixtureDoc = driver === 'cpcl'
    ? { ...doc, objects: doc.objects.filter((object) => object.id !== 'rot') }
    : doc
  const result = buildCommands(fixtureDoc, printer(driver), {
    count: 1,
    copy: 1,
    title: 'Native protocol validation',
    datasets: {},
    images: { img: checker }
  })
  const chunks = result.segments.map((segment) => segment.type === 'bin' ? Buffer.from(segment.data) : Buffer.from(segment.str, 'utf8'))
  writeFileSync(join(outputDir, `${driver}-80x60-203dpi.prn`), Buffer.concat(chunks))
  writeFileSync(join(outputDir, `${driver}-warnings.txt`), result.warnings.join('\n') + (result.warnings.length ? '\n' : ''))
  console.log(`${driver.toUpperCase()}: ${Buffer.concat(chunks).length} bytes, ${result.warnings.length} warning(s)`)
}
