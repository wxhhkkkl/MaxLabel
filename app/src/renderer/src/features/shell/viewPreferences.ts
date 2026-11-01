export type AppTheme = 'blue' | 'black' | 'silver' | 'aqua'

export const THEMES: Record<AppTheme, Record<string, string>> = {
  blue: { '--app-accent': '#2E6E93', '--app-bar-bg': '#F6F5F2', '--app-page-bg': '#F4F3EE', '--app-bar-text': '#1A1B1C' },
  black: { '--app-accent': '#5B8DB8', '--app-bar-bg': '#3A3A3A', '--app-page-bg': '#2A2A2A', '--app-bar-text': '#E8E8E8' },
  silver: { '--app-accent': '#5A6B7A', '--app-bar-bg': '#DCDCE0', '--app-page-bg': '#ECECEE', '--app-bar-text': '#1A1B1C' },
  aqua: { '--app-accent': '#1D8E8B', '--app-bar-bg': '#D6EAE8', '--app-page-bg': '#EEF6F5', '--app-bar-text': '#1A1B1C' }
}

export interface ViewPreferences {
  showToolbar: boolean
  showFormatBar: boolean
  showAlignBar: boolean
  showStatusBar: boolean
  showPrintPanel: boolean
  showLayerPanel: boolean
  /** 右下「常用属性」面板：默认不显示，从「查看 → 常用属性」打开（020 现场） */
  showProperties: boolean
  showObjectInfo: boolean
  appTheme: AppTheme
}

/** Panel visibility and theme are session-only; they reset on restart. */
export function defaultViewPreferences(): ViewPreferences {
  return {
    showToolbar: true,
    showFormatBar: true,
    showAlignBar: true,
    showStatusBar: true,
    showPrintPanel: true,
    showLayerPanel: true,
    // 020：右下属性面板默认收起，选中对象不再自动弹出整块属性。
    showProperties: false,
    // 015：默认不出现，用户从「查看 → 显示对象信息」勾选后才显示。
    showObjectInfo: false,
    appTheme: 'blue'
  }
}
