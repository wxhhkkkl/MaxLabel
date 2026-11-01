import { describe, expect, it } from 'vitest'
import { copyFieldOptions } from '@/dialogs/printCopyField'

describe('拷贝数量字段下拉', () => {
  it('列出当前数据集字段并去掉空值/重复', () => {
    expect(copyFieldOptions(['qty', ' qty ', '', 'price'], '')).toEqual(['qty', 'price'])
  })

  it('模板里已保存但当前数据集没有的字段也保留，避免下拉空白', () => {
    expect(copyFieldOptions(['qty'], 'old_qty')).toEqual(['old_qty', 'qty'])
  })

  it('没有字段时返回空列表', () => {
    expect(copyFieldOptions([], '')).toEqual([])
  })
})
