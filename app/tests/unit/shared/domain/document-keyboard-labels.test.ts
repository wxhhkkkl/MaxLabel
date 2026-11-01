import { describe, expect, it } from 'vitest'
import { normalizeDocument } from '@shared/domain'
import type { LabelObject } from '@shared/domain/objects'
import { nextKeyboardLabel } from '@shared/domain/datasource'

/**
 * 键盘输入项的身份 = 数据源的 `label`（取值、排序、面板都按名字索引）。
 *
 * 历史上新增键盘输入的默认名都是「请输入数据：」，于是同一模板里多个元素被
 * 合并成**一个**输入框。020 起：新建时给唯一名，打开旧文档时把重名项拆开。
 */

function textWithKeyboard(label: string, extra: Record<string, unknown> = {}): LabelObject {
  return {
    id: `t-${label}-${Math.random().toString(36).slice(2, 7)}`,
    type: 'text',
    x: 0,
    y: 0,
    w: 20,
    h: 5,
    rotation: 0,
    text: 'x',
    source: { kind: 'keyboard', label, ...extra }
  } as unknown as LabelObject
}

function docWith(objects: LabelObject[]) {
  return normalizeDocument({ version: 3, name: 't', widthMm: 100, heightMm: 100, objects })
}

function labelsOf(doc: ReturnType<typeof docWith>): string[] {
  return doc.objects.map((object) => (object as { source?: { label?: string } }).source?.label ?? '')
}

describe('键盘输入 —— 新建时的默认名', () => {
  it('从 1 开始，跳过已占用的名字', () => {
    expect(nextKeyboardLabel([])).toBe('输入项目1')
    expect(nextKeyboardLabel(['输入项目1'])).toBe('输入项目2')
    expect(nextKeyboardLabel(['输入项目1', '输入项目3'])).toBe('输入项目2')
  })
})

describe('键盘输入 —— 旧文档里的重名项自动拆开', () => {
  it('第一个保留原名，后续重名项加序号', () => {
    const doc = docWith([textWithKeyboard('请输入数据：'), textWithKeyboard('请输入数据：'), textWithKeyboard('请输入数据：')])
    expect(labelsOf(doc)).toEqual(['请输入数据：', '请输入数据： (2)', '请输入数据： (3)'])
  })

  it('名字本来就不同的不动', () => {
    const doc = docWith([textWithKeyboard('批次号'), textWithKeyboard('操作员')])
    expect(labelsOf(doc)).toEqual(['批次号', '操作员'])
  })

  it('重复归一化（幂等）：第二次不再改名', () => {
    const once = docWith([textWithKeyboard('请输入数据：'), textWithKeyboard('请输入数据：')])
    const twice = normalizeDocument(JSON.parse(JSON.stringify(once)))
    expect(labelsOf(twice)).toEqual(labelsOf(once))
  })

  it('电子秤来源不动：多个元素共用一次称重结果是有意的', () => {
    const doc = docWith([textWithKeyboard('重量', { inputDevice: 'weigh' }), textWithKeyboard('重量', { inputDevice: 'weigh' })])
    expect(labelsOf(doc)).toEqual(['重量', '重量'])
  })
})
