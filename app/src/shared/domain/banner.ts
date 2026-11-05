/** 条幅/飘带双联的几何计算，编辑器、格式对话框和打印裁剪共用一份规则。 */
export type BannerJointMode = 'single' | 'double'
export type BannerJointOrientation = 'vertical' | 'horizontal'

export interface BannerJointGeometry {
  widthMm: number
  heightMm: number
  jointMode: BannerJointMode
  jointWidthMm: number
  jointOrientation: BannerJointOrientation
}

/** 长边方向决定双联怎么排：高≥宽 → 左右两联；宽>高 → 上下两联。 */
export function bannerJointOrientation(widthMm: number, heightMm: number): BannerJointOrientation {
  return heightMm >= widthMm ? 'vertical' : 'horizontal'
}

/** 单条尺寸 + 中缝 → 双联成品尺寸（双联时中缝可以正好为 0）。 */
export function bannerJointGeometry(
  stripWidthMm: number,
  stripHeightMm: number,
  jointWidthMm: number
): BannerJointGeometry {
  const width = Math.max(0.1, stripWidthMm)
  const height = Math.max(0.1, stripHeightMm)
  const joint = Math.max(0, jointWidthMm)
  const orientation = bannerJointOrientation(width, height)
  return orientation === 'vertical'
    ? { widthMm: width * 2 + joint, heightMm: height, jointMode: 'double', jointWidthMm: joint, jointOrientation: orientation }
    : { widthMm: width, heightMm: height * 2 + joint, jointMode: 'double', jointWidthMm: joint, jointOrientation: orientation }
}

/** 双联成品尺寸 → 单条尺寸；用于把已有文档回填到格式对话框。 */
export function bannerStripGeometry(
  widthMm: number,
  heightMm: number,
  jointWidthMm: number,
  orientation: BannerJointOrientation
): { widthMm: number; heightMm: number } {
  const joint = Math.max(0, jointWidthMm)
  return orientation === 'vertical'
    ? { widthMm: Math.max(0.1, (widthMm - joint) / 2), heightMm }
    : { widthMm, heightMm: Math.max(0.1, (heightMm - joint) / 2) }
}
