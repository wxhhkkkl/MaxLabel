/**
 * 「条码属性 → 条码」页「尺寸」组里三个**下拉**的选项集，逐项照抄真机 LabelShop。
 *
 * 证据（`parity/reference/labelshop/`）：
 * - `X 尺寸(&X):` = **61 项** = 60 个 mil 档 + `固定宽度`
 *   （`probe-sym-pdf417-values.txt`：`value='10.00 mil  (选中 5 / 共 61 项)'`；
 *   `probe-sym-pdf417-combos.txt` combo[2] 逐项 `1.67 mil / 3.33 mil / 5.00 mil / … / 100.00 mil / 固定宽度`）。
 *   步长 = 1/600 英寸 = 1.6667 mil，第 6 项即默认值 `10.00 mil`（= 0.254 mm，与 `objectFactory` 一致）。
 *   复刻版此前是自由数字框（min 1 / max 1000 / step 1），与真机的**选项集**不符。
 * - `层数(&R):`（PDF 417）= **89 项** = `自动` + `3`…`90`
 *   （combo[5]：`count=89 sel=0 cur='自动'`）。语义是 PDF 417 的**行数**，不是「层高是 X 尺寸的几倍」。
 * - `列数(&C):`（PDF 417）= **31 项** = `自动` + `1`…`30`（combo[6]：`count=31 sel=0 cur='自动'`）。
 *
 * 真机两个下拉的默认都是 `自动`（`sel=0`）；`自动` = 不指定，交给编码器按数据量自行决定
 * （bwip-js 的 pdf417 支持 `rows` / `columns` 参数，实测两者都会改变输出）。
 */

/** 1/600 英寸 = 1.6667 mil 的 60 个档位，逐项用真机的两位小数文本。 */
const X_SIZE_MIL_STEPS: number[] = Array.from(
  { length: 60 },
  (_, index) => Math.round((index + 1) * (1000 / 600) * 100) / 100
)

/** 真机 `X 尺寸(&X):` 下拉的**逐项原文**（60 个 mil 档 + 末尾的 `固定宽度`）。 */
export const X_SIZE_MIL_OPTION_LABELS: string[] = [
  ...X_SIZE_MIL_STEPS.map((mil) => `${mil.toFixed(2)} mil`),
  '固定宽度'
]

/** 真机默认值（combo[2] 的 `sel=5` ⇒ 第 6 项 `10.00 mil`）。 */
export const DEFAULT_X_SIZE_MIL = 10

/** `固定宽度` 在下拉里的档位文本（真机原文）。 */
export const X_SIZE_FIXED_LABEL = '固定宽度'

/** `自动` 档的文本（真机原文，两个下拉的第 1 项都是它）。 */
export const BARCODE_AUTO_LABEL = '自动'

/** PDF 417 `层数(&R):`：`自动` + 3…90。 */
export const PDF417_ROW_OPTIONS: string[] = [
  BARCODE_AUTO_LABEL,
  ...Array.from({ length: 88 }, (_, index) => String(index + 3))
]

/** PDF 417 `列数(&C):`：`自动` + 1…30。 */
export const PDF417_COLUMN_OPTIONS: string[] = [
  BARCODE_AUTO_LABEL,
  ...Array.from({ length: 30 }, (_, index) => String(index + 1))
]

/**
 * 把当前 X 尺寸（mil）折算成下拉里应选中的档位文本。
 * 旧文档里的任意 mil 值（自由数字框时代产生）取**最接近**的档位显示，避免下拉出现空值。
 */
export function xSizeMilOptionLabel(mil: number | undefined, fixed: boolean): string {
  if (fixed) return X_SIZE_FIXED_LABEL
  if (mil === undefined || !Number.isFinite(mil) || mil <= 0) return `${DEFAULT_X_SIZE_MIL.toFixed(2)} mil`
  let best = X_SIZE_MIL_STEPS[0]
  for (const candidate of X_SIZE_MIL_STEPS) {
    if (Math.abs(candidate - mil) < Math.abs(best - mil)) best = candidate
  }
  return `${best.toFixed(2)} mil`
}

/** 下拉文本 → mil 数值；`固定宽度` 返回 `undefined`（由对象宽度决定窄条宽度）。 */
export function xSizeMilFromOptionLabel(label: string): number | undefined {
  if (label === X_SIZE_FIXED_LABEL) return undefined
  const parsed = parseFloat(label)
  return Number.isFinite(parsed) ? parsed : DEFAULT_X_SIZE_MIL
}
