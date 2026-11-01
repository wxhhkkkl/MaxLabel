import { describe, expect, it } from 'vitest'
import iconv from 'iconv-lite'
import { decodeTemplateContent } from '@main/ipc/lsdxEncoding'

describe('lsdx 字体名编码修复', () => {
  it('把 UTF-8 XML 里的 GBK 字体名转回中文，其他 UTF-8 内容不变', () => {
    const data = Buffer.concat([
      Buffer.from('<?xml version="1.0" encoding="utf-8"?><font facename="', 'utf8'),
      iconv.encode('微软雅黑', 'gb18030'),
      Buffer.from('" height="1000"/><paper name="未命名"/>', 'utf8')
    ])
    const text = decodeTemplateContent(data, 'x.lsdx')
    expect(text).toContain('facename="微软雅黑"')
    expect(text).toContain('name="未命名"')
  })

  it('本来就是合法 UTF-8 的字体名保持原样', () => {
    const data = Buffer.from('<font facename="宋体"/><font facename="Arial"/>', 'utf8')
    const text = decodeTemplateContent(data, 'x.lsdx')
    expect(text).toContain('facename="宋体"')
    expect(text).toContain('facename="Arial"')
  })

  it('非 .lsdx 文件不做字体名修复', () => {
    const data = Buffer.from('<font facename="x"/>', 'utf8')
    expect(decodeTemplateContent(data, 'x.msdx')).toContain('facename="x"')
  })
})
