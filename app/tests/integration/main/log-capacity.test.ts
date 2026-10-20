import { existsSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { afterEach, describe, expect, it } from 'vitest'
import {
  appendPrintLog,
  clearLogFile,
  deleteLogRows,
  ensureLogFile,
  readLogs,
  rewriteLogs
} from '@main/ipc/logStore'
import { jsonl, logPayload, logPath, readLog, tempLogDir } from '../../helpers/logs'

const dirs: string[] = []
function newDir(): string {
  const dir = tempLogDir()
  dirs.push(dir)
  return dir
}

afterEach(() => {
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true })
})

describe('log store capacity and corruption', () => {
  it('returns no rows for a missing file', async () => {
    await expect(readLogs(logPath(newDir()))).resolves.toEqual([])
  })

  it('compacts to the configured row budget instead of growing without bound', async () => {
    const dir = newDir()
    const path = logPath(dir)
    for (let index = 0; index < 8; index += 1) {
      await appendPrintLog(path, JSON.stringify({ ...logPayload({ time: `t${index}`, title: `row-${index}` }), app: 'maxlabel' }) + '\n', { maxBytes: 260, maxRows: 3 })
    }
    const rows = await readLogs(path, 100)
    expect(rows.length).toBeLessThanOrEqual(3)
    expect(rows.at(-1)).toMatchObject({ title: 'row-7' })
    expect(readdirSync(dir)).toEqual(['print-log.jsonl'])
  })

  it('skips corrupt and truncated lines', async () => {
    const dir = newDir()
    const path = logPath(dir)
    writeFileSync(path, '{broken\n' + jsonl([{ ...logPayload({ title: '有效' }), app: 'maxlabel' }]) + '{"truncated":', 'utf8')
    const rows = await readLogs(path)
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({ title: '有效' })
  })

  it('rewrites atomically without leaving temporary files', async () => {
    const dir = newDir()
    const path = logPath(dir)
    await rewriteLogs(path, [{ ...logPayload(), app: 'maxlabel' }])
    expect(readdirSync(dir)).toEqual(['print-log.jsonl'])
    expect(readFileSync(path, 'utf8')).toContain('app')
  })

  it('creates, clears and deletes at the file level', async () => {
    const dir = newDir()
    const path = logPath(dir)
    await ensureLogFile(path)
    expect(existsSync(path)).toBe(true)

    await rewriteLogs(path, [
      { ...logPayload({ time: 't1' }), app: 'maxlabel' },
      { ...logPayload({ time: 't2' }), app: 'maxlabel' }
    ])
    await deleteLogRows(path, 't1')
    expect((await readLogs(path)).map((row) => row.time)).toEqual(['t2'])

    await clearLogFile(path)
    expect(readLog(path)).toBe('')
  })
})
