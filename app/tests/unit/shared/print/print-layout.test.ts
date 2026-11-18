import { describe, expect, it } from 'vitest'
import { pageCells, pageSizeMm, printLayoutOf } from '@shared/print/layout'
import type { LabelDoc } from '@shared/domain/document'

const label = (widthMm: number, heightMm: number): LabelDoc => ({ version: 1, name: 'x', widthMm, heightMm, objects: [] })

describe('printLayoutOf：打印页对齐实际介质', () => {
  it('单联标签不套用页面留白，按标签本身出页', () => {
    const doc = label(60, 40)
    const layout = { rows: 1, cols: 1, rowGapMm: 3, colGapMm: 3, pageWidthMm: 62, pageHeightMm: 40, pageLeftMm: 1 }
    expect(printLayoutOf(doc, layout)).toBeUndefined()
    expect(pageSizeMm(doc, printLayoutOf(doc, layout))).toEqual({ widthMm: 60, heightMm: 40 })
  })

  it('页面只比标签阵列大一点（卷筒衬纸边）时按阵列出页，并去掉左空/上空', () => {
    const doc = label(30, 20)
    const layout = { rows: 1, cols: 3, rowGapMm: 3, colGapMm: 3, pageWidthMm: 98, pageHeightMm: 20, pageLeftMm: 1 }
    const print = printLayoutOf(doc, layout)
    expect(print).toBeDefined()
    expect(pageSizeMm(doc, print)).toEqual({ widthMm: 96, heightMm: 20 })
    const cells = pageCells(doc, print)
    expect(cells[0].x).toBe(0)
    expect(cells[1].x).toBe(33)
  })

  it('整张纸（A4 平张）保持页面尺寸与留白', () => {
    const doc = label(38, 47)
    const layout = { rows: 6, cols: 5, rowGapMm: 2, colGapMm: 2, pageWidthMm: 210, pageHeightMm: 297, pageLeftMm: 5, pageTopMm: 5 }
    expect(printLayoutOf(doc, layout)).toBe(layout)
    expect(pageSizeMm(doc, printLayoutOf(doc, layout))).toEqual({ widthMm: 210, heightMm: 297 })
  })

  it('没有页面尺寸时原样返回', () => {
    const doc = label(60, 40)
    const layout = { rows: 1, cols: 2, rowGapMm: 0, colGapMm: 3 }
    expect(printLayoutOf(doc, layout)).toBe(layout)
  })
})
