import { describe, expect, it } from 'vitest'
import { resolveColorChangePlan } from '@shared/domain/objects'
import type { DataCtx } from '@shared/domain/datasource'
import { barcodeObject, colorChange, colorCtx, textObject } from '../../../helpers/color'

function resolve(mode: 'indexByContent' | 'indexVar' | 'valueVar' | 'index' | 'rgb', type: 'text' | 'barcode' = 'text', overrides: Record<string, unknown> = {}, ctx: DataCtx = colorCtx(), content = '1A') {
  return resolveColorChangePlan(
    { type, colorChange: colorChange({ mode, changeMode: 'char', ...overrides }) },
    ctx,
    '#123456',
    undefined,
    content
  )
}

const datasetCtx = colorCtx({
  datasets: { main: { name: 'main', columns: ['clr'], rows: [['34']] } },
  activeDataset: 'main',
  recordRow: ['34']
})

const colourValueCtx = colorCtx({
  datasets: { main: { name: 'main', columns: ['clr'], rows: [['#123456|#654321']] } },
  activeDataset: 'main',
  recordRow: ['#123456|#654321']
})

describe('content, variable and input colour sources', () => {
  it('indexes text and barcode content, other types use index 0', () => {
    expect(resolve('indexByContent', 'text', {}, colorCtx(), '1A').colors).toEqual(['#FF0000', '#000000'])
    expect(resolve('indexByContent', 'barcode', { changeMode: 'block', blockRows: 1, blockCols: 2 }, colorCtx(), '1A').colors).toEqual(['#FF0000', '#000000'])
    const rect = resolveColorChangePlan({ type: 'rect', colorChange: colorChange({ mode: 'indexByContent' }) }, colorCtx(), '#123456', undefined, '')
    expect(rect.colors).toEqual(['#000000'])
  })

  it('reads index variables from keyboard values and the active dataset row', () => {
    expect(resolve('indexVar', 'text', { variableName: 'clr' }, colorCtx({ keyboardValues: { clr: '12' } })).colors)
      .toEqual(['#FF0000', '#00FF00'])
    expect(resolve('indexVar', 'text', { variableName: 'clr' }, datasetCtx).colors)
      .toEqual(['#0000FF', '#FFFF00'])
  })

  it('reads colour-value variables from keyboard values and the active dataset row', () => {
    expect(resolve('valueVar', 'text', { variableName: 'clr' }, colorCtx({ keyboardValues: { clr: '#123456|#654321' } })).colors)
      .toEqual(['#123456', '#654321'])
    expect(resolve('valueVar', 'text', { variableName: 'clr' }, colourValueCtx).colors)
      .toEqual(['#123456', '#654321'])
  })

  it('accepts comma and pipe colour lists for RGB input', () => {
    expect(resolve('rgb', 'text', { inputValue: '#FF0000,#00FF00' }).colors).toEqual(['#FF0000', '#00FF00'])
    expect(resolve('rgb', 'text', { inputValue: '#FF0000 | #00FF00' }).colors).toEqual(['#FF0000', '#00FF00'])
  })

  it('index input uses the character index algorithm', () => {
    expect(resolve('index', 'text', { inputValue: '12' }).colors).toEqual(['#FF0000', '#00FF00'])
  })

  it('falls back to the object colour for empty content, variables or inputs', () => {
    expect(resolve('indexByContent', 'text', {}, colorCtx(), '').colors).toEqual(['#000000'])
    expect(resolve('indexVar', 'text', { variableName: 'missing' }).colors).toEqual(['#123456'])
    expect(resolve('valueVar', 'text', { variableName: 'missing' }).colors).toEqual(['#123456'])
    expect(resolve('index', 'text', { inputValue: '' }).colors).toEqual(['#123456'])
    expect(resolve('rgb', 'text', { inputValue: ' , | ' }).colors).toEqual(['#123456'])
  })

  it('keeps text and barcode sources separate from the object colour', () => {
    expect(textObject().color).toBe('#000000')
    expect(barcodeObject().color).toBe('#000000')
  })
})
