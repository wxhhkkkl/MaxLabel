import { describe, expect, it } from 'vitest'
import { DEFAULT_COLOR_INDEX_TABLE, resolveColorChangePlan } from '@shared/domain/objects'
import { normalizeDocument } from '@shared/domain'
import { fromDocJson, toMsdx } from '@/io/msdx'
import { PRIVATE_TABLE, SHARED_TABLE, colorChange, colorCtx } from '../../../helpers/color'
import { sampleDoc } from '../../../helpers/factories'

function plan(overrides: Record<string, unknown>, sharedTable?: string[]) {
  return resolveColorChangePlan(
    { type: 'text', colorChange: colorChange({ mode: 'index', changeMode: 'char', ...overrides }) },
    colorCtx(),
    '#000000',
    sharedTable,
    'ABCD'
  )
}

describe('colour index tables', () => {
  it('falls back to the ten predefined colours when the selected table is empty', () => {
    expect(DEFAULT_COLOR_INDEX_TABLE).toHaveLength(10)
    expect(plan({ inputValue: '1' }, []).colors).toEqual([DEFAULT_COLOR_INDEX_TABLE[1]])
    expect(plan({ inputValue: '1', privateTable: [] }, SHARED_TABLE).colors).toEqual([DEFAULT_COLOR_INDEX_TABLE[1]])
  })

  it('uses the private table and wraps indexes', () => {
    expect(plan({ inputValue: '0', privateTable: PRIVATE_TABLE }).colors).toEqual([PRIVATE_TABLE[0]])
    expect(plan({ inputValue: '3', privateTable: PRIVATE_TABLE }).colors).toEqual([PRIVATE_TABLE[1]])
  })

  it('uses the shared table only when tableSource is shared', () => {
    expect(plan({ inputValue: '0', tableSource: 'shared', privateTable: PRIVATE_TABLE }, SHARED_TABLE).colors).toEqual([SHARED_TABLE[0]])
    expect(plan({ inputValue: '0', tableSource: 'private', privateTable: PRIVATE_TABLE }, SHARED_TABLE).colors).toEqual([PRIVATE_TABLE[0]])
  })

  it('keeps 256-entry tables and document round-trips them', () => {
    const table = Array.from({ length: 256 }, (_, index) => index % 2 ? '#000000' : '#ffffff')
    const doc = { ...sampleDoc(), colorIndexTable: table }
    const decoded = fromDocJson(toMsdx(doc))
    expect(decoded.colorIndexTable).toEqual(table)
    expect(normalizeDocument(doc).colorIndexTable).toHaveLength(256)
  })

  it('falls back to the object colour when the table entry is empty', () => {
    const result = resolveColorChangePlan(
      { type: 'text', colorChange: colorChange({ mode: 'index', inputValue: '0' }) },
      colorCtx(),
      '#123456',
      undefined,
      'A'
    )
    expect(result.colors).toEqual(['#000000'])
    expect(resolveColorChangePlan({ type: 'text', colorChange: colorChange({ mode: 'index', inputValue: '0' }) }, colorCtx(), '#123456').colors).toEqual(['#000000'])
  })
})
