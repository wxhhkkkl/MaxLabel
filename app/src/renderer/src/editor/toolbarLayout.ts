/** 主工具栏按钮组（分组名逐条取自帮助 toolbar_mainbar.html 的小节标题）。
 *  「添加或删除按钮 → 标准」按组勾选显示/隐藏，勾选结果随系统选项持久化。 */
export const TOOLBAR_GROUPS = [
  { key: 'file', label: '文件操作' },
  { key: 'edit', label: '复制、粘贴' },
  { key: 'history', label: '撤消、重做' },
  { key: 'print', label: '打印' },
  { key: 'object', label: '对象' },
  { key: 'database', label: '数据库' },
  { key: 'view', label: '显示' },
  { key: 'help', label: '帮助' }
] as const

export type ToolbarGroupKey = (typeof TOOLBAR_GROUPS)[number]['key']

export const TOOLBAR_GROUP_KEYS: ToolbarGroupKey[] = TOOLBAR_GROUPS.map((g) => g.key)

export type ToolbarGroupVisibility = Record<ToolbarGroupKey, boolean>

export function defaultToolbarGroups(): ToolbarGroupVisibility {
  return TOOLBAR_GROUP_KEYS.reduce((acc, key) => { acc[key] = true; return acc }, {} as ToolbarGroupVisibility)
}

/** 只接受已知分组的布尔值，未知键丢弃；缺失键按原版默认（显示）补齐。 */
export function normalizeToolbarGroups(value: unknown): ToolbarGroupVisibility {
  const raw = value && typeof value === 'object' ? (value as Record<string, unknown>) : {}
  const out = defaultToolbarGroups()
  for (const key of TOOLBAR_GROUP_KEYS) if (typeof raw[key] === 'boolean') out[key] = raw[key] as boolean
  return out
}

/**
 * 主工具栏逐按钮登记表（帮助 toolbar_mainbar.html 各小节内的按钮，按钮名取帮助原文）。
 * 「添加或删除按钮 → 自定义...」对话框按本表逐个勾选显示/隐藏、上移/下移排序、指派按键，
 * 结果随系统选项 `toolbarLayout` 持久化（下次启动仍生效）。
 */
export interface ToolbarButtonDef {
  key: string
  group: ToolbarGroupKey
  /** 按钮名（帮助 toolbar_mainbar.html 原文），用于「自定义」对话框的清单与按键说明。 */
  label: string
}

export const TOOLBAR_BUTTONS: readonly ToolbarButtonDef[] = [
  { key: 'new', group: 'file', label: '新建标签模版' },
  { key: 'open', group: 'file', label: '打开标签模版' },
  { key: 'save', group: 'file', label: '保存' },

  { key: 'cut', group: 'edit', label: '剪切' },
  { key: 'copy', group: 'edit', label: '复制' },
  { key: 'paste', group: 'edit', label: '粘贴' },
  { key: 'delete', group: 'edit', label: '删除' },

  { key: 'undo', group: 'history', label: '撤销' },
  // 帮助 toolbar_mainbar.html「撤消、重做」小节里该按钮原文为「恢复」，与编辑菜单「恢复(R)」同一命令、同一文案
  { key: 'redo', group: 'history', label: '恢复' },

  { key: 'labelFormat', group: 'print', label: '标签格式设置' },
  { key: 'preview', group: 'print', label: '打印预览' },
  { key: 'print', group: 'print', label: '打印' },

  { key: 'select', group: 'object', label: '选取' },
  { key: 'barcode', group: 'object', label: '条码' },
  { key: 'text', group: 'object', label: '文字' },
  { key: 'line', group: 'object', label: '线条' },
  { key: 'diagonal', group: 'object', label: '斜线' },
  { key: 'rect', group: 'object', label: '矩形' },
  { key: 'image', group: 'object', label: '图片' },
  { key: 'table', group: 'object', label: '表格' },
  { key: 'rfid', group: 'object', label: 'RFID' },
  { key: 'data', group: 'object', label: '数据' },

  { key: 'dbConfig', group: 'database', label: '设置数据库' },
  { key: 'dbLocate', group: 'database', label: '定位记录' },
  { key: 'dbRefresh', group: 'database', label: '更新数据库' },
  { key: 'dbFirst', group: 'database', label: '第一条记录' },
  { key: 'dbPrev', group: 'database', label: '上一条记录' },
  { key: 'dbNext', group: 'database', label: '下一条记录' },
  { key: 'dbLast', group: 'database', label: '最后一条记录' },

  { key: 'zoomIn', group: 'view', label: '放大' },
  { key: 'zoomOut', group: 'view', label: '缩小' },
  { key: 'fitWidth', group: 'view', label: '适应宽度' },
  { key: 'fitHeight', group: 'view', label: '适应高度' },
  { key: 'fitWindow', group: 'view', label: '撑满窗口' },

  { key: 'help', group: 'help', label: '帮助主题' }
]

export const TOOLBAR_BUTTON_KEYS: string[] = TOOLBAR_BUTTONS.map((b) => b.key)

export function toolbarButtonLabel(key: string): string {
  return TOOLBAR_BUTTONS.find((b) => b.key === key)?.label ?? key
}

export function toolbarButtonGroup(key: string): ToolbarGroupKey | undefined {
  return TOOLBAR_BUTTONS.find((b) => b.key === key)?.group
}

/** 工具栏自定义布局：按钮顺序 + 逐个隐藏 + 指派按键（按键写法如 `Ctrl+1`）。 */
export interface ToolbarLayout {
  /** 全部按钮的显示顺序（默认 = 登记表顺序）。 */
  order: string[]
  /** 被隐藏的按钮 key。 */
  hidden: string[]
  /** 按钮 key → 按键组合，如 `{ zoomIn: 'Ctrl+1' }`。 */
  keys: Record<string, string>
}

export function defaultToolbarLayout(): ToolbarLayout {
  return { order: [...TOOLBAR_BUTTON_KEYS], hidden: [], keys: {} }
}

function isKnownPanelKey(key: string): boolean {
  return TOOLBAR_BUTTON_KEYS.includes(key)
}

/** 只接受已知按钮的取值；缺失/未知项按默认补齐，保证新旧选项文件都能用。 */
export function normalizeToolbarLayout(value: unknown): ToolbarLayout {
  const raw = value && typeof value === 'object' ? (value as Record<string, unknown>) : {}
  const out = defaultToolbarLayout()

  const order = Array.isArray(raw.order) ? raw.order.filter((k): k is string => typeof k === 'string' && isKnownPanelKey(k)) : []
  const seen = new Set<string>()
  const merged: string[] = []
  for (const k of order) if (!seen.has(k)) { seen.add(k); merged.push(k) }
  for (const k of TOOLBAR_BUTTON_KEYS) if (!seen.has(k)) { seen.add(k); merged.push(k) }
  out.order = merged

  if (Array.isArray(raw.hidden)) out.hidden = raw.hidden.filter((k): k is string => typeof k === 'string' && isKnownPanelKey(k))

  if (raw.keys && typeof raw.keys === 'object') {
    const src = raw.keys as Record<string, unknown>
    const keys: Record<string, string> = {}
    for (const k of TOOLBAR_BUTTON_KEYS) {
      const v = src[k]
      if (typeof v === 'string' && v.trim()) keys[k] = v.trim()
    }
    out.keys = keys
  }
  return out
}

/** 按布局顺序返回可见按钮 key；按钮组被隐藏（「添加或删除按钮 → 标准」）时整组跳过。 */
export function visibleToolbarButtons(layout: ToolbarLayout, groups?: Record<string, boolean>): string[] {
  const hidden = new Set(layout.hidden)
  return layout.order.filter((key) => {
    if (hidden.has(key)) return false
    const group = toolbarButtonGroup(key)
    if (groups && group && groups[group] === false) return false
    return true
  })
}

/** 按键事件是否匹配指派给按钮的组合键（`Ctrl+1` / `Alt+F1` / `Shift+F2`）。 */
export function matchToolbarKey(binding: string, e: { ctrlKey: boolean; altKey: boolean; shiftKey: boolean; key: string }): boolean {
  const parts = binding.split('+').map((p) => p.trim()).filter(Boolean)
  if (!parts.length) return false
  const wantKey = parts[parts.length - 1].toLowerCase()
  const mods = parts.slice(0, -1).map((p) => p.toLowerCase())
  if (mods.includes('ctrl') !== e.ctrlKey) return false
  if (mods.includes('alt') !== e.altKey) return false
  if (mods.includes('shift') !== e.shiftKey) return false
  return e.key.toLowerCase() === wantKey
}

/** 把键盘事件格式化成按键写法，用于「自定义」对话框录键与显示。 */
export function formatToolbarKey(e: { ctrlKey: boolean; altKey: boolean; shiftKey: boolean; key: string }): string {
  if (['Control', 'Alt', 'Shift', 'Meta'].includes(e.key)) return ''
  const mods: string[] = []
  if (e.ctrlKey) mods.push('Ctrl')
  if (e.altKey) mods.push('Alt')
  if (e.shiftKey) mods.push('Shift')
  const name = e.key.length === 1 ? e.key.toUpperCase() : e.key
  if (!mods.length) return ''
  return [...mods, name].join('+')
}

/** 分组清单（供「自定义」对话框按组显示标题）。 */
export const toolbarGroupsInOrder = TOOLBAR_GROUP_KEYS.map((key) => ({ key, label: TOOLBAR_GROUPS.find((g) => g.key === key)!.label }))
