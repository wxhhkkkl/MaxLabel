import { useEffect, useRef } from 'react'
import { handleLabelShopShortcut, type LabelShopShortcutActions } from './shortcutHandler'

export type { LabelShopShortcutActions } from './shortcutHandler'

/** LabelShop 6.37 快捷键的唯一绑定入口。菜单和工具栏应调用同一 actions。 */
export function useLabelShopShortcuts(actions: LabelShopShortcutActions): void {
  const actionsRef = useRef(actions)
  actionsRef.current = actions
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      handleLabelShopShortcut(event, actionsRef.current)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])
}
