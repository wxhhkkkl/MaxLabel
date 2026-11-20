import { describe, expect, it } from 'vitest'
import type { LabelDoc } from '@shared/domain/document'
import type { MonoBitmap } from '@shared/domain/units'
import type { BarcodeObj, TextObj } from '@shared/domain/objects'
import { resolvePrintScene } from '@shared/print/scene'
import { attachSceneBitmaps } from '@shared/print/scene'
import { buildCommands } from '@shared/print/engine'
import { buildSATO, satoNativeBarcodeEligible } from '@shared/print/sato'
import { printerCapabilities, primitiveNeedsRasterization, textNeedsBitmap } from '@shared/print/capabilities'
import { dataCtx, printerConfig, sampleDoc, tinyMono } from '../../../helpers/factories'

const printer = printerConfig({ driver: 'sato', port: { type: 'file', encoding: 'utf8' }, dpi: 203 })
const STX = '\x02'
const ESC = '\x1b'
const ETX = '\x03'

function goldenDoc(): LabelDoc {
  return sampleDoc({
    widthMm: 63,
    heightMm: 20,
    objects: [
      {
        id: 'b',
        type: 'barcode',
        x: 3.75,
        y: 2.25,
        w: 40,
        h: 10,
        rotation: 0,
        symbology: 'code128',
        showText: false,
        barcodeOptions: { xSizeMm: 0.25, w2n: 3 },
        source: { kind: 'constant', value: '12345678' }
      }
    ]
  })
}

describe('SATO SBPL command output', () => {
  it('frames commands with STX/ETX and emits label size', () => {
    const text = buildSATO(resolvePrintScene(goldenDoc(), dataCtx()), printer, [])
    expect(text.startsWith(`${STX}${ESC}A${ESC}Z${ETX}\r\n`)).toBe(true)
    // 63mm × 20mm @203dpi → 宽 504、高 160
    expect(text).toContain(`${ESC}A1V0160H0504`)
    expect(text.endsWith(`${ESC}Z${ETX}\r\n`)).toBe(true)
  })

  it('uses native BG Code128 with narrow/height and Start C like the golden', () => {
    const text = buildSATO(resolvePrintScene(goldenDoc(), dataCtx()), printer, [])
    expect(text).toContain(`${ESC}H0030${ESC}V0018${ESC}BG02080>I12345678`)
  })

  it('uses SBPL type selectors for common 1D symbologies', () => {
    const build = (symbology: string, value: string, options?: Record<string, unknown>) => {
      const base = sampleDoc()
      const doc = {
        ...base,
        objects: base.objects.map((object) =>
          object.type === 'barcode'
            ? {
                ...object,
                symbology,
                showText: false,
                rotation: 0,
                barcodeOptions: { xSizeMm: 0.25, ...options },
                source: { kind: 'constant' as const, value }
              }
            : object
        )
      } as typeof base
      return buildSATO(resolvePrintScene(doc, dataCtx()), printer, [])
    }
    // Code39/Codabar 与 golden 一致：BT 注册 2/6 比例，BW 选比例表 01。
    expect(build('code39', 'ABC-123')).toContain(`${ESC}BT102060206${ESC}BW01112*ABC-123*`)
    expect(build('code93', 'ABC123')).toContain(`${ESC}BC0211206ABC123`)
    expect(build('codabar', '1234')).toContain(`${ESC}BT002060206${ESC}BW01112A1234B`)
    // LabelShop 对 ITF/EAN/UPC 仍输出位图，这里保持一致。
    for (const [symbology, value] of [['interleaved2of5', '123456'], ['ean13', '123456789012'], ['ean8', '1234567'], ['upca', '12345678901']]) {
      const bar = { ...goldenDoc().objects[0], symbology } as BarcodeObj
      expect(satoNativeBarcodeEligible(bar, value), symbology).toBe(false)
    }
    expect(satoNativeBarcodeEligible(goldenDoc().objects[0] as BarcodeObj, '12345678')).toBe(true)
  })

  it('uses native text for an explicit SATO font', () => {
    const base = sampleDoc()
    const doc = {
      ...base,
      objects: base.objects.map((object) =>
        object.type === 'text'
          ? {
              ...object,
              printerFont: 'U',
              align: 'left' as const,
              fontSize: 5,
              source: { kind: 'constant' as const, value: 'ABC123' }
            }
          : object
      )
    } as typeof base
    const scene = resolvePrintScene(doc, dataCtx())
    const text = buildSATO(scene, printer, [])
    // 5mm ≈ 40 dot；Font U 基准 9 dot → 放大 4×
    expect(text).toContain(`${ESC}H0032${ESC}V0032${ESC}PS${ESC}L0404${ESC}UABC123`)
  })

  it('appends the golden font parameter for WB/WL and keeps bold native', () => {
    const base = sampleDoc()
    const doc = {
      ...base,
      objects: base.objects.map((object) =>
        object.type === 'text'
          ? {
              ...object,
              printerFont: 'WB',
              bold: true,
              align: 'left' as const,
              fontSize: 5,
              source: { kind: 'constant' as const, value: 'ABC123' }
            }
          : object
      )
    } as typeof base
    const text = buildSATO(resolvePrintScene(doc, dataCtx()), printer, [])
    // 5mm≈40dot / WB 基准 30dot → 1×
    expect(text).toContain(`${ESC}PS${ESC}L0101${ESC}WB1ABC123`)
  })

  it('matches the golden L multipliers for SATO font sizes', () => {
    const build = (font: string, height100Pt: number) => {
      const base = sampleDoc()
      const doc = {
        ...base,
        objects: base.objects.map((object) =>
          object.type === 'text'
            ? {
                ...object,
                printerFont: font,
                bold: true,
                align: 'left' as const,
                fontSize: (height100Pt / 100) * 25.4 / 72,
                source: { kind: 'constant' as const, value: '12345678' }
              }
            : object
        )
      } as typeof base
      return buildSATO(resolvePrintScene(doc, dataCtx()), printer, [])
    }
    // .lsdx 的 font/height 是 1/100 磅：958=9.58pt、709=7.09pt、1702=17.02pt。
    expect(build('U', 958)).toContain(`${ESC}L0303${ESC}U12345678`)
    expect(build('M', 709)).toContain(`${ESC}L0101${ESC}M12345678`)
    expect(build('XM', 1702)).toContain(`${ESC}L0202${ESC}XM12345678`)
    expect(build('XS', 1206)).toContain(`${ESC}L0202${ESC}XS12345678`)
    expect(build('XU', 958)).toContain(`${ESC}L0303${ESC}XU12345678`)
    // sata-fonts-2：OCR-A 7.8/15.6pt、OCR-B 8.51/17pt
    expect(build('OA', 780)).toContain(`${ESC}L0101${ESC}OA12345678`)
    expect(build('OA', 1561)).toContain(`${ESC}L0202${ESC}OA12345678`)
    expect(build('OB', 851)).toContain(`${ESC}L0101${ESC}OB12345678`)
    expect(build('OB', 1702)).toContain(`${ESC}L0202${ESC}OB12345678`)
  })

  it('prints pre-rendered objects as inline PCX with a 5-digit length', () => {
    const scene = resolvePrintScene(sampleDoc(), dataCtx())
    const withBitmaps = attachSceneBitmaps(scene, new Map<string, MonoBitmap>([
      ['1:2', { ...tinyMono(16, 8), originXMm: 4, originYMm: 4 }]
    ]))
    const text = buildSATO(withBitmaps, printer, [])
    expect(text).toContain(`${ESC}H0032${ESC}V0032${ESC}GP@@PCX_LEN5:1:2@@,@@PCX:1:2@@`)
  })

  it('embeds PCX binary segments through the command pipeline', () => {
    const doc = sampleDoc()
    doc.objects[2] = { ...doc.objects[2], showText: false } as (typeof doc.objects)[number]
    const scene = attachSceneBitmaps(resolvePrintScene(doc, dataCtx()), new Map<string, MonoBitmap>([
      ['1:1', tinyMono(8, 8)],
      ['1:2', tinyMono(16, 8)],
      ['1:4', tinyMono(8, 8)]
    ]))
    const result = buildCommands(doc, printer, {
      count: 1,
      copy: 1,
      title: '测试',
      datasets: {},
      resolvedPages: [scene]
    })
    expect(result.text).toMatch(/GP\d{5},\[BIN:\d+B\]/)
    const pcx = result.segments.find((segment) => segment.type === 'bin')
    expect(pcx?.type === 'bin' ? [...pcx.data.slice(0, 4)] : []).toEqual([0x0a, 0x05, 0x01, 0x01])
    expect(result.warningDetails.some((warning) => warning.code === 'sato-missing-bitmap')).toBe(false)
  })

  it('drives native text and Code128 through capabilities', () => {
    const capabilities = printerCapabilities(printer)
    expect(capabilities.driver).toBe('sato')
    expect(capabilities.nativeBarcodes.has('code128')).toBe(true)
    const scene = resolvePrintScene(sampleDoc(), dataCtx())
    const text = scene.primitives.find((primitive) => primitive.kind === 'text')!
    const barcode = scene.primitives.find((primitive) => primitive.kind === 'barcode')!
    expect(textNeedsBitmap(text.object as TextObj, text.value, printer)).toBe(true)
    expect(primitiveNeedsRasterization(barcode, printer)).toBe(false)
  })
})
