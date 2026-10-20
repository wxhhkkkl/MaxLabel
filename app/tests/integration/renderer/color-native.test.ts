import { describe, expect, it } from 'vitest'
import type { ResolvedPrintScene } from '@shared/print/scene'
import { sceneNeedsRasterization } from '@shared/print/capabilities'
import type { DataCtx } from '@shared/domain/datasource'
import { printerConfig } from '../../helpers/factories'
import { barcodeObject, colorChange, colorCtx, lineObject, textObject } from '../../helpers/color'

const nativePrinter = printerConfig({ driver: 'tspl', port: { type: 'file', encoding: 'utf8' } })

function scene(primitive: Record<string, unknown>): ResolvedPrintScene {
  return {
    widthMm: 60,
    heightMm: 40,
    labelIndex: 1,
    copy: 1,
    primitives: [{ ...primitive, labelIndex: 1, context: colorCtx() as DataCtx }]
  } as unknown as ResolvedPrintScene
}

describe('native printing of dynamic colours', () => {
  it('does not rasterise fixed-colour text or barcodes', () => {
    expect(sceneNeedsRasterization(scene({ kind: 'text', object: textObject(), value: 'AB' }), nativePrinter)).toBe(false)
    expect(sceneNeedsRasterization(scene({ kind: 'barcode', object: barcodeObject(), value: '123' }), nativePrinter)).toBe(false)
  })

  it('rasterises dynamic-colour text, rectangles and ellipses', () => {
    for (const primitive of [
      { kind: 'text', object: textObject({ colorChange: colorChange({ mode: 'index', inputValue: '12' }) }), value: 'AB' },
      { kind: 'rect', object: { id: 'r', type: 'rect', x: 1, y: 1, w: 10, h: 10, rotation: 0, fill: '#ffffff', stroke: '#000000', strokeWidth: 0.3, colorChange: colorChange({ mode: 'index', inputValue: '1' }) } },
      { kind: 'ellipse', object: { id: 'e', type: 'ellipse', x: 1, y: 1, w: 10, h: 10, rotation: 0, fill: '#ffffff', stroke: '#000000', strokeWidth: 0.3, colorChange: colorChange({ mode: 'index', inputValue: '1' }) } }
    ]) {
      expect(sceneNeedsRasterization(scene(primitive), nativePrinter)).toBe(true)
    }
  })

  it('rasterises dynamic-colour lines for native command printers', () => {
    expect(sceneNeedsRasterization(scene({ kind: 'line', object: lineObject({ colorChange: colorChange({ mode: 'index', inputValue: '1' }) }) }), nativePrinter)).toBe(true)
    expect(sceneNeedsRasterization(scene({ kind: 'line', object: lineObject() }), nativePrinter)).toBe(false)
  })

  it('rasterises dynamic-colour barcodes for native command printers', () => {
    expect(sceneNeedsRasterization(scene({
      kind: 'barcode',
      object: barcodeObject({ colorChange: colorChange({ mode: 'index', inputValue: '12' }) }),
      value: '123'
    }), nativePrinter)).toBe(true)
    expect(sceneNeedsRasterization(scene({
      kind: 'barcode',
      object: barcodeObject({ colorChange: colorChange({ mode: 'rgb', inputValue: '#FF0000|#00FF00', changeMode: 'block', blockRows: 1, blockCols: 2 }) }),
      value: '123'
    }), nativePrinter)).toBe(true)
  })
})
