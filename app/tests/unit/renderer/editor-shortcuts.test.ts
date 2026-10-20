import { describe, expect, it } from 'vitest'
import { handleLabelShopShortcut } from '@/features/commands/shortcutHandler'
import { INPUT_TARGET, shortcutActions, shortcutEvent } from '../../helpers/editorShell'

describe('editor keyboard shortcuts', () => {
  it('runs global commands even when focus is in an editable control', () => {
    const actions = shortcutActions()
    for (const [key, ctrl, action] of [
      ['s', true, actions.save],
      ['n', true, actions.create],
      ['o', true, actions.open],
      ['p', true, actions.print],
      ['F1', false, actions.help]
    ] as const) {
      const event = shortcutEvent({ key, ctrlKey: ctrl, target: INPUT_TARGET })
      handleLabelShopShortcut(event, actions)
      expect(action).toHaveBeenCalledTimes(1)
      expect(event.preventDefault).toHaveBeenCalled()
    }
  })

  it('blocks canvas commands while typing in an editable control', () => {
    const actions = shortcutActions()
    for (const key of ['z', 'y', 'x', 'c', 'v', 'a']) {
      handleLabelShopShortcut(shortcutEvent({ key, ctrlKey: true, target: INPUT_TARGET }), actions)
    }
    expect(actions.undo).not.toHaveBeenCalled()
    expect(actions.redo).not.toHaveBeenCalled()
    expect(actions.cut).not.toHaveBeenCalled()
    expect(actions.copy).not.toHaveBeenCalled()
    expect(actions.paste).not.toHaveBeenCalled()
    expect(actions.selectAll).not.toHaveBeenCalled()
  })

  it('runs canvas editing shortcuts outside editable controls', () => {
    const actions = shortcutActions()
    for (const [key, ctrl, action] of [
      ['z', true, actions.undo],
      ['y', true, actions.redo],
      ['x', true, actions.cut],
      ['c', true, actions.copy],
      ['v', true, actions.paste],
      ['a', true, actions.selectAll],
      ['g', true, actions.group],
      ['u', true, actions.ungroup],
      ['l', true, actions.lock],
      ['b', true, actions.sendBack]
    ] as const) {
      handleLabelShopShortcut(shortcutEvent({ key, ctrlKey: ctrl }), actions)
      expect(action).toHaveBeenCalledTimes(1)
    }
  })

  it('deletes with Delete/Backspace and cuts with Shift+Delete only when something is selected', () => {
    const actions = shortcutActions({ hasSelection: true })
    handleLabelShopShortcut(shortcutEvent({ key: 'Delete' }), actions)
    expect(actions.remove).toHaveBeenCalledTimes(1)
    handleLabelShopShortcut(shortcutEvent({ key: 'Delete', shiftKey: true }), actions)
    expect(actions.cut).toHaveBeenCalledTimes(1)

    const noSelection = shortcutActions({ hasSelection: false })
    handleLabelShopShortcut(shortcutEvent({ key: 'Delete' }), noSelection)
    expect(noSelection.remove).not.toHaveBeenCalled()
  })

  it('selects tools with single letters and nudges by 0.5 mm or 5 mm with Shift', () => {
    const actions = shortcutActions({ hasSelection: true })
    for (const [key, tool] of [['s', 'select'], ['b', 'barcode'], ['t', 'text'], ['l', 'line'], ['u', 'diagonal'], ['r', 'rect'], ['p', 'image'], ['d', 'data'], ['g', 'table']] as const) {
      handleLabelShopShortcut(shortcutEvent({ key }), actions)
      expect(actions.tool).toHaveBeenLastCalledWith(tool)
    }
    handleLabelShopShortcut(shortcutEvent({ key: 'ArrowRight' }), actions)
    expect(actions.move).toHaveBeenLastCalledWith(0.5, 0)
    handleLabelShopShortcut(shortcutEvent({ key: 'ArrowDown', shiftKey: true }), actions)
    expect(actions.move).toHaveBeenLastCalledWith(0, 5)
  })

  it('handles Escape, Alt+Enter, zoom, tabs, export and object info', () => {
    const actions = shortcutActions()
    handleLabelShopShortcut(shortcutEvent({ key: 'Escape' }), actions)
    expect(actions.clearSelection).toHaveBeenCalled()
    handleLabelShopShortcut(shortcutEvent({ key: 'Enter', altKey: true }), actions)
    expect(actions.properties).toHaveBeenCalled()
    handleLabelShopShortcut(shortcutEvent({ key: '=', ctrlKey: true }), actions)
    expect(actions.zoomIn).toHaveBeenCalled()
    handleLabelShopShortcut(shortcutEvent({ key: '-', ctrlKey: true }), actions)
    expect(actions.zoomOut).toHaveBeenCalled()
    handleLabelShopShortcut(shortcutEvent({ key: '0', ctrlKey: true, altKey: true }), actions)
    expect(actions.fitWindow).toHaveBeenCalled()
    handleLabelShopShortcut(shortcutEvent({ key: 'r', ctrlKey: true }), actions)
    expect(actions.toggleObjectInfo).toHaveBeenCalled()
    handleLabelShopShortcut(shortcutEvent({ key: 'e', ctrlKey: true }), actions)
    expect(actions.exportImage).toHaveBeenCalled()
    handleLabelShopShortcut(shortcutEvent({ key: 'Tab' }), actions)
    expect(actions.selectNext).toHaveBeenCalled()
    handleLabelShopShortcut(shortcutEvent({ key: 'w', ctrlKey: true }), actions)
    expect(actions.close).toHaveBeenCalled()
  })
})
