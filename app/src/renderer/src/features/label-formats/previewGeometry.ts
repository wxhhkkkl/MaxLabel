import type { LabelFormatRecord } from '../../../../shared/domain/labelFormats.generated'

export const PREVIEW_MARGIN = 28
export const ROLL_SLICES = 2

export interface PreviewGeometry {
  previewW: number
  previewH: number
  cols: number
  rows: number
  colGap: number
  rowGap: number
  isRoll: boolean
  rollSlices: number
  rollSliceH: number
  rollStripExtra: number
  pageW: number
  pageH: number
  totalGridW: number
  totalGridH: number
  originX: number
  originY: number
  viewW: number
  viewH: number
}

/**
 * Geometry of the “选择标签格式” preview. Roll media renders a vertical strip with the
 * main label plus a slice of the adjacent labels above and below.
 */
export function computePreviewGeometry(record: LabelFormatRecord, mediaType: 0 | 1): PreviewGeometry {
  const previewW = Math.max(1, record.labelWidthMm)
  const previewH = Math.max(1, record.labelHeightMm)
  const cols = record.cols
  const rows = record.rows
  const colGap = record.colGapMm
  const rowGap = record.rowGapMm
  const isRoll = mediaType === 0
  const rollSliceH = Math.max(3, Math.round(previewH * 0.12))
  const rollStripExtra = isRoll ? ROLL_SLICES * (rowGap + rollSliceH) : 0
  const pageW = Math.max(record.pageWidthMm, previewW)
  const pageH = Math.max(record.pageHeightMm, previewH) + rollStripExtra
  const totalGridW = cols * previewW + Math.max(0, cols - 1) * colGap
  const totalGridH = rows * previewH + Math.max(0, rows - 1) * rowGap
  const originX = record.pageLeftMm || Math.max(0, (pageW - totalGridW) / 2)
  const originY = record.pageTopMm || Math.max(0, (pageH - totalGridH) / 2)
  return {
    previewW,
    previewH,
    cols,
    rows,
    colGap,
    rowGap,
    isRoll,
    rollSlices: ROLL_SLICES,
    rollSliceH,
    rollStripExtra,
    pageW,
    pageH,
    totalGridW,
    totalGridH,
    originX,
    originY,
    viewW: pageW + PREVIEW_MARGIN,
    viewH: pageH + PREVIEW_MARGIN
  }
}
