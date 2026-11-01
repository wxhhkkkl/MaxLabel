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
      rollStripExtra: 0,
      viewW: 238,
      viewH: 325
    })
    expect(geometry.originX).toBeCloseTo(4, 6)
    expect(geometry.originY).toBeCloseTo(5.5, 6)
  })

  it('adds strip slices for roll media', () => {
    const geometry = computePreviewGeometry(roll, 0)
    const slice = Math.max(3, Math.round(Math.max(1, roll.labelHeightMm) * 0.12))
    expect(geometry.isRoll).toBe(true)
    expect(geometry.rollSlices).toBe(2)
    expect(geometry.rollSliceH).toBe(slice)
    expect(geometry.rollStripExtra).toBe(2 * (roll.rowGapMm + slice))
    expect(geometry.pageH).toBe(Math.max(roll.pageHeightMm, roll.labelHeightMm) + geometry.rollStripExtra)
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
    // 两列横向按 pageLeft + 标签宽 + 列间距排开；纵向都对齐 originY（卷筒带上下露边，originY > 0）
    expect(cells.map((cell) => cell.x)).toEqual([1, 44])
    expect(cells.every((cell) => cell.y === geometry.originY)).toBe(true)
  })

  it('平张按行×列铺满整版；格子数与序号数一致', () => {
    const geometry = computePreviewGeometry(sheet, 1)
    expect(labelCellPositions(geometry)).toHaveLength(geometry.cols * geometry.rows)
  })
})
