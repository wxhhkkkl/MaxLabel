import { describe, expect, it } from 'vitest'
import { resolveObjectText, sanitizeSharedName, isValidSharedName } from '@shared/domain/datasource'
import { propagateSharedSources } from '@shared/domain/sharedSources'
import type { DataCtx, DataSource } from '@shared/domain/datasource'
import type { GroupObj } from '@shared/domain/objects'
import { colorCtx, textObject } from '../../../helpers/color'

const ctx = (over: Partial<DataCtx> = {}): DataCtx => ({ ...colorCtx(), ...over }) as DataCtx

describe('共享变量名', () => {
  it('只保留英文和数字，并去掉开头的数字/符号', () => {
    expect(sanitizeSharedName('haha-1')).toBe('haha1')
    expect(sanitizeSharedName('批次A1')).toBe('A1')
    expect(sanitizeSharedName('12abc')).toBe('abc')
    expect(sanitizeSharedName('A_1')).toBe('A1')
  })

  it('校验规则：英文开头、仅英文数字', () => {
    expect(isValidSharedName('Batch01')).toBe(true)
    expect(isValidSharedName('1Batch')).toBe(false)
    expect(isValidSharedName('Batch-1')).toBe(false)
    expect(isValidSharedName('')).toBe(true)
  })
})

describe('共享变量以最后保存为准', () => {
  it('同名主数据源同步到其它对象（A 键盘输入 → B 数据库）', () => {
    const saved = textObject({
      id: 'b',
      source: { kind: 'database', dataset: 'ds', field: 'no', sharedName: 'haha' }
    })
    const a = textObject({
      id: 'a',
      source: { kind: 'keyboard', label: '批次', sharedName: 'haha' }
    })
    const other = textObject({ id: 'c', source: { kind: 'constant', value: 'x' } })
    const result = propagateSharedSources([a, saved, other], saved)
    expect(result[0]).not.toBe(a)
    expect((result[0] as typeof a).source).toEqual(saved.source)
    // 保存对象本身由属性对话框提交，helper 不改动它
    expect(result[1]).toBe(saved)
    expect(result[2]).toBe(other)
  })

  it('子串共享名同样同步，且不影响主数据源', () => {
    const saved = textObject({
      id: 'b',
      source: { kind: 'constant', value: 'B' },
      subSources: [{ kind: 'keyboard', label: '单位', sharedName: 'unit' } as DataSource]
    })
    const a = textObject({
      id: 'a',
      source: { kind: 'constant', value: 'A' },
      subSources: [{ kind: 'constant', value: 'kg', sharedName: 'unit' } as DataSource]
    })
    const result = propagateSharedSources([a, saved], saved)
    expect((result[0] as typeof a).source).toEqual(a.source)
    expect((result[0] as typeof a).subSources?.[0]).toEqual(saved.subSources?.[0])
  })

  it('递归进入组合里的对象', () => {
    const saved = textObject({ id: 'saved', source: { kind: 'database', dataset: 'd', field: 'f', sharedName: 'v' } })
    const child = textObject({ id: 'child', source: { kind: 'keyboard', label: 'x', sharedName: 'v' } })
    const group: GroupObj = { id: 'g', type: 'group', x: 0, y: 0, w: 10, h: 10, rotation: 0, children: [child] }
    const result = propagateSharedSources([group], saved)
    expect((result[0] as GroupObj).children[0]).toMatchObject({ source: saved.source })
  })
})

describe('键盘输入在设计画布的提示文字', () => {
  it('编辑器用 placeholder，打印上下文不用', () => {
    const obj = textObject({ source: { kind: 'keyboard', label: '批次', placeholder: '1234567890' } })
    expect(resolveObjectText(obj, ctx({ previewKeyboard: true }))).toBe('1234567890')
    expect(resolveObjectText(obj, ctx())).toBe('')
  })

  it('已有键盘输入值时优先显示输入值', () => {
    const obj = textObject({ source: { kind: 'keyboard', label: '批次', placeholder: '提示' } })
    expect(resolveObjectText(obj, ctx({ previewKeyboard: true, keyboardValues: { 批次: 'ABC' } }))).toBe('ABC')
  })
})
