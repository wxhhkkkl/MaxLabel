// ---------- 数据集导入：CSV / Excel ----------
import { MAX_DATASET_CELL_LENGTH, MAX_DATASET_COLUMNS, MAX_DATASET_ROWS, normalizeDataset } from '../../../shared/domain/document'
import type { Dataset } from '../types'

const MAX_IMPORT_BYTES = 64 * 1024 * 1024

/** 手写 CSV 解析（支持引号转义、逗号/制表符分隔） */
export function parseCSV(text: string, delimiter = ','): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let cur = ''
  let inQ = false
  const assertCell = (value: string) => {
    if (value.length > MAX_DATASET_CELL_LENGTH) throw new Error(`CSV 单元格超过 ${MAX_DATASET_CELL_LENGTH} 个字符限制`)
  }
  const pushCell = () => {
    assertCell(cur)
    row.push(cur)
    cur = ''
    if (row.length > MAX_DATASET_COLUMNS) throw new Error(`CSV 字段数量超过 ${MAX_DATASET_COLUMNS} 列限制`)
  }
  const pushRow = () => {
    if (row.some((x) => x !== '')) {
      rows.push(row)
      if (rows.length > MAX_DATASET_ROWS + 1) throw new Error(`CSV 数据行数超过 ${MAX_DATASET_ROWS} 行限制`)
    }
    row = []
  }
  for (let i = 0; i < text.length; i++) {
    const c = text[i]
    if (inQ) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          cur += '"'
          i++
        } else inQ = false
      } else {
        cur += c
        assertCell(cur)
      }
    } else if (c === '"') {
      inQ = true
    } else if (c === delimiter) {
      pushCell()
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++
      pushCell()
      pushRow()
    } else {
      cur += c
      assertCell(cur)
    }
  }
  if (inQ) throw new Error('CSV 文件包含未闭合的引号')
  if (cur !== '' || row.length) {
    pushCell()
    pushRow()
  }
  return rows
}

/** Detect the separator used by a delimited text file without counting
 * separators inside quoted values.  Comma remains the default for ambiguous
 * one-column files, while TSV and semicolon exports are handled naturally. */
export function detectDelimiter(text: string): ',' | '\t' | ';' {
  const candidates: Array<',' | '\t' | ';'> = [',', '\t', ';']
  const sample = text.split(/\r?\n/).filter((line) => line.trim()).slice(0, 12)
  let best: ',' | '\t' | ';' = ','
  let bestScore = 0
  for (const delimiter of candidates) {
    let score = 0
    for (const line of sample) {
      let quoted = false
      for (let i = 0; i < line.length; i++) {
        const char = line[i]
        if (char === '"') {
          if (quoted && line[i + 1] === '"') i++
          else quoted = !quoted
        } else if (!quoted && char === delimiter) {
          score++
        }
      }
    }
    if (score > bestScore) {
      best = delimiter
      bestScore = score
    }
  }
  return best
}

/**
 * Decode a delimited text file using LabelShop's encoding precedence:
 * UTF-8/UTF-16 BOMs are authoritative; legacy files without a BOM use the
 * Simplified-Chinese system code page (GB18030).  TextDecoder is available in
 * Chromium and avoids routing file contents through a lossy DOM string first.
 */
export function decodeDelimitedText(input: ArrayBuffer | Uint8Array): string {
  const bytes = input instanceof Uint8Array ? input : new Uint8Array(input)
  let encoding: 'utf-8' | 'utf-16le' | 'utf-16be' | 'gb18030' = 'gb18030'
  let start = 0
  if (bytes.length >= 3 && bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf) {
    encoding = 'utf-8'
    start = 3
  } else if (bytes.length >= 2 && bytes[0] === 0xff && bytes[1] === 0xfe) {
    encoding = 'utf-16le'
    start = 2
  } else if (bytes.length >= 2 && bytes[0] === 0xfe && bytes[1] === 0xff) {
    encoding = 'utf-16be'
    start = 2
  }
  try {
    return new TextDecoder(encoding).decode(bytes.subarray(start)).replace(/^\uFEFF/, '')
  } catch {
    // Older embedded Chromium builds may not expose GB18030.  UTF-8 is a
    // safer fallback than throwing away the import; current builds take the
    // GB18030 branch above.
    return new TextDecoder('utf-8').decode(bytes.subarray(start)).replace(/^\uFEFF/, '')
  }
}

export interface FileImportOptions {
  /** 文本分隔符；未指定时沿用自动探测。 */
  delimiter?: ',' | '\t' | ';'
  /** 首行是否作为字段名；LabelShop 导入向导默认开启。 */
  hasHeader?: boolean
  /** Excel 工作表名称；未指定时使用第一张表。 */
  sheetName?: string
}

/** 将上传文件转为数据集（首行为列名）。 */
export async function fileToDataset(file: File, options: FileImportOptions = {}): Promise<Dataset> {
  if (file.size > MAX_IMPORT_BYTES) throw new Error('数据文件超过 64 MB 限制')
  const name = file.name.replace(/\.(csv|tsv|tab|xlsx|xls)$/i, '').slice(0, 255) || '导入数据'
  if (/\.(xlsx|xls)$/i.test(file.name)) {
    const XLSX = await import('@e965/xlsx')
    const wb = XLSX.read(await file.arrayBuffer(), { type: 'array', sheetRows: MAX_DATASET_ROWS + 1, cellText: true })
    if (!wb.SheetNames.length) throw new Error('Excel 文件没有可读取的工作表')
    const sheetName = options.sheetName && wb.SheetNames.includes(options.sheetName) ? options.sheetName : wb.SheetNames[0]
    const ws = wb.Sheets[sheetName]
    const aoa = XLSX.utils.sheet_to_json(ws, { header: 1, raw: false, defval: '', blankrows: false }) as string[][]
    if (aoa.length > MAX_DATASET_ROWS + 1) throw new Error(`Excel 数据行数超过 ${MAX_DATASET_ROWS} 行限制`)
    if ((aoa[0]?.length ?? 0) > MAX_DATASET_COLUMNS) throw new Error(`Excel 字段数量超过 ${MAX_DATASET_COLUMNS} 列限制`)
    if (aoa.some((row) => row.length > MAX_DATASET_COLUMNS || row.some((cell) => String(cell).length > MAX_DATASET_CELL_LENGTH))) throw new Error('Excel 数据规模超过限制')
    const hasHeader = options.hasHeader !== false
    const firstRow = aoa[0] ?? []
    const cols = hasHeader ? firstRow.map(String) : Array.from({ length: firstRow.length }, (_, index) => `列${index + 1}`)
    return normalizeDataset({ name, columns: cols, rows: aoa.slice(hasHeader ? 1 : 0) }, name)
  }
  const text = decodeDelimitedText(await file.arrayBuffer())
  const ext = file.name.toLowerCase().split('.').pop()
  const delimiter = options.delimiter ?? (ext === 'tsv' || ext === 'tab' ? '\t' : detectDelimiter(text))
  const rows = parseCSV(text, delimiter)
  const hasHeader = options.hasHeader !== false
  const firstRow = rows[0] ?? []
  const cols = hasHeader ? firstRow.map(String) : Array.from({ length: firstRow.length }, (_, index) => `列${index + 1}`)
  return normalizeDataset({ name, columns: cols, rows: rows.slice(hasHeader ? 1 : 0) }, name)
}
