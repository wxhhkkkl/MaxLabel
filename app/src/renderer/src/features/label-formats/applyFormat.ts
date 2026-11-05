import type { LabelDoc } from '../../../../shared/domain'
import type { PaperGeometry, PaperShape } from '../../../../shared/domain/paper'
import type { LabelFormatSelection } from '../../dialogs/NewLabelDialog'

export interface FormatApplicationDefaults {
  rows: number
  cols: number
  rowGapMm: number
  colGapMm: number
  labelShape: PaperShape
}

/**
 * Map a New Label selection into the document's layout. The format code is deliberately
 * not persisted; only `formatKind` and geometry are. Mirrors the as-is
 * `App.handleNewFromDialog` mapping.
 */
export function applyLabelFormatToDoc(
  doc: LabelDoc,
  format: LabelFormatSelection | undefined,
  paper: PaperGeometry | undefined,
  defaults: FormatApplicationDefaults
): LabelDoc {
  return {
    ...doc,
    formatKind: format?.formatKind ?? 'custom',
    layout: {
      // 在已有标签上重设格式时保留排版里与尺寸无关的字段（偏移、打印顺序、圆角等）；
      // 新建文档时 doc.layout 为 undefined，不受影响。
      ...doc.layout,
      rows: format?.rows ?? defaults.rows,
      cols: format?.cols ?? defaults.cols,
      rowGapMm: format?.rowGapMm ?? defaults.rowGapMm,
      colGapMm: format?.colGapMm ?? defaults.colGapMm,
      ...paper,
      shape: paper?.shape ?? defaults.labelShape,
      ...(format?.pageWidthMm && format.pageHeightMm
        ? { pageWidthMm: format.pageWidthMm, pageHeightMm: format.pageHeightMm }
        : {}),
      ...(typeof format?.pageLeftMm === 'number' && typeof format?.pageTopMm === 'number'
        ? { pageLeftMm: format.pageLeftMm, pageTopMm: format.pageTopMm }
        : {}),
      ...(format?.pagesPerBox ? { pagesPerBox: format.pagesPerBox } : {}),
      ...(format?.mediaType !== undefined ? { mediaType: format.mediaType } : {})
    }
  }
}
