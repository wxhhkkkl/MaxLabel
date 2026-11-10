import { describe, expect, it } from 'vitest'
import { formatsByMedia } from '@/features/label-formats/catalog'
import { computePreviewGeometry, labelCellPositions } from '@/features/label-formats/previewGeometry'
import { LABEL_FORMATS } from '@shared/domain/labelFormats.generated'

const sheet = LABEL_FORMATS.find((format) => format.code === '608053')!
const roll = formatsByMedia(0)[0]

describe('label preview geometry', () => {
  it('lays out a sheet format from its page, label grid and gaps', () => {
    const geometry = computePreviewGeometry(sheet, 1)
    expect(geometry).toMatchObject({
      previewW: 100,
      previewH: 70,
      cols: 2,
      rows: 4,
      colGap: 2,
      rowGap: 2,
      pageW: 210,
      pageH: 297,
      totalGridW: 202,
      totalGridH: 286,
      isRoll: false,
      viewW: 238,
      viewH: 325
    })
    expect(geometry.originX).toBeCloseTo(4, 6)
    expect(geometry.originY).toBeCloseTo(5.5, 6)
  })

  it('卷筒预览只画用户选择的行列，不额外加相邻行', () => {
    const geometry = computePreviewGeometry(roll, 0)
    expect(geometry.isRoll).toBe(true)
    expect(geometry.pageH).toBe(Math.max(roll.pageHeightMm, roll.labelHeightMm))
    expect(labelCellPositions(geometry)).toHaveLength(roll.cols * roll.rows)
  })

  it('卷筒：整版网格不越出纸面（pageLeft 不能把标签推出纸宽）', () => {
    // 记录可能自带 pageLeftMm=1，而纸宽只有「宽×列 + 间距」（40×2 + 2 = 82）。
    // 若 originX 直接取 pageLeft，格子会从 1mm 画到 83mm，右侧 1mm 落在纸外。
    // 弹窗现在按「+2×左空」算纸宽，但历史记录仍可能不自洽，这里守住「不越出纸面」。
    const draft = { ...LABEL_FORMATS.find((format) => format.code === '606015')!, cols: 2, colGapMm: 2, pageWidthMm: 82 }
    const geometry = computePreviewGeometry(draft, 0)
    expect(geometry.totalGridW).toBe(82)
    expect(geometry.originX).toBe(0)
    expect(geometry.originX + geometry.totalGridW).toBeLessThanOrEqual(geometry.pageW)
  })

  it('平张纸张尺寸保持所选纸张，不被标签网格撑大', () => {
    const geometry = computePreviewGeometry({ ...sheet, labelWidthMm: 300, labelHeightMm: 400 }, 1)
    expect(geometry.pageW).toBe(210)
    expect(geometry.pageH).toBe(297)
    expect(geometry.totalGridW).toBeGreaterThan(geometry.pageW)
  })

  it('falls back to the label size when the page size is missing', () => {
    const geometry = computePreviewGeometry({ ...sheet, pageWidthMm: 0, pageHeightMm: 0 }, 1)
    expect(geometry.pageW).toBe(sheet.labelWidthMm)
    expect(geometry.pageH).toBe(sheet.labelHeightMm)
  })
})

describe('label preview cells', () => {
  const doubleColumnRoll = LABEL_FORMATS.find((format) => format.code === '604003')!

  it('卷筒双列给出两个格子（以前只画主标签一格，右边只剩序号）', () => {
    const geometry = computePreviewGeometry(doubleColumnRoll, 0)
    const cells = labelCellPositions(geometry)
    expect(cells).toHaveLength(2)
    // 两列横向按 pageLeft + 标签宽 + 列间距排开；纵向都对齐 originY
    expect(cells.map((cell) => cell.x)).toEqual([1, 44])
    expect(cells.every((cell) => cell.y === geometry.originY)).toBe(true)
  })

  it('平张按行×列铺满整版；格子数与序号数一致', () => {
    const geometry = computePreviewGeometry(sheet, 1)
    expect(labelCellPositions(geometry)).toHaveLength(geometry.cols * geometry.rows)
  })
})
