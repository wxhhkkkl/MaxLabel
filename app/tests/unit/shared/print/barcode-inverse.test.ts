import { describe, expect, it } from 'vitest'
import type { CommandSet } from '@shared/domain/printer'
import type { BarcodeObj } from '@shared/domain/objects'
import { resolvePrintScene } from '@shared/print/scene'
import { primitiveNeedsRasterization } from '@shared/print/capabilities'
import { dataCtx, printerConfig, sampleDoc } from '../../../helpers/factories'

function inverseBarcodeScene() {
  const doc = sampleDoc()
  doc.objects[2] = {
    ...(doc.objects[2] as BarcodeObj),
    barcodeOptions: { inverse: true }
  }
  return resolvePrintScene(doc, dataCtx())
}

describe('一维码反白', () => {
  it('所有驱动都强制走对象位图（原生 1D 命令不能反色）', () => {
    const drivers: CommandSet[] = ['tspl', 'zpl', 'cpcl', 'escpos', 'epl', 'tpcl', 'pgl', 'sato']
    const scene = inverseBarcodeScene()
    const barcode = scene.primitives.find((primitive) => primitive.kind === 'barcode')!
    for (const driver of drivers) {
      expect(primitiveNeedsRasterization(barcode, printerConfig({ driver })), driver).toBe(true)
    }
  })

  it('未反白时仍保持原生输出', () => {
    const scene = resolvePrintScene(sampleDoc(), dataCtx())
    const barcode = scene.primitives.find((primitive) => primitive.kind === 'barcode')!
    expect(primitiveNeedsRasterization(barcode, printerConfig({ driver: 'zpl' }))).toBe(false)
  })
})
