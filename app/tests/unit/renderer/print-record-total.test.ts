import { describe, expect, it } from 'vitest'
import { printRecordTotal } from '@/dialogs/printRecordTotal'

describe('打印范围总记录数', () => {
  it('没有接入数据集时不显示', () => {
    expect(printRecordTotal(undefined, 28)).toBeUndefined()
    expect(printRecordTotal({}, 28)).toBeUndefined()
  })

  it('接入数据集时取数据表的总记录数', () => {
    expect(printRecordTotal({ 数据表1: { columns: [], rows: [] } }, 28)).toBe(28)
  })

  it('数据集已接入但没有记录时显示 0', () => {
    expect(printRecordTotal({ 数据表1: { columns: [], rows: [] } }, 0)).toBe(0)
  })

  it('异常负数按 0 处理', () => {
    expect(printRecordTotal({ 数据表1: {} }, -3)).toBe(0)
  })
})
