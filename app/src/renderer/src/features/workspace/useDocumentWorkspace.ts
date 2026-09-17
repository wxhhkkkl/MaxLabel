import { useCallback, useEffect, useMemo, useRef, useState, type SetStateAction } from 'react'
import type { LabelDoc } from '../../types'

export const WORKSPACE_START_KEY = 'start'

export interface DocTab {
  key: string
  title: string
  doc: LabelDoc
  selectedId: string | null
  count: number
  /**
   * `Ctrl+P` 打印对话框的「打印数量」。与原版一致，它与停靠面板上的「打印数量」是**两处独立的值**：
   * 停靠面板默认 1（`count`），本对话框默认一页的枚数（rows × cols，真机为 8）并可自由改小/改大
   * （帮助 print_dlg_main.html：「如果要打印二十个标签，只要…在打印数量编辑框输入20」，无下限约束）。
   */
  printCount: number
  copies: number
  datasetName: string
  zoom: number
  zoomMode?: 'manual' | 'win' | 'w' | 'h'
  tool: string
  recordIdx: number
  startLabel: number
  /** 当前文档对应的可覆盖保存路径；导入 LabelShop 文件时为空。 */
  path?: string
  /** 自上次成功保存后是否发生过编辑。 */
  dirty: boolean
  /** 单调递增的编辑版本，用于防止异步保存覆盖更新后的 dirty 状态。 */
  revision: number
}

/**
 * 文档标签页、当前文档选择和文档更新的唯一状态入口。
 *
 * 启动时**没有**任何文档标签页——与原版一致（真机启动截图
 * `parity/reference/labelshop/92-00-startup.png`：标签页条上只有「起始页」一个页签，
 * 不存在空白模板页签）。新建标签模板由「文件 → 新建标签模板」(Ctrl+N) 或起始页左栏
 * 的「新建标签模板」链接产生，编号从 `新标签模板1` 起。
 */
export function useDocumentWorkspace() {
  const [tabs, setTabsState] = useState<DocTab[]>(() => [])
  const tabsRef = useRef(tabs)
  const setTabs = useCallback((value: SetStateAction<DocTab[]>) => {
    setTabsState((current) => {
      const next = typeof value === 'function' ? value(current) : value
      tabsRef.current = next
      return next
    })
  }, [])
  useEffect(() => { tabsRef.current = tabs }, [tabs])
  const [active, setActive] = useState<string>(WORKSPACE_START_KEY)
  const isStart = active === WORKSPACE_START_KEY
  const activeTab = useMemo(() => isStart ? undefined : tabs.find((tab) => tab.key === active), [tabs, active, isStart])

  const patchTab = useCallback((key: string, patch: (tab: DocTab) => DocTab) => {
    setTabs((current) => {
      const next = current.map((tab) => tab.key === key ? patch(tab) : tab)
      tabsRef.current = next
      return next
    })
  }, [setTabs])

  const patchDocument = useCallback((key: string, patch: (doc: LabelDoc) => LabelDoc) => {
    patchTab(key, (tab) => {
      const next = patch(tab.doc)
      return next === tab.doc ? tab : { ...tab, doc: next, dirty: true, revision: tab.revision + 1 }
    })
  }, [patchTab])

  const setActiveDoc = useCallback((patch: (doc: LabelDoc) => LabelDoc) => {
    patchTab(active, (tab) => {
      const next = patch(tab.doc)
      return next === tab.doc ? tab : { ...tab, doc: next, dirty: true, revision: tab.revision + 1 }
    })
  }, [active, patchTab])

  return { tabs, setTabs, tabsRef, active, setActive, activeTab, isStart, patchTab, patchDocument, setActiveDoc }
}
