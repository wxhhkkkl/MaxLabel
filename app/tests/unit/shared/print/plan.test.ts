import { describe, expect, it } from 'vitest'
import type { Dataset } from '@shared/domain/datasource'
import { pageCells } from '@shared/print/layout'
import { buildExecutablePrintPlan, buildPrintPlan } from '@shared/print/plan'
import { resolvePrintPlanPageScene } from '@shared/print/scene'
import { dataCtx, sampleDoc } from '../../../helpers/factories'

const dataset: Dataset = { name: '货物', columns: ['copies'], rows: [['1'], ['2'], ['2'], ['1']] }

describe('print plan', () => {
  it('computes imposition pages from database records', () => {
    const plan = buildPrintPlan({ test: false, requestedCount: 4, recordStart: 0, dataset, cellsPerPage: 2, defaultCopies: 1, copyField: 'copies' })
    expect(plan.pages.map((page) => page.cells.map((cell) => cell.recordIndex))).toEqual([[0], [1, 2], [3]])
    expect(plan.physicalPageCount).toBe(3)
    expect(plan.physicalLabelCount).toBe(6)
    expect(plan.serialAdvanceCount).toBe(4)
  })

  it('advances 10 database rows and serials in order', () => {
    const tenRows: Dataset = { name: '十行', columns: ['sku'], rows: Array.from({ length: 10 }, (_, i) => [String(i + 1)]) }
    const plan = buildPrintPlan({ test: false, requestedCount: 10, recordStart: 0, dataset: tenRows, cellsPerPage: 1, defaultCopies: 1 })
    expect(plan.pages.flatMap((page) => page.cells.map((cell) => cell.recordIndex))).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9])
    expect(plan.logicalLabelCount).toBe(10)
    expect(plan.serialAdvanceCount).toBe(10)
  })

  it('keeps empty slots for the first-page start position', () => {
    const plan = buildPrintPlan({ test: false, requestedCount: 2, recordStart: 0, dataset, cellsPerPage: 3, startSlot: 2, defaultCopies: 1 })
    expect(plan.pages[0].cells.map((cell) => cell.slotIndex)).toEqual([1, 2])
    expect(plan.warnings.some((warning) => warning.includes('第 2 个拼版位置'))).toBe(true)
  })

  it('supports pre-filtered record indices while preserving original row numbers', () => {
    const plan = buildPrintPlan({ test: false, requestedCount: 2, recordStart: 0, recordIndices: [0, 2], dataset, cellsPerPage: 2, defaultCopies: 1 })
    expect(plan.pages.flatMap((page) => page.cells.map((cell) => cell.recordIndex))).toEqual([0, 2])
    expect(plan.logicalLabelCount).toBe(2)
  })

  it('shares the deduplicated plan between preview and printing', () => {
    const plan = buildExecutablePrintPlan(
      { test: false, requestedCount: 4, recordStart: 0, dataset, cellsPerPage: 1, defaultCopies: 1, copyField: 'copies' },
      { deduplicateRecords: true }
    )
    expect(plan.pages.flatMap((page) => page.cells.map((cell) => cell.recordIndex))).toEqual([0, 1])
    expect(plan.physicalLabelCount).toBe(3)
  })

  it('splits copies by label page and preserves order', () => {
    const plan = buildPrintPlan({ test: false, requestedCount: 2, recordStart: 0, dataset, cellsPerPage: 1, defaultCopies: 1, copyField: 'copies' })
    expect(plan.pages.map((page) => ({ record: page.cells[0].recordIndex, copies: page.copies }))).toEqual([
      { record: 0, copies: 1 },
      { record: 1, copies: 2 }
    ])
  })

  it('advances records and serials from the start record', () => {
    const plan = buildPrintPlan({ test: false, requestedCount: 2, recordStart: 1, dataset, cellsPerPage: 2, defaultCopies: 1 })
    expect(plan.pages.flatMap((page) => page.cells.map((cell) => ({ record: cell.recordIndex, label: cell.labelIndex })))).toEqual([
      { record: 1, label: 1 },
      { record: 2, label: 2 }
    ])
    expect(plan.recordStart).toBe(1)
    expect(plan.recordCount).toBe(2)
    expect(plan.serialAdvanceCount).toBe(2)
  })

  it('multiplies requested count by copies without advancing serials for copies', () => {
    const plan = buildPrintPlan({ test: false, requestedCount: 3, recordStart: 0, cellsPerPage: 2, defaultCopies: 2 })
    expect(plan.logicalLabelCount).toBe(3)
    expect(plan.physicalLabelCount).toBe(6)
    expect(plan.serialAdvanceCount).toBe(3)
    expect(plan.pages.map((page) => page.cells.length)).toEqual([2, 1])
    expect(plan.pages.every((page) => page.copies === 2)).toBe(true)
  })

  it('rejects logical, copy and physical label counts above the limits', () => {
    expect(() => buildPrintPlan({ test: false, requestedCount: 100001, recordStart: 0, cellsPerPage: 1, defaultCopies: 1 })).toThrow(/超过限制/)
    expect(() => buildPrintPlan({ test: false, requestedCount: 1, recordStart: 0, cellsPerPage: 1, defaultCopies: 100000 })).toThrow(/超过限制/)
    expect(() => buildPrintPlan({ test: false, requestedCount: 100000, recordStart: 0, cellsPerPage: 1, defaultCopies: 11 })).toThrow(/超过限制/)
  })

  it('prints only one label for a test print even in an imposition', () => {
    const plan = buildPrintPlan({ test: true, requestedCount: 1, recordStart: 0, dataset, cellsPerPage: 4, startSlot: 3, defaultCopies: 1 })
    expect(plan.logicalLabelCount).toBe(1)
    expect(plan.physicalLabelCount).toBe(1)
    expect(plan.pages[0].cells.map((cell) => cell.slotIndex)).toEqual([2])
  })
})

describe('imposition geometry', () => {
  const layout = { rows: 2, cols: 3, rowGapMm: 2, colGapMm: 3, printOrder: 'col' as const, startPos: 'br' as const, labelPrintDirection: 'ltr' as const, offsetXMm: 1, offsetYMm: 2 }

  it('shares row/column gaps, column order, bottom-right start and offsets', () => {
    const cells = pageCells(sampleDoc(), layout)
    expect(cells.map(({ x, y }) => ({ x, y }))).toEqual([
      { x: 127, y: 44 },
      { x: 127, y: 2 },
      { x: 64, y: 44 },
      { x: 64, y: 2 },
      { x: 1, y: 44 },
      { x: 1, y: 2 }
    ])

    const plan = buildPrintPlan({ test: false, requestedCount: 3, recordStart: 0, cellsPerPage: 6, defaultCopies: 1 })
    const scene = resolvePrintPlanPageScene(sampleDoc(), dataCtx({ count: 3, totalLabels: 3, title: 'imposition', printerName: 'test' }), layout, plan.pages[0])
    expect(scene.primitives.filter((primitive) => primitive.object.id === '1').map((primitive) => ({ x: primitive.object.x, y: primitive.object.y }))).toEqual([
      { x: 127, y: 44 },
      { x: 127, y: 2 },
      { x: 64, y: 44 }
    ])
  })

  it('translates the whole array by page left/top margins', () => {
    const margined = { ...layout, pageLeftMm: 10, pageTopMm: 5 }
    expect(pageCells(sampleDoc(), margined).map(({ x, y }) => ({ x, y }))).toEqual([
      { x: 137, y: 49 },
      { x: 137, y: 7 },
      { x: 74, y: 49 },
      { x: 74, y: 7 },
      { x: 11, y: 49 },
      { x: 11, y: 7 }
    ])
    expect(pageCells(sampleDoc(), layout).map(({ x }) => x)).toEqual([127, 127, 64, 64, 1, 1])
  })
})
