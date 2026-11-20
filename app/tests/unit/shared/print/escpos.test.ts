import { describe, expect, it } from 'vitest'
import type { LabelDoc } from '@shared/domain/document'
import { primitiveNeedsRasterization } from '@shared/print/capabilities'
import { buildEscPosParts } from '@shared/print/escpos'
import { buildResolvedCommands } from '@shared/print/engine'
import { attachScenePageBitmap, resolvePrintScene } from '@shared/print/scene'
import { dataCtx, printerConfig, sampleDoc, tinyMono } from '../../../helpers/factories'

function buildEscPos(...args: Parameters<typeof buildEscPosParts>): string {
  return buildEscPosParts(...args).map((part) => typeof part === 'string' ? part : Buffer.from(part).toString('latin1')).join('')
}

function asciiDoc(): LabelDoc {
  const base = sampleDoc()
  base.objects = [
    { ...base.objects[1], source: { kind: 'constant', value: 'ABC' } } as LabelDoc['objects'][number]
  ]
  return base
}

function sceneOf(doc: LabelDoc, ctx = dataCtx()) {
  return resolvePrintScene(doc, ctx)
}

describe('ESC/POS builder basics', () => {
  it('initializes and emits text', () => {
    const output = buildEscPos(sceneOf(asciiDoc()), printerConfig({ driver: 'escpos' }), [])
    expect(output.startsWith('\x1b@')).toBe(true)
    expect(output).toContain('ABC')
  })

  it('emits a native 1D barcode command', () => {
    const output = buildEscPos(sceneOf(sampleDoc()), printerConfig({ driver: 'escpos' }), [])
    expect(output).toContain('\x1dk')
    expect(output).toContain('\x1dk\x49\x09{BSN-1001')
  })

  it('rasterizes barcodes with human text because GS k cannot draw it', () => {
    const scene = sceneOf(sampleDoc())
    const barcode = scene.primitives.find((primitive) => primitive.kind === 'barcode')!
    expect(primitiveNeedsRasterization(barcode, printerConfig({ driver: 'escpos' }))).toBe(true)
  })

  it('emits a monochrome raster placeholder for an image', () => {
    const doc: LabelDoc = {
      ...sampleDoc(),
      objects: [
        { id: 'img1', type: 'image', x: 4, y: 4, w: 10, h: 8, rotation: 0, src: 'data:image/png;base64,AA==' }
      ]
    }
    const output = buildEscPos(sceneOf(doc, dataCtx({ images: { img1: tinyMono() } })), printerConfig({ driver: 'escpos' }), [])
    expect(output).toContain('\x1dv0\x00\x01\x00\x08\x00')
    expect(output).toContain('@@RAW:1:img1@@')
  })

  it('emits cut, drawer and feed controls', () => {
    const output = buildEscPos(
      sceneOf(asciiDoc()),
      printerConfig({ driver: 'escpos', escposProfile: 'epson-tm-t88', escposCut: 'full', escposDrawer: 'pin2', escposFeedLines: 2 }),
      []
    )
    expect(output).toContain('\x1dV')
    expect(output).toContain('\x1bp')
    expect(output).toContain('\x1bd\x02')
  })
})

describe('ESC/POS wire bytes', () => {
  it('keeps raster dimensions above 0x7F binary under both transport encodings', () => {
    const scene = attachScenePageBitmap(sceneOf(asciiDoc()), {
      width: 8, height: 128, bytesPerRow: 1, bytes: new Uint8Array(128).fill(0x80)
    })
    for (const encoding of ['utf8', 'gbk'] as const) {
      const printer = printerConfig({ driver: 'escpos', port: { type: 'file', encoding } })
      const result = buildResolvedCommands(printer, { count: 1, copy: 1, title: 'raster', datasets: {}, resolvedPages: [scene] })
      expect(result.segments.every((segment) => segment.type === 'bin')).toBe(true)
      expect(result.segments[2]).toEqual({ type: 'bin', data: Uint8Array.of(0x1d, 0x76, 0x30, 0, 1, 0, 128, 0) })
      expect(result.segments[3]).toEqual({ type: 'bin', data: scene.pageBitmap!.bytes })
    }
  })

  it('rejects a 480-dot label on a 384-dot ESC/POS profile before emitting any commands', () => {
    const printer = printerConfig({ driver: 'escpos', escposPaperWidthMm: 58, dpi: 203, preCmd: 'before' })
    const scene = sceneOf(asciiDoc())
    const result = buildResolvedCommands(printer, { count: 1, copy: 1, title: 'oversize', datasets: {}, resolvedPages: [scene] })
    expect(result.segments).toEqual([])
    expect(result.warningDetails).toContainEqual(expect.objectContaining({ code: 'escpos-print-width', severity: 'error', message: expect.stringMatching(/480.*384/) }))
  })

  it.each([
    ['upca', 65, '03600029145', '036000291452'],
    ['upce', 66, '04252614', '04252614'],
    ['ean13', 67, '690123456789', '6901234567892'],
    ['ean8', 68, '1234567', '12345670'],
    ['code39', 69, 'AB123', 'AB123'],
    ['interleaved2of5', 70, '123456', '123456'],
    ['itf14', 70, '1234567890123', '12345678901231'],
    ['code128', 73, 'AB{12', '{BAB{{12']
  ])('emits the Function B identifier and exact length for %s', (symbology, code, value, data) => {
    const doc = sampleDoc()
    const barcode = doc.objects[2]
    if (barcode.type !== 'barcode') throw new Error('Barcode fixture expected')
    doc.objects = [{ ...barcode, symbology, x: 0, y: 0, source: { kind: 'constant', value } }]
    const output = buildEscPos(sceneOf(doc), printerConfig({ driver: 'escpos' }), [])
    expect(output).toContain('\x1dk' + String.fromCharCode(code, data.length) + data)
  })
})

describe('ESC/POS barcode and fallback', () => {
  it('uses native QR only when the profile supports it', () => {
    const doc: LabelDoc = {
      ...sampleDoc(),
      objects: [
        { ...sampleDoc().objects[2], symbology: 'qrcode', showText: false, source: { kind: 'constant', value: 'ABC' } } as LabelDoc['objects'][number]
      ]
    }
    const supported = buildEscPos(sceneOf(doc), printerConfig({ driver: 'escpos', escposProfile: 'epson-tm-t88' }), [])
    expect(supported).toContain('\x1d(k')

    const warnings: string[] = []
    const generic = buildEscPos(sceneOf(doc), printerConfig({ driver: 'escpos', escposProfile: 'generic' }), warnings)
    expect(generic).not.toContain('\x1d(k')
    expect(warnings.join(' ')).toMatch(/位图|QR|二维码/)
  })

  it('uses native PDF417/DataMatrix when the profile supports them', () => {
    for (const symbology of ['pdf417', 'datamatrix'] as const) {
      const doc: LabelDoc = {
        ...sampleDoc(),
        objects: [
          { ...sampleDoc().objects[2], symbology, showText: false, source: { kind: 'constant', value: 'PAYLOAD-1' } } as LabelDoc['objects'][number]
        ]
      }
      const output = buildEscPos(sceneOf(doc), printerConfig({ driver: 'escpos', escposProfile: 'epson-tm-t88' }), [])
      expect(output).toContain('\x1d(k')
      expect(output).toContain('PAYLOAD-1')
    }
  })

  it('warns and omits cut/drawer when the profile does not support them', () => {
    const warnings: string[] = []
    const output = buildEscPos(
      sceneOf(asciiDoc()),
      printerConfig({ driver: 'escpos', escposProfile: 'generic', escposCut: 'full', escposDrawer: 'pin2' }),
      warnings
    )
    expect(output).not.toContain('\x1dV')
    expect(output).not.toContain('\x1bp')
    expect(warnings.join(' ')).toMatch(/切纸|钱箱/)
  })

  it('rejects RFID documents instead of silently skipping the write', () => {
    const doc: LabelDoc = {
      ...sampleDoc(),
      objects: [
        {
          id: 'rfid',
          type: 'rfid',
          x: 1,
          y: 1,
          w: 20,
          h: 8,
          rotation: 0,
          bank: 'EPC',
          lock: false,
          source: { kind: 'constant', value: 'E200' }
        }
      ]
    }
    expect(() => buildEscPos(sceneOf(doc), printerConfig({ driver: 'escpos' }), [])).toThrow(/RFID/)
  })
})
