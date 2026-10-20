import { existsSync, mkdtempSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

export interface LogPayloadInput {
  time: string
  title: string
  mode: 'driver' | 'command'
  count: number
  copies: number
  physicalCount?: number
  status?: 'completed' | 'submitted' | 'partial' | 'failed' | 'canceled' | 'unknown'
  sentCount?: number
  test: boolean
  printer: string
  dataSnapshot?: string[]
}

export function logPayload(overrides: Partial<LogPayloadInput> = {}): LogPayloadInput {
  return {
    time: '2026-10-20T10:00:00.000Z',
    title: '测试模板',
    mode: 'driver',
    count: 3,
    copies: 2,
    physicalCount: 6,
    sentCount: 6,
    status: 'submitted',
    test: false,
    printer: 'Test Printer',
    ...overrides
  }
}

export function tempLogDir(prefix = 'maxlabel-log-'): string {
  return mkdtempSync(join(tmpdir(), prefix))
}

export function jsonl(rows: Array<Record<string, unknown>>): string {
  return rows.map((row) => JSON.stringify(row)).join('\n') + (rows.length ? '\n' : '')
}

export function readLog(path: string): string {
  return existsSync(path) ? readFileSync(path, 'utf8') : ''
}

export function logPath(dir: string): string {
  return join(dir, 'print-log.jsonl')
}
