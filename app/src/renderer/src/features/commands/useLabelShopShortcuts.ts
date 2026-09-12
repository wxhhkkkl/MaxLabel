import { useEffect, useRef } from 'react'

export interface LabelShopShortcutActions {
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
  move: (dx: number, dy: number) => void
}

function isEditableTarget(target: EventTarget | null): boolean {
  const element = target as HTMLElement | null
  return !!element && (element.tagName === 'INPUT' || element.tagName === 'TEXTAREA' || element.tagName === 'SELECT' || element.isContentEditable)
}

/** LabelShop 6.37 快捷键的唯一绑定入口。菜单和工具栏应调用同一 actions。 */
export function useLabelShopShortcuts(actions: LabelShopShortcutActions): void {
  const actionsRef = useRef(actions)
  actionsRef.current = actions
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const a = actionsRef.current
      const ctrl = event.ctrlKey || event.metaKey
      const key = event.key
      const lower = key.toLowerCase()
      const invoke = (action: () => void) => { event.preventDefault(); action() }

      if (ctrl && lower === 's') return invoke(a.save)
      if (ctrl && lower === 'n') return invoke(a.create)
      if (ctrl && lower === 'o') return invoke(a.open)
      if (ctrl && lower === 'p' && a.hasDocument) return invoke(a.print)
      if (ctrl && lower === 'f' && a.hasDocument) return invoke(a.locate)
      if (key === 'F1') return invoke(a.help)
      if (isEditableTarget(event.target)) return

      if (ctrl && lower === 'z') return invoke(a.undo)
      if (ctrl && lower === 'y') return invoke(a.redo)
      if (ctrl && lower === 'x') return invoke(a.cut)
      if (ctrl && lower === 'c') return invoke(a.copy)
      if (ctrl && lower === 'v') return invoke(a.paste)
      if (ctrl && lower === 'a') return invoke(a.selectAll)
      if ((key === 'Delete' || key === 'Backspace') && a.hasSelection) return invoke(event.shiftKey ? a.cut : a.remove)
      if (ctrl && lower === 'w' && a.hasDocument) return invoke(a.close)
      if (ctrl && lower === 'g') return invoke(a.group)
      if (ctrl && lower === 'u') return invoke(a.ungroup)
      if (ctrl && lower === 'l') return invoke(a.lock)
      if (ctrl && lower === 'b') return invoke(a.sendBack)
      if (ctrl && (key === '=' || key === '+')) return invoke(a.zoomIn)
      if (ctrl && key === '-') return invoke(a.zoomOut)
      if (ctrl && event.altKey && key === '0') return invoke(a.fitWindow)
      if (ctrl && lower === 'r') return invoke(a.toggleObjectInfo)
      if (key === 'Escape') return a.clearSelection()
      if (event.altKey && key === 'Enter') return invoke(a.properties)
      if (ctrl && lower === 'e' && a.hasDocument) return invoke(a.exportImage)
      if ((key === 'Tab' || (ctrl && lower === 't')) && a.hasDocument) return invoke(a.selectNext)
      if (a.hasSelection && ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(key)) {
        const step = event.shiftKey ? 5 : 0.5
        event.preventDefault()
        if (key === 'ArrowUp') a.move(0, -step)
        else if (key === 'ArrowDown') a.move(0, step)
        else if (key === 'ArrowLeft') a.move(-step, 0)
        else a.move(step, 0)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])
}
