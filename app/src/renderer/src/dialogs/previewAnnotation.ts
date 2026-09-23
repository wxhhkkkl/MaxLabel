/**
 * 标签预览里「每格序号」与「尺寸标注」的字号 —— 两个对话框（选择标签格式 / 标签格式设置）共用。
 *
 * **为什么需要这个模块**（真机口径 + 复刻版缺陷）
 * 真机 `parity/reference/labelshop/verifier-r43-choose-label.png` 1:1 量测：页面 210mm 宽画成 390px
 * （1.857 px/mm），格子高 70mm ≈ 130px，序号字形高约 10px ⇒ **字号 ≈ 0.10–0.13 × 渲染出来的格子高**。
 * 复刻版原来把字号直接写成 **viewBox 单位**（4.2 / 4.5），而 viewBox 单位 ≠ 屏幕像素：
 * 「选择标签格式」的 viewBox 是 238 单位映射到 430px（格子只有 74px 高）⇒ 字号被压到约 4.8px，
 * 序号与 `100mm`/`70mm` 在截图上几乎看不见（并排图 `parity/review/cmp-choose-fa65df3.png` 右半、
 * `cmp-custom-85c2d8e.png` 右半）——验收方 round-179/180 因此判成「缺序号、缺尺寸标注」。
 * 序号与标注**本来就画了**，问题是字号算错了坐标系。
 *
 * 这里统一改成「**先按渲染像素算字号，再换算回 viewBox 单位**」，并对像素字号设下限，
 * 保证无论标签多小、viewBox 多大，标注都清晰可读；两个对话框共用同一份实现，避免再次漂移。
 */

/** 字号 / 渲染出来的格子高（真机量测约 0.10–0.13，取中值）。 */
export const ANNOTATION_FONT_RATIO = 0.12

/** 字号下限（像素）：低于这个值在屏幕上就糊成一团（复刻版原缺陷是 ~4.8px）。 */
export const ANNOTATION_MIN_PX = 9

/** 字号上限（像素）：标签很大时不至于把预览糊满。 */
export const ANNOTATION_MAX_PX = 17

/** viewBox → 屏幕像素的等比缩放（与 `preserveAspectRatio="xMidYMid meet"` 同语义）。 */
export function previewScale(viewW: number, viewH: number, boxW: number, boxH: number): number {
  return Math.min(boxW / Math.max(1e-6, viewW), boxH / Math.max(1e-6, viewH))
}

/** 序号 / 尺寸标注的字号，**单位与 viewBox 相同**（不是像素）。 */
export function annotationFontSize(labelHeightMm: number, scale: number): number {
  const safeScale = Math.max(1e-6, scale)
  const labelPx = Math.max(1, labelHeightMm) * safeScale
  const px = Math.min(ANNOTATION_MAX_PX, Math.max(ANNOTATION_MIN_PX, labelPx * ANNOTATION_FONT_RATIO))
  return px / safeScale
}

/** 标注四周要留的空白，按字号倍数表示（2.2 倍：上方放「text + 尺寸线」，右侧放「尺寸线 + 竖排 text」）。 */
const ANNOTATION_MARGIN_FACTOR = 2.2

export interface PreviewAnnotationLayout {
  /** viewBox 四周留白（viewBox 单位）。 */
  margin: number
  /** viewBox → 像素缩放。 */
  scale: number
  /** 序号/标注字号（viewBox 单位）。 */
  font: number
}

/**
 * 「标签格式设置」预览的排版：留白要跟着字号走（字号以像素为准，留白以 viewBox 为准，
 * 两者互相依赖），所以这里做几次定点迭代——确定性的纯计算，没有随机性。
 */
export function previewAnnotationLayout(
  gridW: number,
  gridH: number,
  boxW: number,
  boxH: number,
  labelHeightMm: number
): PreviewAnnotationLayout {
  const baseMargin = Math.max(3, Math.min(gridW, gridH) * 0.07)
  let margin = baseMargin
  let scale = previewScale(gridW + margin * 2, gridH + margin * 2, boxW, boxH)
  let font = annotationFontSize(labelHeightMm, scale)
  for (let pass = 0; pass < 6; pass += 1) {
    margin = Math.max(baseMargin, font * ANNOTATION_MARGIN_FACTOR)
    scale = previewScale(gridW + margin * 2, gridH + margin * 2, boxW, boxH)
    font = annotationFontSize(labelHeightMm, scale)
  }
  return { margin, scale, font }
}
