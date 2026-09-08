// ---------- 数据集导入：CSV / Excel ----------
import * as XLSX from 'xlsx'
import type { Dataset } from '../types'

/** 手写 CSV 解析（支持引号转义、逗号/制表符分隔） */
export function parseCSV(text: string, delimiter = ','): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let cur = ''
  let inQ = false
  for (let i = 0; i < text.length; i++) {
    const c = text[i]
    if (inQ) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          cur += '"'
          i++
        } else inQ = false
      } else cur += c
    } else if (c === '"') {
      inQ = true
    } else if (c === delimiter) {
      row.push(cur)
      cur = ''
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++
      row.push(cur)
      cur = ''
      if (row.some((x) => x !== '')) rows.push(row)
      row = []
    } else {
      cur += c
    }
  }
  if (cur !== '' || row.length) {
    row.push(cur)
    if (row.some((x) => x !== '')) rows.push(row)
  }
  return rows
}

/** 将上传文件转为数据集（首行为列名） */
export async function fileToDataset(file: File): Promise<Dataset> {
  const name = file.name.replace(/\.(csv|xlsx|xls)$/i, '')
  if (/\.(xlsx|xls)$/i.test(file.name)) {
    const wb = XLSX.read(await file.arrayBuffer(), { type: 'array' })
    const ws = wb.Sheets[wb.SheetNames[0]]
    const aoa = XLSX.utils.sheet_to_json(ws, { header: 1, raw: false, defval: '' }) as string[][]
    const cols = (aoa[0] ?? []).map(String)
    return { name, columns: cols, rows: aoa.slice(1).map((r) => cols.map((_, i) => String(r[i] ?? ''))) }
  }
  const rows = parseCSV(await file.text())
  const cols = (rows[0] ?? []).map(String)
  return { name, columns: cols, rows: rows.slice(1).map((r) => cols.map((_, i) => String(r[i] ?? ''))) }
}
