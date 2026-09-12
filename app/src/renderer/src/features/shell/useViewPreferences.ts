import { useMemo, useState } from 'react'

export type AppTheme = 'blue' | 'black' | 'silver' | 'aqua'

const THEMES: Record<AppTheme, Record<string, string>> = {
  blue: { '--app-accent': '#2E6E93', '--app-bar-bg': '#F6F5F2', '--app-page-bg': '#F4F3EE', '--app-bar-text': '#1A1B1C' },
  black: { '--app-accent': '#5B8DB8', '--app-bar-bg': '#3A3A3A', '--app-page-bg': '#2A2A2A', '--app-bar-text': '#E8E8E8' },
  silver: { '--app-accent': '#5A6B7A', '--app-bar-bg': '#DCDCE0', '--app-page-bg': '#ECECEE', '--app-bar-text': '#1A1B1C' },
  aqua: { '--app-accent': '#1D8E8B', '--app-bar-bg': '#D6EAE8', '--app-page-bg': '#EEF6F5', '--app-bar-text': '#1A1B1C' }
}

/** 应用外观与面板可见性，避免业务容器持有零散 shell 状态。 */
export function useViewPreferences() {
  const [showToolbar, setShowToolbar] = useState(true)
  const [showFormatBar, setShowFormatBar] = useState(true)
  const [showAlignBar, setShowAlignBar] = useState(true)
  const [showStatusBar, setShowStatusBar] = useState(true)
  const [showPrintPanel, setShowPrintPanel] = useState(true)
  const [showLayerPanel, setShowLayerPanel] = useState(true)
  const [showObjectInfo, setShowObjectInfo] = useState(true)
  const [appTheme, setAppTheme] = useState<AppTheme>('blue')
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
