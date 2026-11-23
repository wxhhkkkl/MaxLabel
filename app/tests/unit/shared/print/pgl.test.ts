import { describe, expect, it } from 'vitest'
import type { MonoBitmap } from '@shared/domain/units'
import type { TextObj } from '@shared/domain/objects'
import { attachSceneBitmaps, resolvePrintScene } from '@shared/print/scene'
import { buildPGL } from '@shared/print/pgl'
import { buildCommands } from '@shared/print/engine'
import { primitiveNeedsRasterization, printerCapabilities, textNeedsBitmap } from '@shared/print/capabilities'
import { dataCtx, printerConfig, sampleDoc, tinyMono } from '../../../helpers/factories'

const printer = printerConfig({ driver: 'pgl', port: { type: 'file', encoding: 'utf8' }, dpi: 203 })

function sceneWithObjectBitmaps() {
  const scene = resolvePrintScene(sampleDoc(), dataCtx())
  return attachSceneBitmaps(scene, new Map<string, MonoBitmap>([
    ['1:1', { ...tinyMono(16, 8), originXMm: 0, originYMm: 0 }],
    ['1:2', { ...tinyMono(16, 8), originXMm: 4, originYMm: 4 }]
  ]))
}

describe('PGL command output', () => {
  it('writes the PTX setup header in 1/1000 inch units', () => {
    const text = buildPGL(sceneWithObjectBitmaps(), printer, [])
    expect(text).toContain('!PTX_SETUP\nENGINE-WIDTH;2362:LENGTH;1575.\nPTX_END')
    expect(text).toContain('~PAPER;LABELS 1;SPEED IPS 4;SLEW IPS 4')
  })

  it('uploads each bitmap as a PCX LOGO and places it in dot-scale form', () => {
    const text = buildPGL(sceneWithObjectBitmaps(), printer, [])
    expect(text).toContain('~LOGO;ML1_2;PCX\n@@PCX:1:2@@\n~RASTEREND\nEND')
    expect(text).toContain('~CREATE;MAXLBL')
    expect(text).toContain('SCALE;DOT;203;203')
    expect(text).toContain('LOGO\n32;32;ML1_2\nSTOP')
  })

  it('executes the form and removes temporary logos', () => {
    const text = buildPGL(sceneWithObjectBitmaps(), printer, [])
    expect(text).toContain('~EXECUTE;MAXLBL')
    expect(text).toContain('~REPEAT;1')
    expect(text).toContain('~DELETE FORM;MAXLBL')
    expect(text).toContain('~DELETE LOGO;ML1_2')
  })

  it('uses native BARCODE for even numeric Code128', () => {
    const base = sampleDoc()
    const doc = {
      ...base,
      objects: base.objects.map((object) =>
        object.type === 'barcode'
          ? {
              ...object,
              x: 3.75,
              y: 2.25,
              h: 10,
              showText: false,
              barcodeOptions: { xSizeMm: 0.25, w2n: 3 },
              source: { kind: 'constant' as const, value: '12345678' }
            }
          : object
      )
    } as typeof base
    const text = buildPGL(resolvePrintScene(doc, dataCtx()), printer, [])
    expect(text).toContain("BARCODE\nC128B;XRD2:2:4:4:6:6:8:8;H3.94;18;30\n*\x0e'12345678*\nSTOP")
  })

  it('uses native BARCODE for Code39 / Code93 / Codabar', () => {
    const cases = [
      { symbology: 'code39' as const, value: 'ABC123', type: 'C3/9', xrd: '2:2:6:6', data: 'ABC123' },
      { symbology: 'code93' as const, value: '123456', type: 'CODE93', xrd: '2:2:4:4:6:6:8:8', data: '123456' },
      { symbology: 'codabar' as const, value: '1234', type: 'CODABAR', xrd: '2:2:6:6', data: 'A1234B' }
    ]
    for (const item of cases) {
      const base = sampleDoc()
      const doc = {
        ...base,
        objects: base.objects.map((object) =>
          object.type === 'barcode'
            ? {
                ...object, symbology: item.symbology, x: 3.75, y: 2.25, h: 10, showText: false,
                barcodeOptions: { xSizeMm: 0.25, w2n: 3 }, source: { kind: 'constant' as const, value: item.value }
              }
            : object
        )
      } as typeof base
      const scene = resolvePrintScene(doc, dataCtx())
      const barcode = scene.primitives.find((primitive) => primitive.kind === 'barcode')!
      expect(primitiveNeedsRasterization(barcode, printer), item.symbology).toBe(false)
      const text = buildPGL(scene, printer, [])
      expect(text, item.symbology).toContain(`BARCODE\n${item.type};XRD${item.xrd};H3.94;18;30\n*${item.data}*\nSTOP`)
    }
  })

  it('embeds PCX binary segments through the command pipeline', () => {
    const doc = sampleDoc()
    const scene = attachSceneBitmaps(resolvePrintScene(doc, dataCtx()), new Map<string, MonoBitmap>([
      ['1:1', tinyMono(8, 8)],
      ['1:2', tinyMono(16, 8)],
      ['1:3', tinyMono(16, 8)],
      ['1:4', tinyMono(8, 8)]
    ]))
    const result = buildCommands(doc, printer, {
      count: 1,
      copy: 1,
      title: '测试',
      datasets: {},
      resolvedPages: [scene]
    })
    expect(result.text).toContain('~LOGO;ML1_2;PCX\n[BIN:')
    const pcx = result.segments.find((segment) => segment.type === 'bin')
    expect(pcx?.type === 'bin' ? [...pcx.data.slice(0, 4)] : []).toEqual([0x0a, 0x05, 0x01, 0x01])
    expect(result.warningDetails.some((warning) => warning.code === 'pgl-missing-bitmap')).toBe(false)
  })

  it('uses native ALPHA for Printronix OCR fonts', () => {
    const base = sampleDoc()
    const doc = {
      ...base,
      objects: base.objects.map((object) =>
        object.type === 'text'
          ? {
              ...object,
              printerFont: 'OA',
              align: 'left' as const,
              source: { kind: 'constant' as const, value: 'ABC123' }
            }
          : object
      )
    } as typeof base
    const text = buildPGL(resolvePrintScene(doc, dataCtx()), printer, [])
    expect(text).toContain('ISET;0\nALPHA\nC10A;32;32;0;0;*ABC123*\nSTOP')
  })

  it('lets PGL auto-select the subset for alphanumeric Code128', () => {
    const text = buildPGL(resolvePrintScene(sampleDoc(), dataCtx()), printer, [])
    expect(text).toContain('*SN-1001*')
  })

  it('rasterizes text and unsupported symbologies', () => {
    const capabilities = printerCapabilities(printer)
    expect(capabilities.driver).toBe('pgl')
    expect(capabilities.nativeBarcodes.has('code128')).toBe(true)
    const scene = resolvePrintScene(sampleDoc(), dataCtx())
    const text = scene.primitives.find((primitive) => primitive.kind === 'text')!
    const barcode = scene.primitives.find((primitive) => primitive.kind === 'barcode')!
    expect(textNeedsBitmap(text.object as TextObj, text.value, printer)).toBe(true)
    expect(primitiveNeedsRasterization(text, printer)).toBe(true)
    expect(primitiveNeedsRasterization(barcode, printer)).toBe(false)
    const eanDoc = sampleDoc()
    eanDoc.objects[2] = { ...eanDoc.objects[2], symbology: 'ean13' } as (typeof eanDoc.objects)[number]
    const ean = resolvePrintScene(eanDoc, dataCtx()).primitives.find((primitive) => primitive.kind === 'barcode')!
    expect(primitiveNeedsRasterization(ean, printer)).toBe(true)
  })
})
