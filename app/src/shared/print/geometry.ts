// ---------- 几何换算：毫米 ↔ 打印机点阵 ----------

/** 每毫米点阵数（按 DPI） */
export function dpiToDpm(dpi: number): number {
  return dpi / 25.4
}

/** 毫米 → 点（四舍五入） */
export function mm2dot(mm: number, dpi: number): number {
  return Math.round(mm * dpiToDpm(dpi))
}

/** 点 → 毫米 */
export function dot2mm(dot: number, dpi: number): number {
  return (dot * 25.4) / dpi
}

/** 数值格式化：去掉多余小数 */
export function fmt(n: number): string {
  return String(Math.round(n * 100) / 100)
}
