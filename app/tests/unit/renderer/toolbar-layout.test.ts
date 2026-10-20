import { describe, expect, it } from 'vitest'
import {
  TOOLBAR_BUTTONS,
  TOOLBAR_GROUPS,
  defaultToolbarLayout,
  formatToolbarKey,
  matchToolbarKey,
  normalizeToolbarLayout,
  visibleToolbarButtons
} from '@/editor/toolbarLayout'

describe('toolbar registry and layout', () => {
  it('registers eight groups and thirty-five buttons with unique keys', () => {
    expect(TOOLBAR_GROUPS.map((group) => group.key)).toEqual(['file', 'edit', 'history', 'print', 'object', 'database', 'view', 'help'])
    expect(TOOLBAR_BUTTONS).toHaveLength(35)
    const keys = TOOLBAR_BUTTONS.map((button) => button.key)
    expect(new Set(keys).size).toBe(keys.length)
    expect(TOOLBAR_BUTTONS.every((button) => TOOLBAR_GROUPS.some((group) => group.key === button.group))).toBe(true)
  })

  it('returns the registry order and no hidden/key bindings by default', () => {
    const layout = defaultToolbarLayout()
    expect(layout.order).toEqual(TOOLBAR_BUTTONS.map((button) => button.key))
    expect(layout.hidden).toEqual([])
    expect(layout.keys).toEqual({})
  })

  it('normalises order, hidden buttons and key bindings', () => {
    const layout = normalizeToolbarLayout({
      order: ['help', 'unknown', 'help', 'new'],
      hidden: ['open', 'unknown'],
      keys: { print: ' Ctrl+Shift+P ', new: '  ', unknown: 'Ctrl+1' }
    })
    expect(layout.order.slice(0, 3)).toEqual(['help', 'new', 'open'])
    expect(layout.order).toHaveLength(35)
    expect(layout.hidden).toEqual(['open'])
    expect(layout.keys).toEqual({ print: 'Ctrl+Shift+P' })
  })

  it('falls back to defaults for invalid input', () => {
    expect(normalizeToolbarLayout(null)).toEqual(defaultToolbarLayout())
    expect(normalizeToolbarLayout({ order: 'x', hidden: 1, keys: [] })).toEqual(defaultToolbarLayout())
  })

  it('combines button and group visibility', () => {
    const layout = normalizeToolbarLayout({ hidden: ['save'] })
    const visible = visibleToolbarButtons(layout, { file: true, edit: false })
    expect(visible).not.toContain('save')
    expect(visible).not.toContain('cut')
    expect(visible).toContain('undo')
  })

  it('matches modifier combinations exactly', () => {
    expect(matchToolbarKey('Ctrl+1', { ctrlKey: true, altKey: false, shiftKey: false, key: '1' })).toBe(true)
    expect(matchToolbarKey('Ctrl+1', { ctrlKey: false, altKey: false, shiftKey: false, key: '1' })).toBe(false)
    expect(matchToolbarKey('Ctrl+Shift+P', { ctrlKey: true, altKey: false, shiftKey: true, key: 'p' })).toBe(true)
    expect(matchToolbarKey('Ctrl+Shift+P', { ctrlKey: true, altKey: false, shiftKey: false, key: 'p' })).toBe(false)
    expect(matchToolbarKey('F1', { ctrlKey: false, altKey: false, shiftKey: false, key: 'F1' })).toBe(true)
    expect(matchToolbarKey('Ctrl', { ctrlKey: true, altKey: false, shiftKey: false, key: 'Control' })).toBe(false)
  })

  it('formats recorded key bindings and ignores modifier-only presses', () => {
    expect(formatToolbarKey({ ctrlKey: true, altKey: false, shiftKey: true, key: 'p' })).toBe('Ctrl+Shift+P')
    expect(formatToolbarKey({ ctrlKey: true, altKey: true, shiftKey: false, key: 'F2' })).toBe('Ctrl+Alt+F2')
    expect(formatToolbarKey({ ctrlKey: false, altKey: false, shiftKey: false, key: 'a' })).toBe('')
    expect(formatToolbarKey({ ctrlKey: true, altKey: false, shiftKey: false, key: 'Control' })).toBe('')
  })
})
