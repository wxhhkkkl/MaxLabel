import { describe, expect, it } from 'vitest'
import { decodeDelimitedText } from '@/editor/dataImport'

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
