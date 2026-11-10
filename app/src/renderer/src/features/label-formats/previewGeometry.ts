import type { LabelFormatRecord } from '../../../../shared/domain/labelFormats.generated'

/** 页面四周的默认留白（每边，viewBox 单位）；调用方可按标注字号传入更大的留白。 */
export const PREVIEW_MARGIN = 14

export interface PreviewGeometry {
  previewW: number
  previewH: number
  cols: number
  rows: number
  colGap: number
  rowGap: number
  isRoll: boolean
  pageW: number
  pageH: number
  totalGridW: number
  totalGridH: number
  originX: number
  originY: number
  /** 页面四周留白（每边，viewBox 单位）。 */
  margin: number
  viewW: number
  viewH: number
}

/**
 * 起点限制在纸面内：整版网格比纸宽时从 0 起画，否则最多推到「网格右/下边贴纸边」。
 * 卷筒的纸宽是弹窗按「宽×列 + 间距」算出来的，而记录里仍带着 pageLeftMm/pageTopMm，
 * 直接采用会把整版推出纸外（40×2 + 2mm 间距的纸宽 82，pageLeft=1 → 画到 83）。
 */
function fitOrigin(preferred: number, page: number, grid: number): number {
  return Math.min(Math.max(0, preferred), Math.max(0, page - grid))
}

/**
 * Geometry of the “选择标签格式” preview.
 *
 * 预览只画用户当前选择的「行 × 列」，不再额外铺相邻行/卷筒上下露边 ——
 * 选一行就显示一行，选几列就显示几列。
 */
export function computePreviewGeometry(record: LabelFormatRecord, mediaType: 0 | 1, margin = PREVIEW_MARGIN): PreviewGeometry {
  const previewW = Math.max(1, record.labelWidthMm)
  const previewH = Math.max(1, record.labelHeightMm)
  const cols = record.cols
  const rows = record.rows
  const colGap = record.colGapMm
  const rowGap = record.rowGapMm
  const isRoll = mediaType === 0
  // 平张的纸张由用户选择的纸张尺寸决定，不能被标签宽高/行列撑大；
  // 卷筒/条幅的纸面由标签网格自动计算，保持原来的兜底。
  const pageW = mediaType === 1
    ? (record.pageWidthMm > 0 ? record.pageWidthMm : previewW)
    : Math.max(record.pageWidthMm, previewW)
  const pageH = mediaType === 1
    ? (record.pageHeightMm > 0 ? record.pageHeightMm : previewH)
    : Math.max(record.pageHeightMm, previewH)
  const totalGridW = cols * previewW + Math.max(0, cols - 1) * colGap
  const totalGridH = rows * previewH + Math.max(0, rows - 1) * rowGap
  const originX = fitOrigin(record.pageLeftMm || Math.max(0, (pageW - totalGridW) / 2), pageW, totalGridW)
  const originY = fitOrigin(record.pageTopMm || Math.max(0, (pageH - totalGridH) / 2), pageH, totalGridH)
  return {
    previewW,
    previewH,
    cols,
    rows,
    colGap,
    rowGap,
    isRoll,
    pageW,
    pageH,
    totalGridW,
    totalGridH,
    originX,
    originY,
    margin,
    viewW: pageW + margin * 2,
    viewH: pageH + margin * 2
  }
}

/**
 * 预览里要画的标签格子（整版 rows × cols）。
 *
 * ⚠️ 卷筒格式以前只画了**主标签一格**，但序号仍按行×列画 —— 双列卷筒就成了
 * 「左边有标签、右边只有数字」。卷筒与平张的格子必须同一份计算。
 */
export function labelCellPositions(g: PreviewGeometry): Array<{ x: number; y: number }> {
  const cells: Array<{ x: number; y: number }> = []
  for (let row = 0; row < g.rows; row += 1) {
    for (let col = 0; col < g.cols; col += 1) {
      cells.push({ x: g.originX + col * (g.previewW + g.colGap), y: g.originY + row * (g.previewH + g.rowGap) })
    }
  }
  return cells
}
