import type { LabelFormatRecord } from './labelFormats.generated'

/**
 * 「条幅 / 飘带」类长条标签（020 现场需求）。
 *
 * ⚠️ 这些**不是**原厂商 `.fmt` 里的条目 —— 故意放在单独文件里，别混进
 * `labelFormats.generated.ts`：那份文件是原厂目录的原始导出，`printer-catalog`
 * 系列测试拿它跟真机逐条对账。新分类在 `catalog.ts` 里与它合并。
 *
 * 规格：
 * - 水平排列 = 长条竖放、多条并排（cols）；垂直排列 = 长条横放、多条上下堆叠（rows）。
 * - 双条 = 两条 + 2mm 间隙，纸面相应变宽 / 变高。
 */
export const BANNER_CATEGORY_ID = 22
export const BANNER_CATEGORY_NAME = '条幅/飘带'

function banner(
  code: string,
  name: string,
  labelWidthMm: number,
  labelHeightMm: number,
  cols: number,
  rows: number,
  pageWidthMm: number,
  pageHeightMm: number
): LabelFormatRecord {
  return {
    code,
    brandId: 1,
    brandName: '宸发标签',
    categoryId: BANNER_CATEGORY_ID,
    categoryName: BANNER_CATEGORY_NAME,
    categoryParentName: '',
    // 卷筒（连续走纸）
    type: 0,
    name,
    page: 0,
    pageWidthMm,
    pageHeightMm,
    pageLeftMm: 0,
    pageTopMm: 0,
    labelWidthMm,
    labelHeightMm,
    cols,
    rows,
    colGapMm: 2,
    rowGapMm: 2,
    corner: 0,
    orientation: 0,
    layout: '',
    totalLabels: 0,
    coreMm: 0,
    productName: name,
    productNote: '条幅/飘带类长标签，按卷筒连续打印。'
  }
}

export const BANNER_FORMATS: readonly LabelFormatRecord[] = [
  banner('619001', '竖条 100mm×1000mm 单联', 100, 1000, 1, 1, 100, 1000),
  banner('619002', '竖条 100mm×1000mm 双联', 100, 1000, 2, 1, 202, 1000),
  banner('619003', '横条 1000mm×100mm 单联', 1000, 100, 1, 1, 1000, 100),
  banner('619004', '横条 1000mm×100mm 双联', 1000, 100, 1, 2, 1000, 202)
]
