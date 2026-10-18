import { describe, expect, it } from 'vitest'
import type { Dataset, SerialSource } from '@shared/domain/datasource'
import { advanceSerial, applyObjectFormat, resolveSourceText } from '@shared/domain/datasource'
import { dataCtx } from '../../../helpers/factories'

const inventory: Dataset = {
  name: 'inventory',
  columns: ['SKU', 'name'],
  rows: [
    ['A-01', 'alpha'],
    ['B-02', 'beta']
  ]
}

describe('serial source', () => {
  it('resolves the current value from the label index', () => {
    const source = { kind: 'serial' as const, prefix: 'SN-', start: 1001, step: 1, digits: 4, current: 5 }
    expect(resolveSourceText(source, dataCtx({ labelIndex: 1 }))).toBe('SN-0005')
    expect(resolveSourceText(source, dataCtx({ labelIndex: 3 }))).toBe('SN-0007')
  })

  it('repeats by label and advances once per repeat group', () => {
    const source = { kind: 'serial' as const, prefix: 'NO.', start: 1, step: 1, digits: 3, current: 1, repeat: 2, repeatBasis: 'label' as const }
    expect(resolveSourceText(source, dataCtx({ labelIndex: 1 }))).toBe('NO.001')
    expect(resolveSourceText(source, dataCtx({ labelIndex: 2 }))).toBe('NO.001')
    expect(resolveSourceText(source, dataCtx({ labelIndex: 3 }))).toBe('NO.002')
    expect((advanceSerial(source, 2) as SerialSource).current).toBe(2)
  })

  it('accepts initial values from keyboard or a database field', () => {
    const keyboard = {
      kind: 'serial' as const,
      prefix: '',
      start: 1,
      step: 1,
      digits: 3,
      current: 1,
      initialValueSource: 'keyboard' as const,
      initialValueField: '批号'
    }
    expect(resolveSourceText(keyboard, dataCtx({ keyboardValues: { 批号: '12' } }))).toBe('012')

    const database = {
      kind: 'serial' as const,
      prefix: '',
      start: 1,
      step: 1,
      digits: 2,
      current: 1,
      initialValueSource: 'database' as const,
      initialValueField: '起始值'
    }
    expect(
      resolveSourceText(
        database,
        dataCtx({
          labelIndex: 1,
          recordIndex: 0,
          activeDataset: 'd',
          datasets: { d: { name: 'd', columns: ['起始值'], rows: [['7']] } }
        })
      )
    ).toBe('07')
  })
})

describe('database source', () => {
  it('reads the selected field and supports record offsets', () => {
    const ctx = dataCtx({ recordIndex: 0, datasets: { inventory } })
    expect(resolveSourceText({ kind: 'database', dataset: 'inventory', field: 'name' }, ctx)).toBe('alpha')
    expect(resolveSourceText({ kind: 'database', dataset: 'inventory', field: 'SKU', recordOffset: 1 }, ctx)).toBe('B-02')
    expect(resolveSourceText({ kind: 'database', dataset: 'inventory', field: 'name' }, { ...ctx, recordIndex: 1 })).toBe('beta')
  })
})

describe('date and time sources', () => {
  const fixedLocal = new Date(2024, 0, 2, 3, 4, 5).getTime()
  const fixedUtc = Date.UTC(2024, 0, 2, 3, 4, 5)

  it('uses a fixed clock for the whole job', () => {
    expect(resolveSourceText({ kind: 'date', format: 'yyyy-MM-dd' }, dataCtx({ now: fixedLocal }))).toBe('2024-01-02')
    expect(resolveSourceText({ kind: 'time', format: 'HH:mm:ss' }, dataCtx({ now: fixedLocal }))).toBe('03:04:05')
  })

  it('supports Chinese formats and day offsets', () => {
    expect(resolveSourceText({ kind: 'date', format: 'yyyy年M月d日', offset: 1 }, dataCtx({ now: fixedLocal }))).toBe('2024年1月3日')
  })

  it('supports time regions and minute offsets', () => {
    expect(resolveSourceText({ kind: 'time', format: 'HH:mm:ss', region: 'UTC', offset: 60 }, dataCtx({ now: fixedUtc }))).toBe('04:04:05')
  })
})

describe('constant, keyboard and formatting', () => {
  it('resolves constants and keyboard values', () => {
    expect(resolveSourceText({ kind: 'constant', value: 'ABC' }, dataCtx())).toBe('ABC')
    expect(resolveSourceText({ kind: 'keyboard', label: '请输入数量' }, dataCtx({ keyboardValues: { 请输入数量: '88' } }))).toBe('88')
  })

  it('applies case formatting and substring extraction', () => {
    expect(applyObjectFormat('AbcDef', 'upper', { start: 1, length: 4 })).toBe('BCDE')
  })

  it('supports trim, keep and length limits', () => {
    expect(applyObjectFormat('  ABCD  ', undefined, { start: 0, length: -1, cutType: 'trimLeft' })).toBe('ABCD  ')
    expect(applyObjectFormat('ABCDEFG', undefined, { start: 0, length: -1, cutType: 'keepRight', cutCount: 3 })).toBe('EFG')
    expect(applyObjectFormat('ABCDEFG', undefined, undefined, { mode: 'max', max: 4, trimDir: 'left' })).toBe('DEFG')
    expect(applyObjectFormat('7', undefined, undefined, { mode: 'min', min: 3, padDir: 'left', padChar: '0' })).toBe('007')
    expect(applyObjectFormat('7', undefined, undefined, { mode: 'min', min: 3, padDir: 'right', padChar: '0' })).toBe('700')
  })
})
