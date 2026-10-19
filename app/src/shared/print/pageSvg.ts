import { paperPath, type PaperGeometry, type PaperShape } from '../domain/paper'
import { PX_PER_MM } from '../domain/units'

export interface OutputCell {
  x: number
  y: number
  widthMm: number
  heightMm: number
}

let pageClipSerial = 0

/**
 * Adds the shared paper clip (including center holes) to a Fabric SVG page and
 * wraps the page content. Fabric's own clipPath export omits clip-rule=evenodd,
 * which paperPath needs, so this stays a small, testable string transform.
 */
export function composePageSvg(
  fabricSvg: string,
  cells: ReadonlyArray<OutputCell>,
  geometry: PaperGeometry,
  shape: PaperShape,
  pageWidthPx: number,
  pageHeightPx: number,
  clipId = `maxlabel-page-clip-${pageClipSerial++}`
): string {
  const clipPaths = cells
    .map((cell) => {
      const path = paperPath(cell.widthMm, cell.heightMm, { ...geometry, shape })
      return `<path d="${path}" clip-rule="evenodd" transform="translate(${cell.x * PX_PER_MM} ${cell.y * PX_PER_MM}) scale(${PX_PER_MM})"/>`
    })
    .join('')
  const clipMarkup = `<clipPath id="${clipId}" clipPathUnits="userSpaceOnUse">${clipPaths}</clipPath>`
  const defsMarker = '</defs>'
  const defsEnd = fabricSvg.indexOf(defsMarker)
  let head: string
  let tail: string
  if (defsEnd >= 0) {
    head = `${fabricSvg.slice(0, defsEnd)}${clipMarkup}${defsMarker}`
    tail = fabricSvg.slice(defsEnd + defsMarker.length)
  } else {
    const openEnd = fabricSvg.indexOf('>')
    head = fabricSvg.slice(0, openEnd + 1)
    tail = `<defs>${clipMarkup}</defs>${fabricSvg.slice(openEnd + 1)}`
  }
  const close = tail.lastIndexOf('</svg>')
  const content = close >= 0 ? tail.slice(0, close) : tail
  const end = close >= 0 ? tail.slice(close) : '</svg>'
  return `${head}<rect x="0" y="0" width="${pageWidthPx}" height="${pageHeightPx}" fill="#ffffff"/><g clip-path="url(#${clipId})">${content}</g>${end}`
}
