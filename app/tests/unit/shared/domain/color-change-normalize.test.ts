import { describe, expect, it } from 'vitest'
import { normalizeDocument } from '@shared/domain'
import { sampleDoc } from '../../../helpers/factories'

function withColorChange(colorChange: unknown, docOverrides: Record<string, unknown> = {}): unknown {
  const base = sampleDoc() as unknown as { objects: Array<Record<string, unknown>> }
  return {
    ...base,
    ...docOverrides,
    objects: base.objects.map((object) => object.id === '2' ? { ...object, colorChange } : object)
  }
}

function colorChangeOf(source: unknown): Record<string, unknown> {
  const doc = normalizeDocument(source)
  const object = doc.objects.find((item) => item.id === '2') as unknown as { colorChange: Record<string, unknown> }
  return object.colorChange
}

describe('colour-change document normalisation', () => {
  it('migrates the legacy variable mode and unknown modes', () => {
    expect(colorChangeOf(withColorChange({ mode: 'variable', variableName: 'clr' }))).toMatchObject({ mode: 'valueVar', variableName: 'clr' })
    expect(colorChangeOf(withColorChange({ mode: 'bogus' }))).toMatchObject({ mode: 'fixed' })
  })

  it('keeps only shared/private tables and valid granularities', () => {
    expect(colorChangeOf(withColorChange({ mode: 'index', tableSource: 'shared' }))).toMatchObject({ tableSource: 'shared' })
    expect(colorChangeOf(withColorChange({ mode: 'index', tableSource: 'other' }))).toMatchObject({ tableSource: 'private' })
    expect(colorChangeOf(withColorChange({ mode: 'index', changeMode: 'char' }))).toMatchObject({ changeMode: 'char' })
    expect(colorChangeOf(withColorChange({ mode: 'index', changeMode: 'bogus' }))).toMatchObject({ changeMode: 'solid' })
  })

  it('requires block grids to be integers within 1–100', () => {
    expect(colorChangeOf(withColorChange({ mode: 'index', blockRows: 2.9, blockCols: 3 }))).toMatchObject({ blockRows: 2, blockCols: 3 })
    expect(() => normalizeDocument(withColorChange({ mode: 'index', blockRows: 0 }))).toThrow()
    expect(() => normalizeDocument(withColorChange({ mode: 'index', blockRows: 200 }))).toThrow()
  })

  it('limits the private table to 256 entries of at most 64 characters', () => {
    expect(colorChangeOf(withColorChange({ mode: 'index', privateTable: Array.from({ length: 256 }, () => '#000000') })))
      .toMatchObject({ privateTable: expect.any(Array) })
    expect(() => normalizeDocument(withColorChange({ mode: 'index', privateTable: Array.from({ length: 257 }, () => '#000000') }))).toThrow()
    expect(() => normalizeDocument(withColorChange({ mode: 'index', privateTable: ['x'.repeat(65)] }))).toThrow()
  })

  it('limits variable and input values to 255 characters', () => {
    expect(() => normalizeDocument(withColorChange({ mode: 'indexVar', variableName: 'x'.repeat(256) }))).toThrow()
    expect(() => normalizeDocument(withColorChange({ mode: 'index', inputValue: 'x'.repeat(256) }))).toThrow()
  })

  it('validates the document colour index table', () => {
    const table = Array.from({ length: 256 }, (_, index) => index % 2 ? '#000000' : '#ffffff')
    const doc = normalizeDocument(withColorChange({ mode: 'index' }, { colorIndexTable: table })) as unknown as { colorIndexTable: string[] }
    expect(doc.colorIndexTable).toHaveLength(256)
    expect(() => normalizeDocument(withColorChange({ mode: 'index' }, { colorIndexTable: [...table, '#000000'] }))).toThrow()
    expect(() => normalizeDocument(withColorChange({ mode: 'index' }, { colorIndexTable: ['#ZZZZZZ'] }))).toThrow()
  })
})
