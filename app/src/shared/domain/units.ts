/** 编辑器画布的毫米→像素换算比例。 */
export const PX_PER_MM = 10

/** 300 DPI 打印位图的像素/毫米换算比例。 */
export const PRINT_PX_PER_MM = 300 / 25.4

/** 单色位图（行优先、每像素 1 bit、每行字节数向上取整）。 */
export interface MonoBitmap {
  width: number
  height: number
  bytesPerRow: number
  bytes: Uint8Array
  /** 对象位图的左上角（毫米）。旋转过的对象按包围盒落点，缺省时按对象自身 x/y。 */
  originXMm?: number
  originYMm?: number
  /** 位图带不透明底色（反白文字、实心矩形等）：落图时必须覆盖已有内容，而不是 OR 叠加。 */
  opaque?: boolean
}

export function uid(): string {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36)
}

export function round2(n: number): number {
  return Math.round(n * 100) / 100
}
