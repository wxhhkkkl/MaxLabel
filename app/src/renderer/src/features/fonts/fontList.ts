/**
 * 字体下拉的候选清单。
 *
 * 固定清单是复刻版的默认字体（旧模板里存的就是这些名字，必须保持原样排在最前）；
 * 其后追加本机安装的系统字族 —— 由主进程 `fonts:list` 用 GDI 枚举，渲染层缓存一次。
 */
export const FONTS = [
  '微软雅黑', '宋体', '黑体', '楷体', '仿宋', 'Arial', 'Times New Roman', 'Courier New',
  'Symbol', 'OCR-B-10 BT', 'OCR-A Std', 'Verdana', 'Tahoma'
]

/**
 * 合并「固定清单 + 系统字族」。
 *
 * - 固定清单保持原顺序在前；
 * - 系统字族去掉首尾空白、空名和 `@` 开头的竖排变体，并忽略大小写去重；
 *   已出现在固定清单里的名字不再追加；
 * - 追加部分按名称排序（`zh-CN` 排序规则）。
 */
export function mergeFontOptions(systemFamilyNames: readonly string[], preferred: readonly string[] = FONTS): string[] {
  const seen = new Set(preferred.map((name) => name.toLowerCase()))
  const extra: string[] = []
  for (const raw of systemFamilyNames) {
    const name = raw.trim()
    if (!name || name.startsWith('@')) continue
    const key = name.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    extra.push(name)
  }
  extra.sort((a, b) => a.localeCompare(b, 'zh-CN'))
  return [...preferred, ...extra]
}
