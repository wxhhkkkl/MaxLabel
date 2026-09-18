/** Physical paper geometry in millimetres, shared by editor and output clipping. */
export type PaperShape = 'rect' | 'roundRect' | 'ellipse' | 'disc'
export interface PaperGeometry {
  shape?: PaperShape
  cornerRadiusMm?: number
  innerDiameterMm?: number
  /** 帮助 label_page_page.html：标签纸颜色。**只在编辑标签时显示，并不会实际输出底色**。 */
  labelColor?: string
}

/** 合法的 #RRGGBB（小写归一）；非法值回落到默认白色。 */
export function normalizeLabelColor(value: unknown): string {
  return typeof value === 'string' && /^#[0-9a-fA-F]{6}$/.test(value) ? value.toLowerCase() : '#ffffff'
}

export function paperPath(width: number, height: number, paper: PaperGeometry = {}): string {
  const ellipse = (cx: number, cy: number, rx: number, ry: number) =>
    `M ${cx - rx} ${cy} A ${rx} ${ry} 0 1 0 ${cx + rx} ${cy} A ${rx} ${ry} 0 1 0 ${cx - rx} ${cy} Z`
  const hole = Math.max(0, Math.min(Math.min(width, height) - 0.02, paper.innerDiameterMm ?? (paper.shape === 'disc' ? 15 : 0)) / 2)
  const cutout = hole > 0 ? ' ' + ellipse(width / 2, height / 2, hole, hole) : ''
  if (paper.shape === 'ellipse') return ellipse(width / 2, height / 2, width / 2, height / 2) + cutout
  if (paper.shape === 'disc') {
    const radius = Math.min(width, height) / 2
    return ellipse(width / 2, height / 2, radius, radius) + cutout
  }
  const r = paper.shape === 'roundRect' ? Math.max(0, Math.min(Math.min(width, height) / 2, paper.cornerRadiusMm ?? Math.min(width, height) * 0.12)) : 0
  if (!r) return `M 0 0 H ${width} V ${height} H 0 Z` + cutout
  return `M ${r} 0 H ${width-r} A ${r} ${r} 0 0 1 ${width} ${r} V ${height-r} A ${r} ${r} 0 0 1 ${width-r} ${height} H ${r} A ${r} ${r} 0 0 1 0 ${height-r} V ${r} A ${r} ${r} 0 0 1 ${r} 0 Z` + cutout
}
