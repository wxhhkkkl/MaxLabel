/**
 * 「拷贝数量从数据库字段引入」的字段下拉。
 * 模板里已保存、但当前数据集没有的字段也保留，避免打开高级选项时下拉显示空白。
 */
export function copyFieldOptions(fields: readonly string[], current: string): string[] {
  const list = [...new Set(fields.map((field) => field.trim()).filter(Boolean))]
  const value = current.trim()
  return value && !list.includes(value) ? [value, ...list] : list
}
