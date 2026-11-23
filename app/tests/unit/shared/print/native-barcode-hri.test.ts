import { describe, expect, it } from 'vitest'
import type { CommandSet } from '@shared/domain/printer'
import type { BarcodeObj } from '@shared/domain/objects'
import { resolvePrintScene } from '@shared/print/scene'
import { buildCommands } from '@shared/print/engine'
import { barcodeNativeHumanText, barcodePrinterFontFallbackReason, primitiveNeedsRasterization } from '@shared/print/capabilities'
import { dataCtx, printerConfig, sampleDoc } from '../../../helpers/factories'

const DRIVER_FONTS: Array<[CommandSet, string]> = [
  ['tspl', 'Font3'], ['zpl', 'A'], ['cpcl', 'Font3'], ['epl', '3'], ['tpcl', 'A'], ['sato', 'U'], ['pgl', 'O']
]

function barcodePrimitive(overrides: Partial<BarcodeObj> = {}) {
  const doc = sampleDoc()
  const base = doc.objects[2] as BarcodeObj
  doc.objects[2] = {
    ...base,
    printerFont: 'Font3',
    fontFamily: 'Tsc Font 3',
    barcodeOptions: {
      xSizeMm: 0.5,
      xSizeMil: 19.7,
      w2n: 3,
      humanPosition: 'below',
      humanAlign: 'center',
      humanOffsetMm: 1,
      charset: 'auto',
      code39Check: 'none'
    },
    ...overrides
  }
  const scene = resolvePrintScene(doc, dataCtx())
  return scene.primitives.find((primitive) => primitive.kind === 'barcode')!
}

describe('原生条码人读文字选项', () => {
  it('人读文字偏移/对齐与默认特殊选项不阻止除 ESC/POS 外的原生条码', () => {
    for (const [driver, font] of DRIVER_FONTS) {
      const barcode = barcodePrimitive({ printerFont: font, fontFamily: font })
      expect(primitiveNeedsRasterization(barcode, printerConfig({ driver })), driver).toBe(false)
    }
    // ESC/POS GS k 不画人读文字，必须整条位图化。
    expect(primitiveNeedsRasterization(barcodePrimitive(), printerConfig({ driver: 'escpos' }))).toBe(true)
  })

  it('打印机字体 + 可原生表达的人读文字时返回 true', () => {
    const barcode = barcodePrimitive()
    expect(barcodeNativeHumanText(barcode.object as BarcodeObj, 'tspl', '12345678')).toBe(true)
    const zplBarcode = barcodePrimitive({ printerFont: 'A', fontFamily: 'Zebra Font A' })
    expect(barcodeNativeHumanText(zplBarcode.object as BarcodeObj, 'zpl', '12345678')).toBe(true)
  })

  it('目标驱动不认识该字库时按默认字库输出，不整条位图化', () => {
    const barcode = barcodePrimitive({ printerFont: 'Font3', fontFamily: 'Tsc Font 3' })
    expect(primitiveNeedsRasterization(barcode, printerConfig({ driver: 'epl' }))).toBe(false)
    expect(barcodePrinterFontFallbackReason(barcode.object as BarcodeObj, 'epl', '12345678')).toContain('当前驱动不支持')
  })

  it('人读文字的粗体/字号/字体由独立文字或位图叠加，不再整条位图化', () => {
    const bold = barcodePrimitive({ bold: true })
    expect(primitiveNeedsRasterization(bold, printerConfig({ driver: 'tspl' }))).toBe(false)
    expect(primitiveNeedsRasterization(bold, printerConfig({ driver: 'epl' }))).toBe(false)
    const sized = barcodePrimitive({ printerFont: undefined, fontFamily: 'Arial', fontSize: 2.8, charSpacing: 0.2 })
    expect(primitiveNeedsRasterization(sized, printerConfig({ driver: 'tspl' }))).toBe(false)
  })

  it('打印机字体 + 旋转条码仍整条位图化（文字无法跟随旋转）', () => {
    const rotated = barcodePrimitive({ rotation: 90 })
    expect(primitiveNeedsRasterization(rotated, printerConfig({ driver: 'tspl' }))).toBe(true)
  })

  it('Code 39 小写内容在打印场景里统一转大写（原生指令同口径）', () => {
    const doc = sampleDoc()
    const base = doc.objects[2] as BarcodeObj
    doc.objects[2] = { ...base, symbology: 'code39', source: { kind: 'constant', value: 'abc123' } }
    const scene = resolvePrintScene(doc, dataCtx())
    const barcode = scene.primitives.find((primitive) => primitive.kind === 'barcode')!
    expect(barcode.value).toBe('ABC123')
    const commands = buildCommands(doc, printerConfig({ driver: 'tspl' }), { count: 1, copy: 1, title: 'x', datasets: {} })
    expect(commands.text).toContain('"ABC123"')
    expect(commands.text).not.toContain('"abc123"')
  })

  it('没有打印机字体时，默认特殊选项仍保持原生', () => {
    const barcode = barcodePrimitive({ printerFont: undefined, fontFamily: 'Arial' })
    expect(primitiveNeedsRasterization(barcode, printerConfig({ driver: 'tspl' }))).toBe(false)
  })
})
