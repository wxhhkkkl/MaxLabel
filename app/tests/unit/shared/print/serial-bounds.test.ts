import { describe, expect, it } from 'vitest'
import type { DataCtx, Dataset, SerialSource } from '@shared/domain/datasource'
import type { LabelDoc } from '@shared/domain/document'
import type { LabelObject } from '@shared/domain/objects'
import { buildCompactPrintPlan, buildPrintPlan } from '@shared/print/plan'
import { findSerialBoundaryViolation } from '@shared/print/serialBounds'
import { dataCtx } from '../../../helpers/factories'

function serial(overrides: Partial<SerialSource> = {}): SerialSource {
  return { kind: 'serial', prefix: '', start: 1, step: 1, digits: 1, current: 1, serialType: 'boundary', ...overrides }
}

function barcode(overrides: Partial<SerialSource> = {}): LabelObject {
  return {
    id: 'bc',
    type: 'barcode',
    x: 0,
    y: 0,
    w: 30,
    h: 10,
    rotation: 0,
    symbology: 'code128',
    showText: false,
    source: serial(overrides)
  } as LabelObject
}

function doc(objects: LabelObject[]): LabelDoc {
  return { version: 1, name: 't', widthMm: 60, heightMm: 40, objects }
}

function planFor(count: number, dataset?: Dataset) {
  return buildPrintPlan({
    test: false,
    requestedCount: count,
    recordStart: 0,
    dataset,
    cellsPerPage: 1,
    defaultCopies: 1
  })
}

const inventory: Dataset = { name: 'inv', columns: ['sku'], rows: [['a'], ['b'], ['c']] }

function ctxWith(dataset?: Dataset): DataCtx {
  return dataCtx({
    ...(dataset ? { datasets: { [dataset.name]: dataset }, activeDataset: dataset.name } : {})
  })
}

describe('序列号边界值', () => {
  it('agrees with per-label checks for reordered records, repeats and varying copies', () => {
    const rows: Dataset = { name: 'rows', columns: ['Start', 'Copies'], rows: [['1', '6'], ['9', '8'], ['2', '3']] }
    const input = { test: false, requestedCount: 3, recordStart: 0, dataset: rows, recordIndices: [2, 0, 1], cellsPerPage: 3,
      startSlot: 2, defaultCopies: 1, copyField: 'Copies' }
    const ctx = ctxWith(rows)
    for (const initialValueSource of ['fixed', 'database'] as const) {
      for (const repeatBasis of ['label', 'record'] as const) {
        for (const resetEachRecord of [false, true]) {
          const d = doc([barcode({ end: 10, repeat: 2, repeatBasis, resetEachRecord,
            ...(initialValueSource === 'database' ? { initialValueSource, initialValueField: 'Start' } : {}) })])
          expect(findSerialBoundaryViolation(d, buildCompactPrintPlan(input), ctx))
            .toEqual(findSerialBoundaryViolation(d, buildPrintPlan(input), ctx))
        }
      }
    }
  })
  it('checks a 150,000-label job within the supported limits', () => {
    const plan = buildPrintPlan({ test: false, requestedCount: 75000, recordStart: 0, cellsPerPage: 400, defaultCopies: 2 })
    const d = doc([barcode({ end: 150000, repeatBasis: 'label' })])
    expect(plan.physicalLabelCount).toBe(150000)
    expect(findSerialBoundaryViolation(d, plan, ctxWith())).toBeNull()
  })

  it('按标签推进时，数量和终点一致就不报越界', () => {
    const d = doc([barcode({ end: 5, repeatBasis: 'label' })])
    expect(findSerialBoundaryViolation(d, planFor(5), ctxWith())).toBeNull()
  })

  it('超出终点时报出剩余可用数量', () => {
    const d = doc([barcode({ end: 5, repeatBasis: 'label' })])
    expect(findSerialBoundaryViolation(d, planFor(6), ctxWith())).toEqual({ endText: '5', available: 5, required: 6 })
  })

  it('按记录推进时按记录数计算边界', () => {
    const d = doc([barcode({ end: 2 })])
    expect(findSerialBoundaryViolation(d, planFor(2, inventory), ctxWith(inventory))).toBeNull()
    expect(findSerialBoundaryViolation(d, planFor(3, inventory), ctxWith(inventory))?.available).toBe(2)
  })

  it('支持递减序列', () => {
    const d = doc([barcode({ current: 5, end: 1, step: -1, repeatBasis: 'label' })])
    expect(findSerialBoundaryViolation(d, planFor(5), ctxWith())).toBeNull()
    expect(findSerialBoundaryViolation(d, planFor(6), ctxWith())?.available).toBe(5)
  })

  it.each([
    { first: '1', last: '10', step: 1, end: 10 },
    { first: '10', last: '1', step: -1, end: 1 }
  ])('uses each record’s database start with step $step', ({ first, last, step, end }) => {
    const rows: Dataset = { name: 'rows', columns: ['Start'], rows: [[first], [last]] }
    const d = doc([barcode({ end, step, repeatBasis: 'label', initialValueSource: 'database', initialValueField: 'Start' })])
    expect(findSerialBoundaryViolation(d, planFor(2, rows), ctxWith(rows))).toEqual({ endText: String(end), available: 1, required: 2 })
  })

  it('does not use the first record’s start to reject later records', () => {
    const rows: Dataset = { name: 'rows', columns: ['Start'], rows: [['10'], ['8']] }
    const d = doc([barcode({ end: 10, repeatBasis: 'label', initialValueSource: 'database', initialValueField: 'Start' })])
    expect(findSerialBoundaryViolation(d, planFor(2, rows), ctxWith(rows))).toBeNull()
  })

  it('文字对象的序列号不受边界约束', () => {
    const text = { id: 't', type: 'text', x: 0, y: 0, w: 30, h: 10, rotation: 0, source: serial({ end: 2 }) } as LabelObject
    expect(findSerialBoundaryViolation(doc([text]), planFor(10), ctxWith())).toBeNull()
  })

  it('没填终点值时不限制', () => {
    expect(findSerialBoundaryViolation(doc([barcode()]), planFor(100), ctxWith())).toBeNull()
  })

  it('不是「边界值」类型时，即使有终点值也不限制', () => {
    const d = doc([barcode({ serialType: undefined, end: 2 })])
    expect(findSerialBoundaryViolation(d, planFor(10), ctxWith())).toBeNull()
  })

  it('终点按终点值位数补零显示在提示里（1–100 → 001 起始）', () => {
    const d = doc([barcode({ end: 100, padZero: true, repeatBasis: 'label' })])
    const violation = findSerialBoundaryViolation(d, planFor(101), ctxWith())
    expect(violation?.endText).toBe('100')
    expect(violation?.available).toBe(100)
  })
})
