import iconv from 'iconv-lite'

/**
 * 原版导出的 .lsdx 有个历史问题：`facename="微软雅黑"` 这类字体名写的是 **GBK 字节**，
 * 而文件其余部分是 UTF-8。直接按 UTF-8 解码会把字体名变成乱码，编辑器只能回退到默认字体。
 * 这里只修复 `facename` 属性：值是合法 UTF-8 就保持，不是就按 GB18030 解码再转回 UTF-8。
 */
export function repairLsdxFontNames(data: Buffer): Buffer {
  const marker = Buffer.from('facename="', 'ascii')
  const quote = Buffer.from('"', 'ascii')[0]
  const parts: Buffer[] = []
  let cursor = 0
  while (cursor < data.length) {
    const start = data.indexOf(marker, cursor)
    if (start < 0) {
      parts.push(data.subarray(cursor))
      break
    }
    const valueStart = start + marker.length
    const end = data.indexOf(quote, valueStart)
    if (end < 0) {
      parts.push(data.subarray(cursor))
      break
    }
    parts.push(data.subarray(cursor, valueStart))
    const raw = data.subarray(valueStart, end)
    let decoded: string
    try {
      decoded = new TextDecoder('utf-8', { fatal: true }).decode(raw)
    } catch {
      decoded = iconv.decode(raw, 'gb18030')
    }
    parts.push(Buffer.from(decoded, 'utf8'))
    cursor = end
  }
  return Buffer.concat(parts)
}

/** 读取模板字节 → 文本；.lsdx 先修复字体名编码，其余文件按 UTF-8 原样解码。 */
export function decodeTemplateContent(data: Buffer, filePath: string): string {
  return (filePath.toLowerCase().endsWith('.lsdx') ? repairLsdxFontNames(data) : data).toString('utf-8')
}
