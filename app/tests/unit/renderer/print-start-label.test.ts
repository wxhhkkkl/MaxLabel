import { describe, expect, it } from 'vitest'
import { nextStartLabel } from '@/dialogs/printStartLabel'

describe('起始标签选取', () => {
  it('点其他格子就选中它', () => {
    expect(nextStartLabel(1, 4)).toBe(4)
    expect(nextStartLabel(4, 6)).toBe(6)
  })

  it('点已选中的那格＝取消，回到第 1 个标签', () => {
    expect(nextStartLabel(5, 5)).toBe(1)
  })

  it('默认第一格再点一次保持第 1 个标签', () => {
    expect(nextStartLabel(1, 1)).toBe(1)
  })
})
