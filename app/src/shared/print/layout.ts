import type { DataCtx } from '../domain/datasource'
import type { LabelDoc, PageOrientation } from '../domain/document'
import type { PaperGeometry } from '../domain/paper'

export interface PageLayout extends PaperGeometry {
  rows: number
  cols: number
  rowGapMm: number
  colGapMm: number
  pageWidthMm?: number
  pageHeightMm?: number
  /** 真机「标签格式设置 → 页面」的左空(L)/上空(T)：标签阵列在页面里的起点（毫米）。 */
  pageLeftMm?: number
  pageTopMm?: number
  printOrder?: 'row' | 'col'
  labelPrintDirection?: 'ltr' | 'rtl'
  startPos?: 'tl' | 'tr' | 'bl' | 'br'
  offsetXMm?: number
  offsetYMm?: number
}

function dimensions(layout?: PageLayout) {
  const rows = layout?.rows ?? 1
  const cols = layout?.cols ?? 1
  if (!Number.isInteger(rows) || !Number.isInteger(cols) || rows < 1 || cols < 1) throw new Error('拼版行列必须为正整数')
  return { rows, cols }
}

export function normalizePageOrientation(value: unknown): PageOrientation {
  const angle = typeof value === 'number' && Number.isFinite(value) ? value : 0
  return (((Math.round(angle / 90) * 90) % 360 + 360) % 360) as PageOrientation
}

/** Apply the print-dialog 180° output option without mutating the template. */
export function rotateDocumentForPrint<T extends Pick<LabelDoc, 'orientation'>>(doc: T, enabled: boolean): T {
  if (!enabled) return doc
  return { ...doc, orientation: ((normalizePageOrientation(doc.orientation) + 180) % 360) as PageOrientation }
}

/**
 * Follow the physical paper direction at output time without mutating the
 * template.  The page dimensions are the printer paper dimensions when a
 * custom page is present, otherwise the current imposition dimensions.  A
 * right-angle turn is needed only when the content and paper have opposite
 * portrait/landscape directions; square pages are left unchanged.
 */
export function autoRotateDocumentForPrint<T extends Pick<LabelDoc, 'widthMm' | 'heightMm' | 'orientation' | 'layout'>>(doc: T, enabled: boolean): T {
  if (!enabled) return doc
  const label = orientedLabelSize(doc)
  const rows = doc.layout?.rows ?? 1
  const cols = doc.layout?.cols ?? 1
  const pageWidth = doc.layout?.pageWidthMm ?? label.widthMm * cols + (doc.layout?.colGapMm ?? 0) * (cols - 1)
  const pageHeight = doc.layout?.pageHeightMm ?? label.heightMm * rows + (doc.layout?.rowGapMm ?? 0) * (rows - 1)
  const pageLandscape = pageWidth > pageHeight
  const contentLandscape = label.widthMm > label.heightMm
  if (pageLandscape === contentLandscape || pageWidth === pageHeight || label.widthMm === label.heightMm) return doc
  return { ...doc, orientation: ((normalizePageOrientation(doc.orientation) + 90) % 360) as PageOrientation }
}

/** Compose the two output-only orientation switches in one shared helper. */
export function prepareDocumentForPrint<T extends Pick<LabelDoc, 'widthMm' | 'heightMm' | 'orientation' | 'layout'>>(doc: T, options: { autoRotateOutput?: boolean; rotate180?: boolean } = {}): T {
  return autoRotateDocumentForPrint(rotateDocumentForPrint(doc, options.rotate180 === true), options.autoRotateOutput === true)
}

export function orientedLabelSize(doc: Pick<LabelDoc, 'widthMm' | 'heightMm' | 'orientation'>) {
  const orientation = normalizePageOrientation(doc.orientation)
  return orientation === 90 || orientation === 270
    ? { widthMm: doc.heightMm, heightMm: doc.widthMm }
    : { widthMm: doc.widthMm, heightMm: doc.heightMm }
}

export function layoutCount(layout?: PageLayout): number {
  const { rows, cols } = dimensions(layout)
  return rows * cols
}

export function pageSizeMm(doc: Pick<LabelDoc, 'widthMm' | 'heightMm' | 'orientation'>, layout?: PageLayout) {
  const { rows, cols } = dimensions(layout)
  if (layout?.pageWidthMm !== undefined && layout.pageHeightMm !== undefined) {
    if (![layout.pageWidthMm, layout.pageHeightMm].every((n) => Number.isFinite(n) && n > 0)) throw new Error('页面尺寸必须为正数')
    return { widthMm: layout.pageWidthMm, heightMm: layout.pageHeightMm }
  }
  const label = orientedLabelSize(doc)
  const widthMm = label.widthMm * cols + (layout?.colGapMm ?? 0) * (cols - 1)
  const heightMm = label.heightMm * rows + (layout?.rowGapMm ?? 0) * (rows - 1)
  if (![widthMm, heightMm].every((n) => Number.isFinite(n) && n > 0)) throw new Error('页面尺寸必须为正数')
  return { widthMm, heightMm }
}

export function pageCells(doc: Pick<LabelDoc, 'widthMm' | 'heightMm' | 'orientation'>, layout?: PageLayout) {
  const { rows, cols } = dimensions(layout)
  const label = orientedLabelSize(doc)
  return Array.from({ length: rows * cols }, (_, index) => {
    let row = layout?.printOrder === 'col' ? index % rows : Math.floor(index / cols)
    let col = layout?.printOrder === 'col' ? Math.floor(index / rows) : index % cols
    if (layout?.labelPrintDirection === 'rtl') col = cols - 1 - col
    if (layout?.startPos === 'tr' || layout?.startPos === 'br') col = cols - 1 - col
    if (layout?.startPos === 'bl' || layout?.startPos === 'br') row = rows - 1 - row
    return {
      index,
      x: (layout?.pageLeftMm ?? 0) + col * (label.widthMm + (layout?.colGapMm ?? 0)) + (layout?.offsetXMm ?? 0),
      y: (layout?.pageTopMm ?? 0) + row * (label.heightMm + (layout?.rowGapMm ?? 0)) + (layout?.offsetYMm ?? 0)
    }
  })
}

export function cellContext(ctx: DataCtx | undefined, index: number): DataCtx | undefined {
  if (!ctx) return undefined
  const recordIndex = ctx.recordIndex + index
  return {
    ...ctx,
    labelIndex: ctx.labelIndex + index,
    recordIndex,
    recordRow: ctx.activeDataset ? ctx.datasets[ctx.activeDataset]?.rows[recordIndex] : undefined,
    sharedVars: { ...ctx.sharedVars }
  }
}
