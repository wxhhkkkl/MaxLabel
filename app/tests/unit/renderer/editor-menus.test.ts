import { describe, expect, it, vi } from 'vitest'
import { buildAppMenus } from '@/features/commands/appMenus'
import type { MenuItem, MenuSection } from '@/editor/MenuBar'
import { docTab, menuDeps } from '../../helpers/editorShell'

// 015：顶层不再单列「建议与反馈」，它被收进了「帮助(H)」。
const SECTION_TITLES = ['文件(F)', '编辑(E)', '查看(V)', '工具(T)', '排列(A)', '数据库(D)', '账户(A)', '云服务(C)', '选项(O)', '窗口(W)', '帮助(H)']

function section(sections: MenuSection[], title: string): MenuSection {
  const found = sections.find((item) => item.title === title)
  if (!found) throw new Error(`missing section ${title}`)
  return found
}

function item(items: MenuItem[], label: string): MenuItem {
  for (const candidate of items) {
    if (candidate.label === label) return candidate
    if (candidate.children) {
      try {
        return item(candidate.children, label)
      } catch {
        // keep searching siblings
      }
    }
  }
  throw new Error(`missing item ${label}`)
}

describe('editor menu structure', () => {
  it('keeps the 原版 sections in order for documents and the start page', () => {
    expect(buildAppMenus(menuDeps()).sections.map((s) => s.title)).toEqual(SECTION_TITLES)
    expect(buildAppMenus(menuDeps({ isStart: true })).sections.map((s) => s.title)).toEqual(SECTION_TITLES)
  })

  it('wires File actions and their display shortcuts', () => {
    const deps = menuDeps()
    const file = section(buildAppMenus(deps).sections, '文件(F)')
    expect(item(file.items, '新建(N)').shortcut).toBe('Ctrl+N')
    item(file.items, '新建(N)').action?.()
    expect(deps.requestNew).toHaveBeenCalledTimes(1)
    item(file.items, '标签格式设置(L)...').action?.()
    expect(deps.setModal).toHaveBeenCalledWith('new')
  })

  it('reflects save, busy and internal-printer availability', () => {
    const clean = section(buildAppMenus(menuDeps()).sections, '文件(F)')
    expect(item(clean.items, '保存(S)').disabled).toBe(true)
    const dirty = section(buildAppMenus(menuDeps({ activeTab: docTab({ dirty: true }) })).sections, '文件(F)')
    expect(item(dirty.items, '保存(S)').disabled).toBe(false)

    const busy = section(buildAppMenus(menuDeps({ busy: true })).sections, '文件(F)')
    expect(item(busy.items, '打印(P)...').disabled).toBe(true)
    const internal = section(buildAppMenus(menuDeps({ internalPrinter: true })).sections, '文件(F)')
    expect(item(internal.items, '打印预览(V)').disabled).toBe(true)
  })

  it('uses the start-page File menu and disables document commands', () => {
    const file = section(buildAppMenus(menuDeps({ isStart: true })).sections, '文件(F)')
    expect(item(file.items, '打开(Q)...').shortcut).toBe('Ctrl+O')
    expect(item(file.items, '关闭(C)').disabled).toBe(true)
  })

  it('reflects view/theme state and toggles through actions', () => {
    const deps = menuDeps({ showToolbar: false, appTheme: 'black' })
    const view = section(buildAppMenus(deps).sections, '查看(V)')
    const toolbar = item(view.items, '工具栏(T)')
    expect(toolbar.checked).toBe(false)
    toolbar.action?.()
    expect(deps.toggleToolbar).toHaveBeenCalled()

    const options = section(buildAppMenus(deps).sections, '选项(O)')
    const appearance = item(options.items, '应用程序外观(A)')
    const black = appearance.children?.find((child) => child.label === '黑色样式(L)')
    expect(black?.radio).toBe(true)
  })

  it('returns a non-empty context menu with selection-dependent commands', () => {
    const result = buildAppMenus(menuDeps({ contextMenu: { visible: true, x: 0, y: 0, hasSelection: true, selectionCount: 2 } }))
    expect(result.contextItems.length).toBeGreaterThan(0)
    expect(item(result.contextItems, '组合(G)').disabled).toBe(false)
    expect(item(result.contextItems, '属性').disabled).toBe(false)
  })

  it('keeps 建议与反馈 inside the Help menu and points 在线网站 at the mall site', () => {
    const deps = menuDeps()
    const sections = buildAppMenus(deps).sections
    expect(sections.some((s) => s.title === '建议与反馈')).toBe(false)

    const help = section(sections, '帮助(H)')
    item(help.items, '建议与反馈').action?.()
    expect(deps.setModal).toHaveBeenCalledWith('feedback')

    const open = vi.fn()
    const previous = (globalThis as unknown as { window?: unknown }).window
    ;(globalThis as unknown as { window?: unknown }).window = { ...(previous as object ?? {}), open }
    try {
      item(help.items, '在线网站(W)').action?.()
    } finally {
      ;(globalThis as unknown as { window?: unknown }).window = previous
    }
    expect(open).toHaveBeenCalledWith('https://new.yuwangchenfa.com/')
  })
})
