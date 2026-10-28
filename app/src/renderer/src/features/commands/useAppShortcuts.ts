import { useEffect, useRef } from 'react'
import { handleAppShortcut, type AppShortcutActions } from './shortcutHandler'

export type { AppShortcutActions } from './shortcutHandler'

/** 原版 6.37 快捷键的唯一绑定入口。菜单和工具栏应调用同一 actions。 */
export function useAppShortcuts(actions: AppShortcutActions): void {
  const actionsRef = useRef(actions)
  actionsRef.current = actions
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      handleAppShortcut(event, actionsRef.current)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])
}
