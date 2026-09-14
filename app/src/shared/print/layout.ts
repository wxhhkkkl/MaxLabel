import type { DataCtx } from '../domain/datasource'
import type { LabelDoc, PageOrientation } from '../domain/document'
import type { PaperGeometry } from '../domain/paper'

export interface PageLayout extends PaperGeometry {
  rows: number
  cols: number
  rowGapMm: number
  colGapMm: number
  printOrder?: 'row' | 'col'
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
    if (layout?.startPos === 'tr' || layout?.startPos === 'br') col = cols - 1 - col
    if (layout?.startPos === 'bl' || layout?.startPos === 'br') row = rows - 1 - row
    return {
      index,
      x: col * (label.widthMm + (layout?.colGapMm ?? 0)) + (layout?.offsetXMm ?? 0),
      y: row * (label.heightMm + (layout?.rowGapMm ?? 0)) + (layout?.offsetYMm ?? 0)
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
