import iconv from 'iconv-lite'
import { describe, expect, it } from 'vitest'
import { decodeDelimitedText, detectDelimiter, parseCSV } from '@/editor/dataImport'

const csv = '商品,数量,批次\r\n甲产品,10,第一批\r\n乙产品,20,第二批'

describe('delimited text import', () => {
  it('detects commas and tabs and parses quoted fields', () => {
    expect(detectDelimiter(csv)).toBe(',')
    expect(parseCSV(csv, ',')).toEqual([
      ['商品', '数量', '批次'],
      ['甲产品', '10', '第一批'],
      ['乙产品', '20', '第二批']
    ])
    expect(detectDelimiter('商品\t数量\n甲产品\t10')).toBe('\t')
    expect(parseCSV('商品,备注\n甲产品,"含,逗号"')).toEqual([
      ['商品', '备注'],
      ['甲产品', '含,逗号']
    ])
  })

  it('decodes UTF-8/UTF-16 BOMs and falls back to GB18030', () => {
    const utf8 = Uint8Array.from([0xef, 0xbb, 0xbf, ...Buffer.from(csv, 'utf8')])
    const utf16le = Uint8Array.from([0xff, 0xfe, ...Buffer.from(csv, 'utf16le')])
    const gb18030 = new Uint8Array(iconv.encode(csv, 'gb18030'))

    for (const bytes of [utf8, utf16le, gb18030]) {
      const decoded = decodeDelimitedText(bytes)
      expect(parseCSV(decoded)[1][0]).toBe('甲产品')
      expect(parseCSV(decoded)[2][2]).toBe('第二批')
    }
  })
})
