/**
 * 对象（含旋转）在标签坐标系里的轴对齐包围盒（毫米）。
 *
 * 旋转是绕 fabric 的原点做的：文字的 originX/originY 由水平/垂直对齐决定
 * （左对齐=左上、居中=中上……），不是永远绕框中心。逐对象位图要按真实包围盒取画布，
 * 否则旋转过的文字会被裁掉或整体位移。
 */
export interface ObjectBoundsInput {
  x: number
  y: number
  w: number
  h: number
  rotation: number
  /** 水平对齐：left / center / right（同 fabric Text 的 originX 映射）。 */
  align?: string
  /** 垂直对齐：top / middle / bottom（同 fabric Text 的 originY 映射）。 */
  verticalAlign?: string
}

export function rotatedObjectBounds(
  object: ObjectBoundsInput,
  paddingMm = 0
): { x: number; y: number; w: number; h: number } {
  const originX = object.align === 'center' ? 0.5 : object.align === 'right' ? 1 : 0
  const originY = object.verticalAlign === 'middle' ? 0.5 : object.verticalAlign === 'bottom' ? 1 : 0
  const pivotX = object.x + object.w * originX
  const pivotY = object.y + object.h * originY
  const radians = (object.rotation * Math.PI) / 180
  const cos = Math.cos(radians)
  const sin = Math.sin(radians)
  let minX = Number.POSITIVE_INFINITY
  let minY = Number.POSITIVE_INFINITY
  let maxX = Number.NEGATIVE_INFINITY
  let maxY = Number.NEGATIVE_INFINITY
  for (const [dx, dy] of [[-originX, -originY], [1 - originX, -originY], [1 - originX, 1 - originY], [-originX, 1 - originY]]) {
    const px = dx * object.w
    const py = dy * object.h
    const rx = px * cos - py * sin
    const ry = px * sin + py * cos
    if (rx < minX) minX = rx
    if (rx > maxX) maxX = rx
    if (ry < minY) minY = ry
    if (ry > maxY) maxY = ry
  }
  return {
    x: pivotX + minX - paddingMm,
    y: pivotY + minY - paddingMm,
    w: maxX - minX + paddingMm * 2,
    h: maxY - minY + paddingMm * 2
  }
}
