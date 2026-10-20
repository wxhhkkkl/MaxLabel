import { useMemo, useState } from 'react'
import { THEMES, defaultViewPreferences, type AppTheme } from './viewPreferences'

export type { AppTheme } from './viewPreferences'

/** 应用外观与面板可见性，避免业务容器持有零散 shell 状态。 */
export function useViewPreferences() {
  const defaults = defaultViewPreferences()
  const [showToolbar, setShowToolbar] = useState(defaults.showToolbar)
  const [showFormatBar, setShowFormatBar] = useState(defaults.showFormatBar)
  const [showAlignBar, setShowAlignBar] = useState(defaults.showAlignBar)
  const [showStatusBar, setShowStatusBar] = useState(defaults.showStatusBar)
  const [showPrintPanel, setShowPrintPanel] = useState(defaults.showPrintPanel)
  const [showLayerPanel, setShowLayerPanel] = useState(defaults.showLayerPanel)
  const [showObjectInfo, setShowObjectInfo] = useState(defaults.showObjectInfo)
  const [appTheme, setAppTheme] = useState<AppTheme>(defaults.appTheme)
  const themeVars = useMemo(() => THEMES[appTheme], [appTheme])

  return {
    showToolbar, setShowToolbar,
    showFormatBar, setShowFormatBar,
    showAlignBar, setShowAlignBar,
    showStatusBar, setShowStatusBar,
    showPrintPanel, setShowPrintPanel,
    showLayerPanel, setShowLayerPanel,
    showObjectInfo, setShowObjectInfo,
    appTheme, setAppTheme,
    themeVars
  }
}
