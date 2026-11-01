/**
 * 打印范围里的「共有 N 条记录」：只有文档接了数据集才给值（未接入返回 undefined，界面不显示）。
 * 数据集接了但没有任何记录时仍是 0，界面照常显示，便于用户发现查询为空。
 */
export function printRecordTotal(datasets: Record<string, unknown> | undefined, rows: number): number | undefined {
  if (!datasets || Object.keys(datasets).length === 0) return undefined
  return Math.max(0, rows)
}
