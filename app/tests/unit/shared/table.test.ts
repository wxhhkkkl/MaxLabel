import { describe, expect, it } from 'vitest'
import type { TableObj } from '@shared/domain/objects'
import { tableColXs, tableMergeAt, tableRowYs, tableSegmentHidden } from '@shared/table'

function table(overrides: Partial<TableObj> = {}): TableObj {
  return {
    id: 'table-1',
    type: 'table',
    x: 0,
    y: 0,
    w: 60,
    h: 30,
    rotation: 0,
    rows: 3,
    cols: 4,
    borderWidth: 0.2,
    borderColor: '#000000',
    ...overrides
  }
}

describe('table geometry', () => {
  it('divides equal columns across the object width', () => {
    expect(tableColXs(table())).toEqual([0, 15, 30, 45, 60])
  })

  it('scales custom column widths to the object width', () => {
    expect(tableColXs(table({ cols: 2, colWidths: [1, 3] }))).toEqual([0, 15, 60])
  })

  it('falls back to equal columns when the custom width count is wrong', () => {
    expect(tableColXs(table({ cols: 2, colWidths: [1] }))).toEqual([0, 30, 60])
  })

  it('divides equal rows across the object height', () => {
    expect(tableRowYs(table())).toEqual([0, 10, 20, 30])
  })

  it('scales custom row heights to the object height', () => {
    expect(tableRowYs(table({ rows: 2, rowHeights: [1, 2] }))).toEqual([0, 10, 30])
  })
})

describe('table merges', () => {
  const merged = table({ merges: [{ r: 0, c: 0, r2: 1, c2: 1 }] })

  it('finds the merge covering a cell', () => {
    expect(tableMergeAt(merged, 1, 1)).toEqual({ r: 0, c: 0, r2: 1, c2: 1 })
    expect(tableMergeAt(merged, 2, 2)).toBeNull()
    expect(tableMergeAt(table(), 0, 0)).toBeNull()
  })

  it('hides interior vertical and horizontal lines covered by a merge', () => {
    expect(tableSegmentHidden(merged, 0, 1, 'v')).toBe(true)
    expect(tableSegmentHidden(merged, 0, 0, 'v')).toBe(false)
    expect(tableSegmentHidden(merged, 1, 0, 'h')).toBe(true)
    expect(tableSegmentHidden(merged, 0, 0, 'h')).toBe(false)
  })
})
