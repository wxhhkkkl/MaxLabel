import { describe, expect, it } from 'vitest'
import type { MonoBitmap } from '@shared/domain/units'
import type { TextObj } from '@shared/domain/objects'
import { attachSceneBitmaps, attachSceneHumanTextBitmaps, attachScenePageBitmap, resolvePrintScene } from '@shared/print/scene'
import { buildEPL } from '@shared/print/epl'
import { printerCapabilities, primitiveNeedsRasterization, textNeedsBitmap } from '@shared/print/capabilities'
import { dataCtx, printerConfig, sampleDoc, tinyMono } from '../../../helpers/factories'

const printer = printerConfig({ driver: 'epl', port: { type: 'file', encoding: 'utf8' }, dpi: 203 })
const dots = (mm: number) => Math.round((mm / 25.4) * 203)
const HEX = 'FF'.repeat(16)

function sceneWithObjectBitmaps() {
  const scene = resolvePrintScene(sampleDoc(), dataCtx())
  const bitmaps = new Map<string, MonoBitmap>([
    ['1:1', { ...tinyMono(16, 8), originXMm: 0, originYMm: 0 }],
    ['1:2', { ...tinyMono(16, 8), originXMm: 4, originYMm: 4 }],
    ['1:3', { ...tinyMono(16, 8), originXMm: 8, originYMm: 13 }],
    ['1:4', { ...tinyMono(16, 8), originXMm: 8, originYMm: 32 }]
  ])
  return attachSceneBitmaps(scene, bitmaps)
}

describe('EPL2 command output', () => {
  it('emits label geometry, density and speed', () => {
    const text = buildEPL(sceneWithObjectBitmaps(), printer, [])
    expect(text.split('\n')[0]).toBe('N')
    expect(text).toContain(`q${dots(60)}`)
    expect(text).toContain(`Q${dots(40)},${dots(2)}`)
    expect(text).toContain('D8')
    expect(text).toContain('S4')
  })

  it('downloads Zebra bitmaps with GK/GM and places them with GG', () => {
    const zebra = printerConfig({ driver: 'epl', profile: 'Zebra', port: { type: 'file', encoding: 'utf8' }, dpi: 203 })
    const text = buildEPL(sceneWithObjectBitmaps(), zebra, [])
    expect(text).toContain('GK"G1"')
    expect(text).toContain('GM"G1"@@PCX_LEN:1:1@@')
    expect(text).toContain('GG0,0,"G1"')
    expect(text).not.toContain('GW')
  })

  it('writes each pre-rendered object bitmap with GW at its origin', () => {
    const text = buildEPL(sceneWithObjectBitmaps(), printer, [])
    // 文字对象 4mm,4mm → x 按 LabelShop EPL 原点左移 8 dots，y 不变；每行 2 字节、8 像素高。
    expect(text).toContain(`GW${dots(4) - 8},${dots(4)},2,8,${HEX}`)
    // 条码走原生 B，不再输出对象位图。
    expect(text).not.toContain(`GW${dots(8) - 8},${dots(13)}`)
    expect(text).toContain('P1')
  })

  it('uses the native B command for supported 1D barcodes', () => {
    const warnings: string[] = []
    const text = buildEPL(sceneWithObjectBitmaps(), printer, warnings)
    // code128 → type 1；无 HRI 位图时由固件绘制（参数 B）。
    expect(text).toMatch(/B56,104,0,1,\d+,\d+,\d+,B,"SN-1001"/)
    expect(warnings.some((warning) => warning.includes('固件绘制'))).toBe(true)
  })

  it('overlays the canvas HRI bitmap and turns firmware text off', () => {
    const scene = attachSceneHumanTextBitmaps(sceneWithObjectBitmaps(), new Map([
      ['1:3', { bitmap: { ...tinyMono(16, 8), originXMm: 8, originYMm: 24 } }]
    ]))
    const text = buildEPL(scene, printer, [])
    expect(text).toMatch(/B56,104,0,1,\d+,\d+,\d+,N,"SN-1001"/)
    expect(text).toContain(`GW${dots(8) - 8},${dots(24)},2,8,${HEX}`)
  })

  it('prints a complete page bitmap in a single GW', () => {
    const scene = attachScenePageBitmap(resolvePrintScene(sampleDoc(), dataCtx()), tinyMono(16, 8))
    const text = buildEPL(scene, printer, [])
    expect(text).toContain(`GW0,0,2,8,${HEX}`)
    expect(text).not.toContain(`GW${dots(4)},${dots(4)}`)
    expect(text).toContain('P1')
  })

  it('reports objects that have no pre-rendered bitmap', () => {
    const warnings: string[] = []
    const text = buildEPL(resolvePrintScene(sampleDoc(), dataCtx()), printer, warnings)
    expect(warnings.some((warning) => warning.includes('缺少预渲染位图'))).toBe(true)
    expect(text).toContain('P1')
  })

  it('uses native A text for explicit EPL printer fonts', () => {
    const base = sampleDoc()
    const doc = {
      ...base,
      objects: base.objects.map((object) =>
        object.type === 'text'
          ? { ...object, printerFont: '3', align: 'left' as const, source: { kind: 'constant' as const, value: 'ABC123' } }
          : object
      )
    } as typeof base
    const scene = resolvePrintScene(doc, dataCtx())
    const text = buildEPL(scene, printer, [])
    expect(text).toMatch(/A24,32,0,3,\d+,\d+,N,"ABC123"/)
    const textPrimitive = scene.primitives.find((primitive) => primitive.kind === 'text')!
    expect(textNeedsBitmap(textPrimitive.object as TextObj, textPrimitive.value, printer)).toBe(false)
    expect(primitiveNeedsRasterization(textPrimitive, printer)).toBe(false)
  })

  it('maps EAN/UPC add-on codes to EPL type strings', () => {
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
    expect(buildEPL(barcodeScene('ean13', '123456789012', '2'), printer, [])).toMatch(/,E32,/)
    expect(buildEPL(barcodeScene('upca', '123456789012'), printer, [])).toMatch(/,UA0,/)
    expect(buildEPL(barcodeScene('upce', '123456', '5'), printer, [])).toMatch(/,UE5,/)
  })

  it('keeps text on the bitmap path but allows native 1D barcodes', () => {
    const capabilities = printerCapabilities(printer)
    expect(capabilities.driver).toBe('epl')
    expect(capabilities.nativeBarcodes.has('code128')).toBe(true)
    const scene = resolvePrintScene(sampleDoc(), dataCtx())
    const textPrimitive = scene.primitives.find((primitive) => primitive.kind === 'text')!
    const barcodePrimitive = scene.primitives.find((primitive) => primitive.kind === 'barcode')!
    expect(textNeedsBitmap(textPrimitive.object as TextObj, textPrimitive.value, printer)).toBe(true)
    expect(primitiveNeedsRasterization(textPrimitive, printer)).toBe(true)
    expect(primitiveNeedsRasterization(barcodePrimitive, printer)).toBe(false)
    // 未列入原生码表的码制/二维码继续位图；旋转条码按 B 的 rotation 参数原生输出。
    const qrScene = resolvePrintScene(sampleDoc({ objects: sampleDoc().objects.map((object) =>
      object.type === 'barcode' ? { ...object, symbology: 'qrcode' } : object) }), dataCtx())
    const qr = qrScene.primitives.find((primitive) => primitive.kind === 'barcode')!
    expect(primitiveNeedsRasterization(qr, printer)).toBe(true)
    const rotatedScene = resolvePrintScene(sampleDoc({ objects: sampleDoc().objects.map((object) =>
      object.type === 'barcode' ? { ...object, rotation: 90 } : object) }), dataCtx())
    const rotated = rotatedScene.primitives.find((primitive) => primitive.kind === 'barcode')!
    expect(primitiveNeedsRasterization(rotated, printer)).toBe(false)
    const rotatedText = buildEPL(rotatedScene, printer, [])
    expect(rotatedText).toMatch(/B\d+,\d+,1,1,/ )
  })
})
