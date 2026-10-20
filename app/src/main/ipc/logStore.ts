import { appendFile, mkdir, readFile, rename, rm, stat, writeFile } from 'fs/promises'
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

export function compactRows(rows: Array<Record<string, unknown>>, maxRows = MAX_PRINT_LOG_ROWS - 1): Array<Record<string, unknown>> {
  return rows.slice(-maxRows)
}

export async function readLogText(path: string): Promise<string> {
  try {
    return await readFile(path, 'utf-8')
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return ''
    throw error
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
  let size = 0
  try { size = (await stat(path)).size } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error
  }
  if (size + Buffer.byteLength(line, 'utf-8') > maxBytes) {
    const retained = compactRows(parseLogs(await readLogText(path), Number.MAX_SAFE_INTEGER), maxRows - 1)
    await rewriteLogs(path, retained)
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
