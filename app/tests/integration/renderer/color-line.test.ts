import { describe, expect, it } from 'vitest'
import * as fabric from 'fabric'
import { makeObject } from '@/rendering/fabricObjects'
import { colorChange, colorCtx, lineObject } from '../../helpers/color'

describe('line dynamic colour', () => {
  it('uses the colour resolver for the line stroke', async () => {
    const line = await makeObject(
      lineObject({ colorChange: colorChange({ mode: 'index', inputValue: '1' }) }),
      1,
      { ctx: colorCtx(), output: true }
    )
    expect((line as fabric.Line).stroke).toBe('#FF0000')
  })

  it('keeps the original stroke for fixed colour', async () => {
    const line = await makeObject(lineObject({ stroke: '#123456' }), 1, { ctx: colorCtx(), output: true })
    expect((line as fabric.Line).stroke).toBe('#123456')
  })
})
