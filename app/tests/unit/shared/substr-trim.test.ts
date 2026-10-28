import { describe, expect, it } from 'vitest'
import { applyObjectFormat, type Substr } from '@shared/domain/datasource'

const base: Substr = { start: 0, length: 0 }

/**
 * 015：原版「截短字符串」的五项是互相独立的复选框，可以同时勾选。
 * 之前的模型只有一个 cutType，只能单选用一种。
 */
describe('截短字符串（多项同时生效）', () => {
  it('去左右空格与丢弃左右可以叠加', () => {
    const s: Substr = { ...base, trimLeft: true, trimRight: true, dropLeft: 1, dropRight: 2 }
    expect(applyObjectFormat('  ABCDEFG  ', 'none', s)).toBe('BCDE')
  })

  it('保留左侧 N 个字符', () => {
    expect(applyObjectFormat('ABCDEFG', 'none', { ...base, keepSide: 'left', keepCount: 3 })).toBe('ABC')
  })

  it('保留右侧 N 个字符', () => {
    expect(applyObjectFormat('ABCDEFG', 'none', { ...base, keepSide: 'right', keepCount: 3 })).toBe('EFG')
  })

  it('丢弃与保留同时勾选时先丢弃再保留', () => {
    const s: Substr = { ...base, dropLeft: 1, keepCount: 3 }
    expect(applyObjectFormat('ABCDEFG', 'none', s)).toBe('BCD')
  })

  it('没勾任何一项时原样返回', () => {
    expect(applyObjectFormat('ABC', 'none', base)).toBe('ABC')
  })

  it('老模板的 cutType 仍然生效', () => {
    expect(applyObjectFormat('ABCDEFG', 'none', { ...base, cutType: 'dropLeft', cutCount: 2 })).toBe('CDEFG')
  })
})

describe('字符验证', () => {
  it('许可字符=数字时删掉非数字', () => {
    expect(applyObjectFormat('A1B2C3', 'none', { ...base, allowChars: 'digits' })).toBe('123')
  })

  it('非法字符选「保留」时不做处理', () => {
    expect(applyObjectFormat('A1B2', 'none', { ...base, allowChars: 'digits', invalidChars: 'keep' })).toBe('A1B2')
  })

  it('自定义许可字符集', () => {
    expect(applyObjectFormat('A1-B2', 'none', { ...base, allowChars: 'custom', allowCharSet: 'AB' })).toBe('AB')
  })

  it('许可字符=全部字符时不处理', () => {
    expect(applyObjectFormat('A1-*', 'none', { ...base, allowChars: 'all' })).toBe('A1-*')
  })
})
