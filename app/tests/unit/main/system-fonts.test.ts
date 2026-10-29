import { describe, expect, it } from 'vitest'
import { parseFontFamilies } from '@main/systemFonts'

describe('系统字体枚举输出解析', () => {
  it('按行拆分、去掉空白行和首尾空格', () => {
    expect(parseFontFamilies('Arial\r\n  宋体  \n\r\nTahoma\n')).toEqual(['Arial', '宋体', 'Tahoma'])
  })

  it('保留中文字族名', () => {
    expect(parseFontFamilies('微软雅黑\n仿宋\n')).toEqual(['微软雅黑', '仿宋'])
  })

  it('空输出得到空数组', () => {
    expect(parseFontFamilies('')).toEqual([])
    expect(parseFontFamilies(' \r\n ')).toEqual([])
  })
})
