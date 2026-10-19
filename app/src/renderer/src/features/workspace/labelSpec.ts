import type { LabelDoc } from '../../../../shared/domain'
import { translate } from '../../../../shared/i18n/translate'
import type { Language } from '../../../../shared/i18n/types'

function compactMillimetres(value: number): string {
  const rounded = Number(value.toFixed(2))
  return String(rounded)
}

/** Format the status-bar label description from the document's label format. */
export function labelSpecOf(doc: LabelDoc, language: Language = 'zh-CN'): string {
  const width = compactMillimetres(doc.widthMm)
  const height = compactMillimetres(doc.heightMm)
  const layout = doc.layout
  if (!layout) return `${width}mm x ${height}mm`

  const count = layout.rows * layout.cols
  if (count <= 1) return `${width}mm x ${height}mm`

  const shape = layout.shape === 'roundRect'
    ? translate(language, 'label.spec.roundRect')
    : layout.shape === 'ellipse' || layout.shape === 'disc'
      ? translate(language, 'label.spec.circle')
      : translate(language, 'label.spec.square')
  const pagesPerBox = layout.pagesPerBox && layout.pagesPerBox > 0
    ? translate(language, 'label.spec.pagesPerBox', { count: Math.floor(layout.pagesPerBox) })
    : ''
  return `${width}mm x ${height}mm ${shape}${translate(language, 'label.spec.perPage', { count })}${pagesPerBox}`
}
