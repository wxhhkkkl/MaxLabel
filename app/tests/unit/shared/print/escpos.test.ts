import { describe, expect, it } from 'vitest'
import type { LabelDoc } from '@shared/domain/document'
import { buildEscPos } from '@shared/print/escpos'
import { resolvePrintScene } from '@shared/print/scene'
import { dataCtx, printerConfig, sampleDoc, tinyMono } from '../../../helpers/factories'

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
    expect(output).toContain('SN-1001')
  })

  it('emits a monochrome raster placeholder for an image', () => {
    const doc: LabelDoc = {
      ...sampleDoc(),
      objects: [
        { id: 'img1', type: 'image', x: 4, y: 4, w: 10, h: 8, rotation: 0, src: 'data:image/png;base64,AA==' }
      ]
    }
    const output = buildEscPos(sceneOf(doc, dataCtx({ images: { img1: tinyMono() } })), printerConfig({ driver: 'escpos' }), [])
    expect(output).toContain('\x1dv 0')
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
