import type { DataCtx } from '../domain/datasource'
import type { LabelDoc, PageOrientation } from '../domain/document'
import type { LabelObject } from '../domain/objects'
import { roundRectRadiusMm, type PaperGeometry } from '../domain/paper'

export const LABEL_EDGE_TOLERANCE_MM = 0.05

export interface PageLayout extends PaperGeometry {
  rows: number
  cols: number
  rowGapMm: number
  colGapMm: number
  pageWidthMm?: number
  pageHeightMm?: number
  mediaType?: 0 | 1 | 2
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

/** 打印标签边框的线宽（毫米）；真机该选项没有线宽设置。 */
export const PRINT_BORDER_STROKE_MM = 0.3
const PRINT_BORDER_ID = '__print-border'

/**
 * 打印对话框「打印标签边框」：沿标签边缘画一圈线框，随纸型（矩形/圆角/椭圆/圆盘）。
 * 线框内缩半个线宽，保证整条线落在标签范围内。
 */
function printBorderObject(doc: Pick<LabelDoc, 'widthMm' | 'heightMm' | 'orientation' | 'layout'>): LabelObject {
  const { widthMm, heightMm } = orientedLabelSize(doc)
  const inset = PRINT_BORDER_STROKE_MM / 2
  const w = Math.max(0.1, widthMm - inset * 2)
  const h = Math.max(0.1, heightMm - inset * 2)
  const base = {
    id: PRINT_BORDER_ID,
    x: inset,
    y: inset,
    w,
    h,
    rotation: 0,
    fill: '#ffffff',
    fillEnabled: false,
    stroke: '#000000',
    strokeWidth: PRINT_BORDER_STROKE_MM
  }
  const shape = doc.layout?.shape ?? 'rect'
  if (shape === 'ellipse' || shape === 'disc') return { ...base, type: 'ellipse' }
  if (shape === 'roundRect') {
    return { ...base, type: 'rect', shape: 'roundRect', cornerRadius: roundRectRadiusMm(w, h, doc.layout?.cornerRadiusMm) }
  }
  return { ...base, type: 'rect' }
}

/** Compose the two output-only orientation switches in one shared helper. */
export function prepareDocumentForPrint<T extends Pick<LabelDoc, 'widthMm' | 'heightMm' | 'orientation' | 'layout'> & Partial<Pick<LabelDoc, 'objects'>>>(doc: T, options: { autoRotateOutput?: boolean; rotate180?: boolean; printBorder?: boolean } = {}): T {
  const rotated = autoRotateDocumentForPrint(rotateDocumentForPrint(doc, options.rotate180 === true), options.autoRotateOutput === true)
  if (options.printBorder !== true || !rotated.objects) return rotated
  if (rotated.objects.some((object) => object.id === PRINT_BORDER_ID)) return rotated
  return { ...rotated, objects: [...rotated.objects, printBorderObject(rotated)] } as T
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

/** 页面比标签阵列最多大这么多毫米时，视为卷筒衬纸/纸边留白（而不是整张纸的排版）。 */
export const PRINT_PAGE_MARGIN_TOLERANCE_MM = 8

/**
 * 打印用的页面几何：把「页面只比标签阵列大一点点」的情况（lsdx 的 paper 尺寸，
 * 例如 3 列 30mm 的标签页存成 98mm）压回标签阵列本身，并把左空/上空清零。
 *
 * 否则打印作业的页面会比实际介质宽/高几个毫米，驱动只能缩放或裁切 —— 整页重采样，
 * 小字立刻发虚。平张保留实际纸张尺寸，条幅的自动页面必须容纳留白和成品。
 * 导入的 LSDX 等旧模板缺少介质类型时沿用卷筒尺寸判断。
 */
export function printLayoutOf(
  doc: Pick<LabelDoc, 'widthMm' | 'heightMm' | 'orientation'>,
  layout?: PageLayout
): PageLayout | undefined {
  const { rows, cols } = dimensions(layout)
  if (layout?.mediaType === 1) return layout
  if (!layout) return undefined
  const label = orientedLabelSize(doc)
  const gridWidth = label.widthMm * cols + (layout.colGapMm ?? 0) * (cols - 1)
  const gridHeight = label.heightMm * rows + (layout.rowGapMm ?? 0) * (rows - 1)
  if (layout.mediaType === 2) {
    const left = (layout.pageLeftMm ?? 0) + (layout.offsetXMm ?? 0)
    const top = (layout.pageTopMm ?? 0) + (layout.offsetYMm ?? 0)
    return {
      ...layout,
      pageWidthMm: Math.max(layout.pageWidthMm ?? 0, gridWidth + Math.max(0, left)),
      pageHeightMm: Math.max(layout.pageHeightMm ?? 0, gridHeight + Math.max(0, top))
    }
  }
  if (layout.pageWidthMm === undefined || layout.pageHeightMm === undefined) return layout
  const marginWidth = layout.pageWidthMm - gridWidth
  const marginHeight = layout.pageHeightMm - gridHeight
  const pageIsPackedLabel = marginWidth >= 0 && marginHeight >= 0 &&
    marginWidth <= PRINT_PAGE_MARGIN_TOLERANCE_MM && marginHeight <= PRINT_PAGE_MARGIN_TOLERANCE_MM
  if (!pageIsPackedLabel) return layout
  // 卷筒衬纸/纸边留白：页面尺寸压回标签阵列本身，但**保留左空/上空**。
  // LabelShop 帮助明确说明左空/上空会移动整页打印位置；去掉它会让单联标签
  // 整体向左偏（现场柿饼模板 左空=1/2 打印结果一样且偏左即此原因）。
  return {
    ...layout,
    pageWidthMm: undefined,
    pageHeightMm: undefined
  }
}

/**
 * 单标签打印/导出：平张/多行拼版只输出第一枚标签格，忽略整张纸和页边距。
 *
 * LabelShop 的「打印到文件」默认按单标签出页：模板即使保存在 A4/7 联纸上，
 * `SIZE` 仍是标签本身（如 192×38mm），不是 210×297mm。指令导出必须复用这个口径，
 * 否则会把整张纸的位图发给打印机。1 行多列是卷筒上的一排标签（如 1×3），
 * 整排就是介质，保留阵列不裁。
 */
export function singleLabelLayout(
  _doc: Pick<LabelDoc, 'widthMm' | 'heightMm' | 'orientation'>,
  layout?: PageLayout,
  sourceLayout?: PageLayout
): PageLayout | undefined {
  if (!layout) return undefined
  // 1 行多列是卷筒上的一排标签（如「伯爵七号」1×3）：整排就是介质，
  // LabelShop 的 SIZE 是 109×20，不能裁成单枚 35×20。
  const source = sourceLayout ?? layout
  if (source.rows <= 1 && source.cols > 1) {
    // 1 行多列：保留整排，但纸张边距不是标签尺寸（s083：75×30.5 纸 → 67×19.5 行）。
    return { ...layout, pageWidthMm: undefined, pageHeightMm: undefined }
  }
  // 其余按单标签输出：多行平张（A4 6×5、7×1）和单枚卷筒都只出首枚。
  return {
    ...layout,
    rows: 1,
    cols: 1,
    pageWidthMm: undefined,
    pageHeightMm: undefined,
    pageLeftMm: undefined,
    pageTopMm: undefined,
    offsetXMm: undefined,
    offsetYMm: undefined
  }
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
