import { describe, expect, it } from 'vitest'
import { pageCells, pageSizeMm, printLayoutOf } from '@shared/print/layout'
import { normalizeDocument, type LabelDoc } from '@shared/domain/document'

const label = (widthMm: number, heightMm: number): LabelDoc => ({ version: 1, name: 'x', widthMm, heightMm, objects: [] })

describe('printLayoutOf：打印页对齐实际介质', () => {
  it('单联标签不套用页面留白，按标签本身出页', () => {
    const doc = label(60, 40)
    const layout = { rows: 1, cols: 1, rowGapMm: 3, colGapMm: 3, pageWidthMm: 62, pageHeightMm: 40, pageLeftMm: 1 }
    expect(printLayoutOf(doc, layout)).toBeUndefined()
    expect(pageSizeMm(doc, printLayoutOf(doc, layout))).toEqual({ widthMm: 60, heightMm: 40 })
  })

  it('页面只比标签阵列大一点（卷筒衬纸边）时按阵列出页，并去掉左空/上空', () => {
    const doc = normalizeDocument({
      ...label(30, 20),
      // LSDX 导入后打开文档时会走规范化，历史布局不含介质类型。
      layout: { shape: 'rect', rows: 1, cols: 3, rowGapMm: 3, colGapMm: 3, pageWidthMm: 98, pageHeightMm: 20, pageLeftMm: 1 }
    })
    expect(doc.formatKind).toBe('custom')
    const print = printLayoutOf(doc, doc.layout)
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

  it('紧凑平张仍保留纸张大小和标签偏移', () => {
    const doc = label(50, 30)
    const layout = { mediaType: 1 as const, rows: 1, cols: 2, rowGapMm: 0, colGapMm: 2,
      pageWidthMm: 108, pageHeightMm: 36, pageLeftMm: 3, pageTopMm: 3 }
    const print = printLayoutOf(doc, layout)
    expect(pageSizeMm(doc, print)).toEqual({ widthMm: 108, heightMm: 36 })
    expect(pageCells(doc, print)).toEqual([{ index: 0, x: 3, y: 3 }, { index: 1, x: 55, y: 3 }])
  })

  it('单联平张也使用显式设置的纸张大小', () => {
    const doc = label(50, 30)
    const layout = { mediaType: 1 as const, rows: 1, cols: 1, rowGapMm: 0, colGapMm: 0,
      pageWidthMm: 56, pageHeightMm: 36, pageLeftMm: 3, pageTopMm: 3 }
    expect(printLayoutOf(doc, layout)).toBe(layout)
  })

  it('条幅输出保留上空和微调，并把纸张扩展到成品底边', () => {
    const doc = label(80, 20)
    const layout = { mediaType: 2 as const, rows: 1, cols: 1, rowGapMm: 0, colGapMm: 0,
      pageWidthMm: 86, pageHeightMm: 20, pageLeftMm: 3, pageTopMm: 3, offsetYMm: 1 }
    const print = printLayoutOf(doc, layout)
    expect(pageSizeMm(doc, print)).toEqual({ widthMm: 86, heightMm: 24 })
    expect(pageCells(doc, print)).toEqual([{ index: 0, x: 3, y: 4 }])
  })

  it('没有页面尺寸时原样返回', () => {
    const doc = label(60, 40)
    const layout = { rows: 1, cols: 2, rowGapMm: 0, colGapMm: 3 }
    expect(printLayoutOf(doc, layout)).toBe(layout)
  })
})
