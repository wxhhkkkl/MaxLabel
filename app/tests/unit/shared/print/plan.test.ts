import { describe, expect, it } from 'vitest'
import type { Dataset } from '@shared/domain/datasource'
import { pageCells } from '@shared/print/layout'
import { buildExecutablePrintPlan, buildPrintPlan } from '@shared/print/plan'
import { sceneHasRepeatedObjectInstances } from '@shared/print/capabilities'
import { resolvePrintPlanPageScene } from '@shared/print/scene'
import { dataCtx, sampleDoc } from '../../../helpers/factories'

const dataset: Dataset = { name: '货物', columns: ['copies'], rows: [['1'], ['2'], ['2'], ['1']] }

describe('print plan', () => {
  it('computes imposition pages from database records', () => {
    const plan = buildPrintPlan({ test: false, requestedCount: 4, recordStart: 0, dataset, cellsPerPage: 2, defaultCopies: 1, copyField: 'copies' })
    // 拷贝优先铺满当前拼版页：r1/r2 各两份，会跨页各占一格。
    expect(plan.pages.map((page) => page.cells.map((cell) => cell.recordIndex))).toEqual([[0, 1], [1, 2], [2, 3]])
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
    expect(plan.pages.flatMap((page) => page.cells.map((cell) => cell.recordIndex))).toEqual([0, 1, 1])
    expect(plan.physicalLabelCount).toBe(3)
  })

  it('emits each copy as its own physical label with a sequential labelIndex', () => {
    const plan = buildPrintPlan({ test: false, requestedCount: 2, recordStart: 0, dataset, cellsPerPage: 1, defaultCopies: 1, copyField: 'copies' })
    expect(plan.pages.map((page) => ({ record: page.cells[0].recordIndex, label: page.cells[0].labelIndex, copies: page.copies }))).toEqual([
      { record: 0, label: 1, copies: 1 },
      { record: 1, label: 2, copies: 1 },
      { record: 1, label: 3, copies: 1 }
    ])
    expect(plan.serialAdvanceCount).toBe(2)
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
    // 多联版式：每份拷贝占一个槽位，页面不再按份数整体重复。
    expect(plan.pages.map((page) => page.cells.length)).toEqual([2, 2, 2])
    expect(plan.pages.every((page) => page.copies === 1)).toBe(true)
  })

  it('moves a duplicate slotIndex to the free slot instead of drawing twice in one label', () => {
    const layout = { rows: 1, cols: 2, rowGapMm: 2, colGapMm: 2 }
    const page = {
      pageIndex: 0,
      copies: 1,
      cells: [
        { logicalIndex: 0, recordIndex: 0, labelIndex: 1, copies: 1, slotIndex: 1 },
        { logicalIndex: 0, recordIndex: 0, labelIndex: 1, copies: 1, slotIndex: 1 }
      ]
    }
    const scene = resolvePrintPlanPageScene(sampleDoc(), dataCtx({ count: 2, totalLabels: 2 }), layout, page)
    const xs = scene.primitives.filter((primitive) => primitive.object.id === '2').map((primitive) => primitive.object.x)
    expect(xs.sort((a, b) => a - b)).toEqual([4, 66])
    expect(sceneHasRepeatedObjectInstances(scene)).toBe(true)
  })

  it('renders both copies in the two-up page when starting at label 1', () => {
    const plan = buildPrintPlan({ test: false, requestedCount: 1, recordStart: 0, cellsPerPage: 2, defaultCopies: 2 })
    const layout = { rows: 1, cols: 2, rowGapMm: 2, colGapMm: 2 }
    const scene = resolvePrintPlanPageScene(sampleDoc(), dataCtx({ count: 2, totalLabels: 2 }), layout, plan.pages[0])
    const xs = scene.primitives.filter((primitive) => primitive.object.id === '2').map((primitive) => primitive.object.x)
    expect(xs.sort((a, b) => a - b)).toEqual([4, 66])
  })

  it('fills the right label with the second copy instead of printing the left twice', () => {
    const one: Dataset = { name: '单条', columns: ['copies'], rows: [['2']] }
    const plan = buildPrintPlan({ test: false, requestedCount: 1, recordStart: 0, dataset: one, cellsPerPage: 2, defaultCopies: 1, copyField: 'copies' })
    expect(plan.pages).toHaveLength(1)
    expect(plan.pages[0].cells.map((cell) => cell.recordIndex)).toEqual([0, 0])
    expect(plan.pages[0].cells.map((cell) => cell.recordLabelIndex)).toEqual([0, 1])
    expect(plan.pages[0].cells.map((cell) => cell.copies)).toEqual([1, 1])
    expect(plan.pages[0].copies).toBe(1)
    expect(plan.physicalLabelCount).toBe(2)
    expect(plan.serialAdvanceCount).toBe(1)
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
