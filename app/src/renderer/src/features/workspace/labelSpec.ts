import type { LabelDoc } from '../../../../shared/domain'

function compactMillimetres(value: number): string {
  const rounded = Number(value.toFixed(2))
  return String(rounded)
}

/** Format the status-bar label description from the document's label format. */
export function labelSpecOf(doc: LabelDoc): string {
  const width = compactMillimetres(doc.widthMm)
  const height = compactMillimetres(doc.heightMm)
  const layout = doc.layout
  if (!layout) return `${width}mm x ${height}mm`

  const count = layout.rows * layout.cols
  if (count <= 1) return `${width}mm x ${height}mm`

  const shape = layout.shape === 'roundRect'
    ? '圆角'
    : layout.shape === 'ellipse' || layout.shape === 'disc'
      ? '圆形'
      : '直角'
  const pagesPerBox = layout.pagesPerBox && layout.pagesPerBox > 0
    ? ` ${Math.floor(layout.pagesPerBox)}页/盒`
    : ''
  return `${width}mm x ${height}mm ${shape}${count}枚/页${pagesPerBox}`
}
