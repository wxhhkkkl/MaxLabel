import { describe, expect, it } from 'vitest'
import { decodeDelimitedText, fileToDataset } from '@/editor/dataImport'
import { MAX_DATASET_ROWS } from '@shared/domain/document'
import * as XLSX from '@e965/xlsx'

const utf8 = (text: string) => new TextEncoder().encode(text)

/**
 * 015：没有 BOM 的 UTF-8 CSV 之前会被当成 GBK 解出乱码（「字段 1」→「瀛楁 1」）。
 * 现在先按严格 UTF-8 试，失败才回落到 GB18030。
 */
describe('文本导入编码', () => {
  it('无 BOM 的 UTF-8 按 UTF-8 解码', () => {
    expect(decodeDelimitedText(utf8('字段 1,字段 2\n1,甲\n'))).toContain('字段 1')
  })

  it('带 BOM 的 UTF-8 去掉 BOM', () => {
    const withBom = new Uint8Array([0xef, 0xbb, 0xbf, ...utf8('字段 1')])
    expect(decodeDelimitedText(withBom)).toBe('字段 1')
  })

  it('按大端顺序解码 UTF-16BE BOM', () => {
    expect(decodeDelimitedText(new Uint8Array([0xfe, 0xff, 0x4e, 0x2d, 0x00, 0x2c, 0x00, 0x41]))).toBe('中,A')
  })

  it('GBK 字节回落到 GB18030 解码', () => {
    // 「中文」的 GBK 编码
    const gbk = new Uint8Array([0xd6, 0xd0, 0xce, 0xc4])
    expect(decodeDelimitedText(gbk)).toBe('中文')
  })

  it('显式指定编码时按指定编码解', () => {
    const gbk = new Uint8Array([0xd6, 0xd0, 0xce, 0xc4])
    expect(decodeDelimitedText(gbk, 'gb18030')).toBe('中文')
    expect(decodeDelimitedText(utf8('中文'), 'utf-8')).toBe('中文')
  })
})

it.each([true, false])('retains columns found only in later CSV records (header=%s)', async (hasHeader) => {
  const file = new File(['名称\n苹果,12,箱\n梨,8'], 'items.csv')
  const dataset = await fileToDataset(file, { delimiter: ',', hasHeader })
  expect(dataset.columns).toHaveLength(3)
  expect(dataset.rows).toEqual([
    ...(hasHeader ? [] : [['名称', '', '']]),
    ['苹果', '12', '箱'],
    ['梨', '8', '']
  ])
})

it('detects semicolon CSV by consistent columns despite commas and multiline fields', async () => {
  const file = new File(['Name;Description\r\nMatch;red,blue,green,black,white\r\nPart;"small,medium,large\r\nwith a handle"\r\n'], 'items.csv')
  const dataset = await fileToDataset(file)
  expect(dataset.columns).toEqual(['Name', 'Description'])
  expect(dataset.rows).toEqual([
    ['Match', 'red,blue,green,black,white'],
    ['Part', 'small,medium,large\r\nwith a handle']
  ])
})

it('rejects a workbook whose used range would be truncated', async () => {
  const wb = XLSX.utils.book_new()
  const sheet = XLSX.utils.aoa_to_sheet([['name'], ['first']])
  XLSX.utils.sheet_add_aoa(sheet, [['last']], { origin: { r: MAX_DATASET_ROWS + 2, c: 0 } })
  XLSX.utils.book_append_sheet(wb, sheet, 'Sheet1')
  const file = new File([XLSX.write(wb, { type: 'array', bookType: 'xlsx' })], 'large.xlsx')
  await expect(fileToDataset(file)).rejects.toThrow('行限制')
})
