/**
 * 字号（磅）的显示与输入规则。
 *
 * 档位下拉只是候选：真机列表里没有 13（8,9,10,11,12,14…），而 lsdx 的 `font/height`
 * 是任意 1/100 磅（1300 = 13pt、788 = 7.88pt），导入后必须能原样显示、也必须能手工填。
 */
export const PT_TO_MM = 25.4 / 72

/** 模型里字号存毫米，校验范围 0.1–1000mm（见 main/ipc/validation 的 boundedNumber）。 */
export const FONT_SIZE_MIN_PT = 0.5
export const FONT_SIZE_MAX_PT = 1000 / PT_TO_MM

/**
 * 显示用磅值：模型把毫米存到两位小数（13pt → 4.59mm → 回算是 13.0045pt），所以既不能一律保留
 * 一位（7.88 会被截成 7.9），也不能一律保留两位（13 会显示成 13.01）。这里取「换算回毫米后仍是
 * 同一个存储值」的最短小数。
 */
export function formatFontSizePt(pt: number): string {
  const storedMm = Math.round(pt * PT_TO_MM * 100)
  for (let digits = 0; digits <= 2; digits++) {
    const scale = 10 ** digits
    const rounded = Math.round(pt * scale) / scale
    if (Math.round(rounded * PT_TO_MM * 100) === storedMm) return String(rounded)
  }
  return String(Math.round(pt * 100) / 100)
}

/** 输入框里的文本 → 磅值；空/非法返回 null（不提交），越界按范围收口。 */
export function clampFontSizePt(raw: string): number | null {
  if (raw.trim() === '') return null
  const value = Number(raw)
  if (!Number.isFinite(value)) return null
  return Math.min(FONT_SIZE_MAX_PT, Math.max(FONT_SIZE_MIN_PT, value))
}
