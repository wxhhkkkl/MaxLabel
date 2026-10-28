export interface AppShortcutActions {
  hasDocument: boolean
  hasSelection: boolean
  save: () => void
  create: () => void
  open: () => void
  print: () => void
  locate: () => void
  help: () => void
  undo: () => void
  redo: () => void
  cut: () => void
  copy: () => void
  paste: () => void
  selectAll: () => void
  remove: () => void
  close: () => void
  group: () => void
  ungroup: () => void
  lock: () => void
  sendBack: () => void
  zoomIn: () => void
  zoomOut: () => void
  fitWindow: () => void
  toggleObjectInfo: () => void
  clearSelection: () => void
  properties: () => void
  exportImage: () => void
  selectNext: () => void
  tool: (tool: string) => void
  move: (dx: number, dy: number) => void
}

export interface AppShortcutEvent {
  key: string
  ctrlKey?: boolean
  altKey?: boolean
  shiftKey?: boolean
  metaKey?: boolean
  target?: unknown
  preventDefault?: () => void
}

export function isEditableTarget(target: unknown): boolean {
  const element = target as { tagName?: string; isContentEditable?: boolean } | null
  return Boolean(element) && (
    element!.tagName === 'INPUT'
    || element!.tagName === 'TEXTAREA'
    || element!.tagName === 'SELECT'
    || element!.isContentEditable === true
  )
}

/**
 * 原版 6.37 keyboard translation. Returns true when a command ran (and the default
 * browser/Electron action was prevented). Menus and toolbars call the same actions.
 */
export function handleAppShortcut(event: AppShortcutEvent, actions: AppShortcutActions): boolean {
  const ctrl = Boolean(event.ctrlKey || event.metaKey)
  const key = event.key
  const lower = key.toLowerCase()
  const invoke = (action: () => void): true => {
    event.preventDefault?.()
    action()
    return true
  }

  if (ctrl && lower === 's') return invoke(actions.save)
  if (ctrl && lower === 'n') return invoke(actions.create)
  if (ctrl && lower === 'o') return invoke(actions.open)
  if (ctrl && lower === 'p' && actions.hasDocument) return invoke(actions.print)
  if (ctrl && lower === 'f' && actions.hasDocument) return invoke(actions.locate)
  if (key === 'F1') return invoke(actions.help)
  if (isEditableTarget(event.target)) return false

  if (ctrl && lower === 'z') return invoke(actions.undo)
  if (ctrl && lower === 'y') return invoke(actions.redo)
  if (ctrl && lower === 'x') return invoke(actions.cut)
  if (ctrl && lower === 'c') return invoke(actions.copy)
  if (ctrl && lower === 'v') return invoke(actions.paste)
  if (ctrl && lower === 'a') return invoke(actions.selectAll)
  if ((key === 'Delete' || key === 'Backspace') && actions.hasSelection) return invoke(event.shiftKey ? actions.cut : actions.remove)
  if (ctrl && lower === 'w' && actions.hasDocument) return invoke(actions.close)
  if (ctrl && lower === 'g') return invoke(actions.group)
  if (ctrl && lower === 'u') return invoke(actions.ungroup)
  if (ctrl && lower === 'l') return invoke(actions.lock)
  if (ctrl && lower === 'b') return invoke(actions.sendBack)
  if (ctrl && (key === '=' || key === '+')) return invoke(actions.zoomIn)
  if (ctrl && key === '-') return invoke(actions.zoomOut)
  if (ctrl && event.altKey && key === '0') return invoke(actions.fitWindow)
  if (ctrl && lower === 'r') return invoke(actions.toggleObjectInfo)
  if (key === 'Escape') {
    actions.clearSelection()
    return true
  }
  if (event.altKey && key === 'Enter') return invoke(actions.properties)
  if (ctrl && lower === 'e' && actions.hasDocument) return invoke(actions.exportImage)
  if ((key === 'Tab' || (ctrl && lower === 't')) && actions.hasDocument) return invoke(actions.selectNext)
  if (!ctrl && !event.altKey && actions.hasDocument) {
    const tool = ({ s: 'select', b: 'barcode', t: 'text', l: 'line', u: 'diagonal', r: 'rect', p: 'image', d: 'data', g: 'table' } as Record<string, string>)[lower]
    if (tool) return invoke(() => actions.tool(tool))
  }
  if (actions.hasSelection && ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(key)) {
    const step = event.shiftKey ? 5 : 0.5
    event.preventDefault?.()
    if (key === 'ArrowUp') actions.move(0, -step)
    else if (key === 'ArrowDown') actions.move(0, step)
    else if (key === 'ArrowLeft') actions.move(-step, 0)
    else actions.move(step, 0)
    return true
  }
  return false
}
