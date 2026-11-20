import { appendFile, mkdir, open, rename, rm, stat, writeFile } from 'fs/promises'
import { randomUUID } from 'crypto'
import { dirname } from 'path'
import { PRINT_LOG_CSV_HEADERS } from '../../shared/print/logSchema'

export const MAX_PRINT_LOG_BYTES = 64 * 1024 * 1024
export const MAX_PRINT_LOG_ROWS = 10000

/** Parse JSONL text, skipping blank/corrupt lines and keeping the newest `limit` rows. */
export function parseLogs(raw: string, limit = MAX_PRINT_LOG_ROWS): Array<Record<string, unknown>> {
  const rows = raw.split(/\r?\n/).filter((line) => line.trim()).flatMap((line) => {
    try { return [JSON.parse(line) as Record<string, unknown>] } catch { return [] }
  })
  return limit === Number.MAX_SAFE_INTEGER ? rows : rows.slice(-limit)
}

export async function readLogText(path: string, maxBytes = MAX_PRINT_LOG_BYTES): Promise<string> {
  let file
  try {
    file = await open(path, 'r')
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return ''
    throw error
  }
  try {
    const { size } = await file.stat()
    const start = Math.max(0, size - maxBytes)
    // Read one extra byte to know whether the tail starts at a record boundary.
    const offset = Math.max(0, start - 1)
    const buffer = Buffer.alloc(size - offset)
    let read = 0
    while (read < buffer.length) {
      const { bytesRead } = await file.read(buffer, read, buffer.length - read, offset + read)
      if (bytesRead === 0) break
      read += bytesRead
    }
    if (start === 0) return buffer.toString('utf8', 0, read)
    const newline = buffer.subarray(0, read).indexOf(0x0a)
    return newline < 0 ? '' : buffer.toString('utf8', newline + 1, read)
  } finally {
    await file.close()
  }
}

export async function readLogs(path: string, limit = MAX_PRINT_LOG_ROWS): Promise<Array<Record<string, unknown>>> {
  return parseLogs(await readLogText(path), limit)
}

async function atomicWrite(path: string, content: string): Promise<void> {
  await mkdir(dirname(path), { recursive: true })
  const temporary = `${path}.${randomUUID()}.tmp`
  try {
    await writeFile(temporary, content, 'utf-8')
    await rename(temporary, path)
  } finally {
    await rm(temporary, { force: true }).catch(() => undefined)
  }
}

export async function rewriteLogs(path: string, rows: Array<Record<string, unknown>>): Promise<void> {
  await atomicWrite(path, rows.map((row) => JSON.stringify(row)).join('\n') + (rows.length ? '\n' : ''))
}

export async function appendPrintLog(
  path: string,
  line: string,
  options: { maxBytes?: number; maxRows?: number } = {}
): Promise<void> {
  const maxBytes = options.maxBytes ?? MAX_PRINT_LOG_BYTES
  const maxRows = options.maxRows ?? MAX_PRINT_LOG_ROWS
  const lineBytes = Buffer.byteLength(line, 'utf-8')
  if (lineBytes > maxBytes) throw new Error('单条打印记录超过历史文件容量限制')
  let size = 0
  try { size = (await stat(path)).size } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error
  }
  if (size + lineBytes > maxBytes) {
    const rows = parseLogs(await readLogText(path, maxBytes), Number.MAX_SAFE_INTEGER)
    const retained: string[] = []
    let bytes = lineBytes
    for (let index = rows.length - 1; index >= 0 && retained.length < maxRows - 1; index--) {
      const record = JSON.stringify(rows[index]) + '\n'
      bytes += Buffer.byteLength(record, 'utf-8')
      if (bytes > maxBytes) break
      retained.push(record)
    }
    await atomicWrite(path, retained.reverse().join('') + line)
    return
  }
  await appendFile(path, line, 'utf-8')
}

export async function deleteLogRows(path: string, time: string): Promise<void> {
  const rows = parseLogs(await readLogText(path), Number.MAX_SAFE_INTEGER).filter((row) => row.time !== time)
  await rewriteLogs(path, rows)
}

export async function clearLogFile(path: string): Promise<void> {
  await atomicWrite(path, '')
}

export async function ensureLogFile(path: string): Promise<void> {
  try {
    await stat(path)
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error
    await atomicWrite(path, '')
  }
}

export function escapeCsv(value: unknown): string {
  const text = String(value ?? '')
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
}

/** CSV with UTF-8 BOM and CRLF; the header order comes from the shared schema. */
export function logsToCsv(rows: Array<Record<string, unknown>>): string {
  const lines = rows.map((row) => [
    row.time,
    row.title,
    row.mode,
    row.count,
    row.copies,
    row.physicalCount ?? Number(row.count ?? 0) * Number(row.copies ?? 0),
    row.sentCount ?? '',
    row.status ?? 'completed',
    row.test ? '是' : '否',
    row.printer
  ].map(escapeCsv).join(','))
  return '﻿' + [PRINT_LOG_CSV_HEADERS.join(','), ...lines].join('\r\n')
}
