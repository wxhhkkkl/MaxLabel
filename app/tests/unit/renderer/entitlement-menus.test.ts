import { describe, expect, it } from 'vitest'
import { buildLabelShopMenus } from '@/features/commands/labelShopMenus'
import { FEATURE_MATRIX, type EntitlementState } from '@shared/domain/entitlement'
import { editableEntitlement, menuDeps } from '../../helpers/editorShell'

function readonlyEntitlement(): EntitlementState {
  return editableEntitlement({
    editable: false,
    edition: 'none',
    editionLabel: '未订阅',
    source: 'none',
    features: { ...FEATURE_MATRIX.none },
    subscriptionActive: false
  })
}

function standardEntitlement(): EntitlementState {
  return editableEntitlement({
    edition: 'standard',
    editionLabel: '标准版',
    features: { ...FEATURE_MATRIX.standard }
  })
}

function dongleEntitlement(): EntitlementState {
  return editableEntitlement({
    edition: 'enterprise',
    editionLabel: '加密狗（全部功能）',
    source: 'dongle',
    features: { ...FEATURE_MATRIX.enterprise }
  })
}

function section(entitlement: EntitlementState, title: string) {
  const sections = buildLabelShopMenus(menuDeps({ entitlement })).sections
  const found = sections.find((entry) => entry.title === title)
  if (!found) throw new Error(`missing menu section: ${title}`)
  return found
}

function item(entitlement: EntitlementState, sectionTitle: string, label: string) {
  const found = section(entitlement, sectionTitle).items.find((entry) => entry.label === label)
  if (!found) throw new Error(`missing menu item: ${sectionTitle}/${label}`)
  return found
}

describe('entitlement-driven menu availability', () => {
  it('locks create/edit commands in read-only mode but keeps open and print', () => {
    const readonly = readonlyEntitlement()
    expect(item(readonly, '文件(F)', '新建(N)')).toMatchObject({ disabled: true, locked: 'readonly' })
    expect(item(readonly, '文件(F)', '新建(N)').onLocked).toEqual(expect.any(Function))
    expect(item(readonly, '文件(F)', '保存(S)')).toMatchObject({ disabled: true, locked: 'readonly' })
    expect(item(readonly, '文件(F)', '打开(O)...').disabled).not.toBe(true)
    expect(item(readonly, '文件(F)', '打印(P)...').disabled).not.toBe(true)
    expect(item(readonly, '编辑(E)', '删除(D)')).toMatchObject({ disabled: true, locked: 'readonly' })
  })

  it('locks standard-edition features but keeps basic editing available', () => {
    const standard = standardEntitlement()
    expect(item(standard, '文件(F)', '新建(N)').disabled).not.toBe(true)
    expect(item(standard, '数据库(D)', '设置数据库(D)...')).toMatchObject({ disabled: true, locked: 'feature' })
    expect(item(standard, '数据库(D)', '设置数据库(D)...').onLocked).toEqual(expect.any(Function))
    expect(item(standard, '数据库(D)', '更新数据库')).toMatchObject({ disabled: true, locked: 'feature' })
    expect(item(standard, '查看(V)', '打印历史记录')).toMatchObject({ disabled: true, locked: 'feature' })
    expect(item(standard, '文件(F)', '分享(T)...')).toMatchObject({ disabled: true, locked: 'feature' })
    expect(item(standard, '选项(O)', '电子称')).toMatchObject({ disabled: true, locked: 'feature' })
  })

  it('unlocks professional and enterprise features as the matrix allows', () => {
    const professional = editableEntitlement({
      edition: 'professional',
      editionLabel: '专业版',
      features: { ...FEATURE_MATRIX.professional }
    })
    expect(item(professional, '数据库(D)', '设置数据库(D)...').disabled).not.toBe(true)
    expect(item(professional, '查看(V)', '打印历史记录').disabled).not.toBe(true)
    expect(item(professional, '文件(F)', '分享(T)...')).toMatchObject({ disabled: true, locked: 'feature' })

    const enterprise = editableEntitlement({ features: { ...FEATURE_MATRIX.enterprise } })
    expect(item(enterprise, '文件(F)', '分享(T)...').disabled).not.toBe(true)
    expect(item(enterprise, '选项(O)', '电子称').disabled).not.toBe(true)
  })

  it('lets a valid dongle pass every menu guard', () => {
    const dongle = dongleEntitlement()
    for (const [title, label] of [
      ['文件(F)', '新建(N)'],
      ['文件(F)', '分享(T)...'],
      ['数据库(D)', '设置数据库(D)...'],
      ['查看(V)', '打印历史记录'],
      ['选项(O)', '电子称']
    ] as const) {
      expect(item(dongle, title, label).disabled).not.toBe(true)
    }
  })

  it('marks mutating context-menu items as read-only', () => {
    const readonly = readonlyEntitlement()
    const contextItems = buildLabelShopMenus(menuDeps({
      entitlement: readonly,
      contextMenu: { visible: true, x: 0, y: 0, hasSelection: true, selectionCount: 1 }
    })).contextItems
    expect(contextItems.find((entry) => entry.label === '属性')).toMatchObject({ disabled: true, locked: 'readonly' })
    expect(contextItems.find((entry) => entry.label === '删除')).toMatchObject({ disabled: true, locked: 'readonly' })
  })
})
