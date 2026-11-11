/**
 * 编辑区画布视口计算 —— 「显示标签外内容」开启时，在纸张四周留出空白，
 * 让超出标签的对象仍然绘制出来。打印 / 预览 / 文档模型都不读取这里的值。
 */

/** 标签外的最小留白（毫米）；可见工作区更大时按需放大，直到画布覆盖整块蓝色区域。 */
export const OUTSIDE_LABEL_MARGIN_MM = 15

export interface EditorViewport {
  /** 画布位图/容器的 CSS 宽度（纸张 + 两侧留白） */
  canvasWidth: number
  canvasHeight: number
  /** 纸张左上角在画布内的偏移（CSS px） */
  paperX: number
  paperY: number
  /** 纸张在画布内的尺寸（CSS px，已含 zoom） */
  paperWidth: number
  paperHeight: number
}

/**
 * @param viewportWidthPx 可见工作区（蓝色区域）的 CSS 尺寸；开启留白时画布至少覆盖这块区域，
 *   这样对象拖到任何可见位置都不会被画布边缘裁掉。
 */
export function computeEditorViewport(args: {
  /** 已含 zoom 的纸张 CSS 尺寸 */
  paperWidthPx: number
  paperHeightPx: number
  zoom: number
  marginMm: number
  showOutside: boolean
  viewportWidthPx?: number
  viewportHeightPx?: number
}): EditorViewport {
  const paperWidth = Math.max(1, Math.round(args.paperWidthPx))
  const paperHeight = Math.max(1, Math.round(args.paperHeightPx))
  let marginX = 0
  let marginY = 0
  if (args.showOutside) {
    const base = Math.max(0, Math.round(args.marginMm * 10 * args.zoom))
    // 用 floor 取「能覆盖可见区」的对称留白，避免画布比滚动容器大 1px 引出滚动条。
    const coverX = Math.max(0, Math.floor(((args.viewportWidthPx ?? 0) - paperWidth) / 2))
    const coverY = Math.max(0, Math.floor(((args.viewportHeightPx ?? 0) - paperHeight) / 2))
    marginX = Math.max(base, coverX)
    marginY = Math.max(base, coverY)
  }
  return {
    canvasWidth: paperWidth + 2 * marginX,
    canvasHeight: paperHeight + 2 * marginY,
    paperX: marginX,
    paperY: marginY,
    paperWidth,
    paperHeight
  }
}

/**
 * 留白外环：外矩形减去纸张矩形（evenodd）。与纸张自身的 `paperPath` 做并集后，
 * 只剩「纸张形状之外、留白之内」的区域可见 —— 圆角/孔洞/中缝的裁切规则不被放宽。
 */
export function outsideRingPath(paperWidth: number, paperHeight: number, marginX: number, marginY: number): string {
  const totalW = paperWidth + 2 * marginX
  const totalH = paperHeight + 2 * marginY
  return `M 0 0 H ${totalW} V ${totalH} H 0 Z M ${marginX} ${marginY} H ${marginX + paperWidth} V ${marginY + paperHeight} H ${marginX} Z`
}
