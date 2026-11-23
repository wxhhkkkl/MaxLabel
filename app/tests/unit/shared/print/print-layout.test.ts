import { describe, expect, it } from 'vitest'
import { pageCells, pageSizeMm, printLayoutOf, singleLabelLayout } from '@shared/print/layout'
import { normalizeDocument, type LabelDoc } from '@shared/domain/document'

const label = (widthMm: number, heightMm: number): LabelDoc => ({ version: 1, name: 'x', widthMm, heightMm, objects: [] })

describe('printLayoutOf：打印页对齐实际介质', () => {
  it('单联标签按标签本身出页，但保留左空/上空作为打印偏移', () => {
    const doc = label(60, 40)
    const layout = { rows: 1, cols: 1, rowGapMm: 3, colGapMm: 3, pageWidthMm: 62, pageHeightMm: 40, pageLeftMm: 1 }
    const print = printLayoutOf(doc, layout)
    expect(print).toMatchObject({ pageWidthMm: undefined, pageHeightMm: undefined, pageLeftMm: 1 })
    expect(pageSizeMm(doc, print)).toEqual({ widthMm: 60, heightMm: 40 })
    expect(pageCells(doc, print)[0]).toMatchObject({ x: 1, y: 0 })
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
    // 左空=1 保留为整组标签的打印偏移。
    expect(cells[0].x).toBe(1)
    expect(cells[1].x).toBe(34)
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

describe('singleLabelLayout：单标签打印/导出只出标签格', () => {
  it('A4 平张上的单标签压回标签尺寸，忽略纸边距和拼版', () => {
    const doc = label(38, 47)
    const layout = { rows: 6, cols: 5, rowGapMm: 2, colGapMm: 2, pageWidthMm: 210, pageHeightMm: 297, pageLeftMm: 5, pageTopMm: 5 }
    const print = singleLabelLayout(doc, layout)
    expect(pageSizeMm(doc, print)).toEqual({ widthMm: 38, heightMm: 47 })
    expect(pageCells(doc, print)).toEqual([{ index: 0, x: 0, y: 0 }])
  })

  it('卷筒 7 联格式也只出首枚标签', () => {
    const doc = label(192, 38)
    const layout = { rows: 7, cols: 1, rowGapMm: 0, colGapMm: 0, pageWidthMm: 210, pageHeightMm: 297 }
    expect(pageSizeMm(doc, singleLabelLayout(doc, layout))).toEqual({ widthMm: 192, heightMm: 38 })
  })

  it('原始布局有纸张尺寸、但 printLayoutOf 已把页面压回阵列时仍只出首枚', () => {
    const doc = label(28.9, 8.5)
    const source = { rows: 34, cols: 7, rowGapMm: 0, colGapMm: 0,
      pageWidthMm: 210, pageHeightMm: 297, pageLeftMm: 3.85, pageTopMm: 4 }
    const print = printLayoutOf(doc, source)
    expect(print?.pageWidthMm).toBeUndefined()
    const single = singleLabelLayout(doc, print, source)
    expect(pageSizeMm(doc, single)).toEqual({ widthMm: 28.9, heightMm: 8.5 })
  })

  it('没有显式纸张尺寸的卷筒阵列保留整行（1×3 → 109mm）', () => {
    const doc = label(35, 20)
    const layout = { rows: 1, cols: 3, rowGapMm: 2, colGapMm: 2, pageLeftMm: 1 }
    const print = singleLabelLayout(doc, layout)
    expect(pageSizeMm(doc, print)).toEqual({ widthMm: 109, heightMm: 20 })
    expect(pageCells(doc, print)[0].x).toBe(1)
  })

  it('1×2 行即使纸张尺寸更大也只出行宽（s083 价格标签 75×30.5 → 67×19.5）', () => {
    const doc = label(32, 19.5)
    const source = { rows: 1, cols: 2, rowGapMm: 3, colGapMm: 3, pageWidthMm: 75, pageHeightMm: 30.5, pageLeftMm: 4, pageTopMm: 5.5 }
    const print = printLayoutOf(doc, source)
    const single = singleLabelLayout(doc, print, source)
    expect(pageSizeMm(doc, single)).toEqual({ widthMm: 67, heightMm: 19.5 })
  })

  it('1×3 卷筒即使存了纸张尺寸也保留整行（伯爵七号）', () => {
    const doc = label(35, 20)
    const source = { rows: 1, cols: 3, rowGapMm: 2, colGapMm: 2, pageWidthMm: 111, pageHeightMm: 20, pageLeftMm: 1 }
    const print = printLayoutOf(doc, source)
    const single = singleLabelLayout(doc, print, source)
    expect(pageSizeMm(doc, single)).toEqual({ widthMm: 109, heightMm: 20 })
  })

  it('没有布局时保持 undefined', () => {
    expect(singleLabelLayout(label(60, 40), undefined)).toBeUndefined()
  })
})
