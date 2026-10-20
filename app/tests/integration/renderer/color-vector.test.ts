import { describe, expect, it } from 'vitest'
import { makeObject } from '@/rendering/fabricObjects'
import { VectorUnsupportedError } from '@/print/vectorSupport'
import { barcodeObject, colorChange, colorCtx } from '../../helpers/color'

describe('vector barcode colour fallback', () => {
  it('rejects block/gradient barcodes so the page falls back to raster', async () => {
    for (const colorChangeConfig of [
      colorChange({ mode: 'index', inputValue: '12', changeMode: 'block', blockRows: 1, blockCols: 2 }),
      colorChange({ mode: 'rgb', inputValue: '#FF0000|#00FF00', changeMode: 'gradient', blockRows: 1, blockCols: 3 })
    ]) {
      await expect(makeObject(
        barcodeObject({ colorChange: colorChangeConfig }),
        1,
        { ctx: colorCtx(), vectorBarcodes: true, output: true }
      )).rejects.toBeInstanceOf(VectorUnsupportedError)
    }
  })
})
