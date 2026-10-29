import { describe, expect, it } from 'vitest'
import { CONTROL_CHAR_ENTRIES, decodeControlChars } from '@shared/domain/datasource'

/** 「插入字符」对话框的数据源：名称、ASCII 值与十六进制值都要与原版列表一致。 */
describe('控制字符表', () => {
  it('覆盖 ASCII 1~31，顺序与编码一致', () => {
    expect(CONTROL_CHAR_ENTRIES).toHaveLength(31)
    CONTROL_CHAR_ENTRIES.forEach((entry, index) => {
      expect(entry.code).toBe(index + 1)
      expect(entry.label).toBe(`<${entry.name}>`)
    })
  })

  it('表头四列的内容按原版口径给出', () => {
    const cr = CONTROL_CHAR_ENTRIES.find((e) => e.name === 'CR')!
    expect(cr.description).toBe('回车键')
    expect(cr.ascii).toBe('13')
    expect(cr.hex).toBe('0D')
    const soh = CONTROL_CHAR_ENTRIES.find((e) => e.name === 'SOH')!
    expect(soh.description).toBe('标题开始')
    expect(soh.ascii).toBe('01')
    expect(soh.hex).toBe('01')
    const gs = CONTROL_CHAR_ENTRIES.find((e) => e.name === 'GS')!
    expect(gs.hex).toBe('1D')
  })

  it('插入的记号能被解码回控制字符', () => {
    expect(decodeControlChars('A<CR>B')).toBe('A\rB')
    expect(decodeControlChars('<<CR>')).toBe('<CR>')
  })
})
