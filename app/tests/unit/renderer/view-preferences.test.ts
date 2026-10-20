import { describe, expect, it } from 'vitest'
import { THEMES, defaultViewPreferences } from '@/features/shell/viewPreferences'

describe('view preferences', () => {
  it('provides four themes with the shell CSS variables', () => {
    expect(Object.keys(THEMES)).toEqual(['blue', 'black', 'silver', 'aqua'])
    for (const theme of Object.values(THEMES)) {
      expect(theme['--app-accent']).toMatch(/^#[0-9A-Fa-f]{6}$/)
      expect(theme['--app-bar-bg']).toMatch(/^#[0-9A-Fa-f]{6}$/)
      expect(theme['--app-page-bg']).toMatch(/^#[0-9A-Fa-f]{6}$/)
      expect(theme['--app-bar-text']).toMatch(/^#[0-9A-Fa-f]{6}$/)
    }
  })

  it('shows all panels by default and starts with the blue theme', () => {
    expect(defaultViewPreferences()).toEqual({
      showToolbar: true,
      showFormatBar: true,
      showAlignBar: true,
      showStatusBar: true,
      showPrintPanel: true,
      showLayerPanel: true,
      showObjectInfo: true,
      appTheme: 'blue'
    })
  })
})
