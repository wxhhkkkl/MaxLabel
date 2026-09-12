import type { TableObj } from './domain/objects'

/** 表格各列右边界的 x 坐标（mm），长度 = cols+1 */
export function tableColXs(o: Pick<TableObj, 'w' | 'cols' | 'colWidths'>): number[] {
  const n = Math.max(1, o.cols)
  const xs: number[] = []
  if (o.colWidths && o.colWidths.length === n) {
    const total = o.colWidths.reduce((s, v) => s + Math.max(0, v), 0) || 1
    let acc = 0
    xs.push(0)
    for (let i = 0; i < n; i++) {
      acc += (Math.max(0, o.colWidths[i]) / total) * o.w
      xs.push(acc)
    }
  } else {
    for (let i = 0; i <= n; i++) xs.push((o.w * i) / n)
  }
  return xs
}

/** 表格各行下边界的 y 坐标（mm），长度 = rows+1 */
export function tableRowYs(o: Pick<TableObj, 'h' | 'rows' | 'rowHeights'>): number[] {
  const n = Math.max(1, o.rows)
  const ys: number[] = []
  if (o.rowHeights && o.rowHeights.length === n) {
    const total = o.rowHeights.reduce((s, v) => s + Math.max(0, v), 0) || 1
    let acc = 0
    ys.push(0)
    for (let i = 0; i < n; i++) {
      acc += (Math.max(0, o.rowHeights[i]) / total) * o.h
      ys.push(acc)
    }
  } else {
    for (let i = 0; i <= n; i++) ys.push((o.h * i) / n)
  }
  return ys
}

/** 返回 (r,c) 所在合并单元格，无则 null */
export function tableMergeAt(o: TableObj, r: number, c: number) {
  if (!o.merges) return null
  return o.merges.find((m) => r >= m.r && r <= m.r2 && c >= m.c && c <= m.c2) ?? null
}

/** 内部线段是否被合并单元格覆盖：
 * dir='v' 竖线（第 c 列右侧边界），跨越行段 r..r+1；
 * dir='h' 横线（第 r 行下边界），跨越列段 c..c+1。
 */
export function tableSegmentHidden(o: TableObj, r: number, c: number, dir: 'v' | 'h'): boolean {
  if (!o.merges || !o.merges.length) return false
  if (dir === 'v') {
    // 内部竖线（第 c 列右边界）在合并列区间 (c1, c2] 内隐藏
    return o.merges.some((m) => m.c < c && c <= m.c2 && m.r <= r && r <= m.r2)
  }
  // 内部横线（第 r 行下边界）在合并行区间 (r1, r2] 内隐藏
  return o.merges.some((m) => m.r < r && r <= m.r2 && m.c <= c && c <= m.c2)
}
