import { describe, expect, it } from 'vitest'
import { buildLabelShopMenus } from '@/features/commands/labelShopMenus'
import type { MenuItem, MenuSection } from '@/editor/MenuBar'
import { docTab, menuDeps } from '../../helpers/editorShell'

const SECTION_TITLES = ['文件(F)', '编辑(E)', '查看(V)', '工具(T)', '排列(A)', '数据库(D)', '账户(A)', '云服务(C)', '选项(O)', '窗口(W)', '帮助(H)', '建议与反馈']

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
  it('keeps the twelve LabelShop sections in order for documents and the start page', () => {
    expect(buildLabelShopMenus(menuDeps()).sections.map((s) => s.title)).toEqual(SECTION_TITLES)
    expect(buildLabelShopMenus(menuDeps({ isStart: true })).sections.map((s) => s.title)).toEqual(SECTION_TITLES)
  })

  it('wires File actions and their display shortcuts', () => {
    const deps = menuDeps()
    const file = section(buildLabelShopMenus(deps).sections, '文件(F)')
    expect(item(file.items, '新建(N)').shortcut).toBe('Ctrl+N')
    item(file.items, '新建(N)').action?.()
    expect(deps.requestNew).toHaveBeenCalledTimes(1)
    item(file.items, '标签格式设置(L)...').action?.()
    expect(deps.setModal).toHaveBeenCalledWith('new')
  })

  it('reflects save, busy and internal-printer availability', () => {
    const clean = section(buildLabelShopMenus(menuDeps()).sections, '文件(F)')
    expect(item(clean.items, '保存(S)').disabled).toBe(true)
    const dirty = section(buildLabelShopMenus(menuDeps({ activeTab: docTab({ dirty: true }) })).sections, '文件(F)')
    expect(item(dirty.items, '保存(S)').disabled).toBe(false)

    const busy = section(buildLabelShopMenus(menuDeps({ busy: true })).sections, '文件(F)')
    expect(item(busy.items, '打印(P)...').disabled).toBe(true)
    const internal = section(buildLabelShopMenus(menuDeps({ internalPrinter: true })).sections, '文件(F)')
    expect(item(internal.items, '打印预览(V)').disabled).toBe(true)
  })

  it('uses the start-page File menu and disables document commands', () => {
    const file = section(buildLabelShopMenus(menuDeps({ isStart: true })).sections, '文件(F)')
    expect(item(file.items, '打开(Q)...').shortcut).toBe('Ctrl+O')
    expect(item(file.items, '关闭(C)').disabled).toBe(true)
  })

  it('reflects view/theme state and toggles through actions', () => {
    const deps = menuDeps({ showToolbar: false, appTheme: 'black' })
    const view = section(buildLabelShopMenus(deps).sections, '查看(V)')
    const toolbar = item(view.items, '工具栏(T)')
    expect(toolbar.checked).toBe(false)
    toolbar.action?.()
    expect(deps.toggleToolbar).toHaveBeenCalled()

    const options = section(buildLabelShopMenus(deps).sections, '选项(O)')
    const appearance = item(options.items, '应用程序外观(A)')
    const black = appearance.children?.find((child) => child.label === '黑色样式(L)')
    expect(black?.radio).toBe(true)
  })

  it('returns a non-empty context menu with selection-dependent commands', () => {
    const result = buildLabelShopMenus(menuDeps({ contextMenu: { visible: true, x: 0, y: 0, hasSelection: true, selectionCount: 2 } }))
    expect(result.contextItems.length).toBeGreaterThan(0)
    expect(item(result.contextItems, '组合(G)').disabled).toBe(false)
    expect(item(result.contextItems, '属性').disabled).toBe(false)
  })
})
