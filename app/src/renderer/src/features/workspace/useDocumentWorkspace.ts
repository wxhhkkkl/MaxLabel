import { useCallback, useEffect, useMemo, useRef, useState, type SetStateAction } from 'react'
import type { LabelDoc } from '../../types'
import { uid } from '../../types'
import { demoTemplate } from '../../editor/demoTemplate'

export const WORKSPACE_START_KEY = 'start'

export interface DocTab {
  key: string
  title: string
  doc: LabelDoc
  selectedId: string | null
  count: number
  copies: number
  datasetName: string
  zoom: number
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

function initialTab(): DocTab {
  return {
    key: uid(),
    title: '新标签模板1',
    doc: demoTemplate(),
    selectedId: null,
    count: 1,
    copies: 1,
    datasetName: '',
    zoom: 1,
    tool: 'select',
    recordIdx: 0,
    startLabel: 1,
    dirty: false,
    revision: 0
  }
}

/** 文档标签页、当前文档选择和文档更新的唯一状态入口。 */
export function useDocumentWorkspace() {
  const [tabs, setTabsState] = useState<DocTab[]>(() => [initialTab()])
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
