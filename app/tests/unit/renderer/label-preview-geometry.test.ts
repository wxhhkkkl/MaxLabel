import { describe, expect, it } from 'vitest'
import { formatsByMedia } from '@/features/label-formats/catalog'
import { computePreviewGeometry } from '@/features/label-formats/previewGeometry'
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
