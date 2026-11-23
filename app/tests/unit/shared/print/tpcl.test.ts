import { describe, expect, it } from 'vitest'
import type { MonoBitmap } from '@shared/domain/units'
import type { TextObj } from '@shared/domain/objects'
import { attachSceneBitmaps, attachScenePageBitmap, resolvePrintScene } from '@shared/print/scene'
import { buildTPCL } from '@shared/print/tpcl'
import { printerCapabilities, primitiveNeedsRasterization, textNeedsBitmap } from '@shared/print/capabilities'
import { dataCtx, printerConfig, sampleDoc, tinyMono } from '../../../helpers/factories'

const printer = printerConfig({ driver: 'tpcl', port: { type: 'file', encoding: 'utf8' }, dpi: 203 })
const HEX = 'FF'.repeat(16)
const FRAME = (body: string) => `{${body}|}`

function sceneWithObjectBitmaps() {
  const scene = resolvePrintScene(sampleDoc(), dataCtx())
  return attachSceneBitmaps(scene, new Map<string, MonoBitmap>([
    ['1:1', { ...tinyMono(16, 8), originXMm: 0, originYMm: 0 }],
    ['1:2', { ...tinyMono(16, 8), originXMm: 4, originYMm: 4 }],
    ['1:3', { ...tinyMono(16, 8), originXMm: 8, originYMm: 13 }],
    ['1:4', { ...tinyMono(16, 8), originXMm: 8, originYMm: 32 }]
  ]))
}

describe('TPCL command output', () => {
  it('frames clear and label size commands', () => {
    const text = buildTPCL(sceneWithObjectBitmaps(), printer, [])
    // D 参数：标签间距（高 + 2mm 间隙）、打印宽度、打印长度，0.1mm 单位
    expect(text).toContain(FRAME('D0430,0600,0400'))
    expect(text).toContain(FRAME('C'))
  })

  it('writes non-native objects with SG in hex mode', () => {
    const text = buildTPCL(sceneWithObjectBitmaps(), printer, [])
    // 文字对象 4mm,4mm → 40,40（0.1mm）；16×8 点阵
    expect(text).toContain(FRAME(`SG;0040,0040,0016,0008,1,${HEX}`))
    // 1D 条码走原生 XB/RB，不再输出 SG。
    expect(text).not.toContain('SG;0080,0130')
  })

  it('uses native XB commands for supported 1D barcodes', () => {
    const text = buildTPCL(sceneWithObjectBitmaps(), printer, [])
    // code128 → type A；模块宽度 2 dots；高度约 98（0.1mm）；数据内联
    expect(text).toContain(FRAME('XB00;0080,0130,A,1,02,0,0098,+0000000000,000,0,00=SN-1001'))
    expect(text).not.toContain('RB00;')
  })

  it('uses native PC text for explicit TPCL printer fonts', () => {
    const base = sampleDoc()
    const doc = {
      ...base,
      objects: base.objects.map((object) =>
        object.type === 'text'
          ? { ...object, printerFont: 'A', align: 'left' as const, source: { kind: 'constant' as const, value: 'ABC123' } }
          : object
      )
    } as typeof base
    const scene = resolvePrintScene(doc, dataCtx())
    const text = buildTPCL(scene, printer, [])
    expect(text).toContain(FRAME('PC00;0040,0040,3,3,A,00,B=ABC123'))
  })

  it('maps EAN/UPC add-on codes to TPCL type codes', () => {
    const barcodeScene = (symbology: string, value: string, eanAddon?: '2' | '5') => {
      const base = sampleDoc()
      const doc = {
        ...base,
        objects: base.objects.map((object) =>
          object.type === 'barcode'
            ? {
                ...object,
                symbology,
                rotation: 0,
                source: { kind: 'constant' as const, value },
                ...(eanAddon ? { barcodeOptions: { xSizeMm: 0.3, eanAddon } } : {})
              }
            : object
        )
      } as typeof base
      return resolvePrintScene(doc, dataCtx())
    }
    expect(buildTPCL(barcodeScene('ean13', '123456789012', '2'), printer, [])).toMatch(/,7,1,/)
    expect(buildTPCL(barcodeScene('upca', '123456789012', '5'), printer, [])).toMatch(/,M,1,/)
  })

  it('prints one label with the copy count', () => {
    const text = buildTPCL(sceneWithObjectBitmaps(), printer, [])
    expect(text).toContain(FRAME('XS;I,0001,0001C4000'))
  })

  it('prints a complete page bitmap in a single SG', () => {
    const scene = attachScenePageBitmap(resolvePrintScene(sampleDoc(), dataCtx()), tinyMono(16, 8))
    const text = buildTPCL(scene, printer, [])
    expect(text).toContain(FRAME(`SG;0000,0000,0016,0008,1,${HEX}`))
    expect(text).not.toContain('SG;0040,0040')
  })

  it('reports objects without a pre-rendered bitmap', () => {
    const warnings: string[] = []
    buildTPCL(resolvePrintScene(sampleDoc(), dataCtx()), printer, warnings)
    expect(warnings.some((warning) => warning.includes('缺少预渲染位图'))).toBe(true)
  })

  it('uses native text and barcodes in capabilities', () => {
    const capabilities = printerCapabilities(printer)
    expect(capabilities.driver).toBe('tpcl')
    expect(capabilities.nativeBarcodes.has('code128')).toBe(true)
    const scene = resolvePrintScene(sampleDoc(), dataCtx())
    const text = scene.primitives.find((primitive) => primitive.kind === 'text')!
    const barcode = scene.primitives.find((primitive) => primitive.kind === 'barcode')!
    expect(textNeedsBitmap(text.object as TextObj, text.value, printer)).toBe(true)
    expect(primitiveNeedsRasterization(text, printer)).toBe(true)
    // 1D 条码走原生 XB/RB
    expect(primitiveNeedsRasterization(barcode, printer)).toBe(false)
  })
})
