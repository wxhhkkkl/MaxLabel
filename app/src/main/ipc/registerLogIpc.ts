import { app, BrowserWindow, dialog, ipcMain as electronIpcMain, shell } from 'electron'
import { existsSync } from 'fs'
import { appendFile, rename, rm, stat, writeFile } from 'fs/promises'
import { randomUUID } from 'crypto'
import { join } from 'path'
import { validatePrintLogPayload } from './validation'
import { readBoundedFile } from './validation'
import { assertKnownIpcChannel, secureIpcHandler } from './senderGuard'

const MAX_PRINT_LOG_BYTES = 64 * 1024 * 1024
const MAX_PRINT_LOG_ROWS = 10000

function printLogPath(): string {
  return join(app.getPath('userData'), 'print-log.jsonl')
}

async function readPrintLog(): Promise<string> {
  return (await readBoundedFile(printLogPath(), MAX_PRINT_LOG_BYTES)).toString('utf-8')
}

async function atomicWriteText(filePath: string, content: string): Promise<void> {
  const temporary = `${filePath}.${randomUUID()}.tmp`
  try {
    await writeFile(temporary, content, 'utf-8')
    await rename(temporary, filePath)
  } finally {
    await rm(temporary, { force: true }).catch(() => {})
  }
}

function parseLogs(raw: string, limit = MAX_PRINT_LOG_ROWS): Array<Record<string, unknown>> {
  const rows = raw.split(/\r?\n/).filter((line) => line.trim()).flatMap((line) => {
    try { return [JSON.parse(line) as Record<string, unknown>] } catch { return [] }
  })
  return rows.slice(-limit)
}

async function appendPrintLog(line: string): Promise<void> {
  const path = printLogPath()
  let size = 0
  try { size = (await stat(path)).size } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error
  }
  if (size + Buffer.byteLength(line, 'utf-8') > MAX_PRINT_LOG_BYTES) {
    // Keep the most recent records while preventing an unbounded JSONL file
    // from making the history UI or the main process consume all memory.
    const retained = size > 0 && size <= MAX_PRINT_LOG_BYTES
      ? parseLogs(await readPrintLog(), MAX_PRINT_LOG_ROWS - 1)
      : []
    await atomicWriteText(path, retained.map((row) => JSON.stringify(row)).join('\n') + (retained.length ? '\n' : ''))
  }
  await appendFile(path, line, 'utf-8')
}

export function registerLogIpc(getMainWindow: () => BrowserWindow | null): void {
  const secureHandle = (channel: string, handler: Parameters<typeof electronIpcMain.handle>[1]) => { assertKnownIpcChannel(channel); return electronIpcMain.handle(channel, secureIpcHandler(getMainWindow, handler as never) as never) }
  const ipcMain = { handle: secureHandle }
  let logQueue: Promise<void> = Promise.resolve()
  const waitLogWrites = () => logQueue.catch(() => {})
  const queueLogWrite = async (task: () => Promise<void>): Promise<void> => {
    const run = logQueue.catch(() => {}).then(task)
    logQueue = run.then(() => undefined, () => undefined)
    await run
  }

  ipcMain.handle('log:print', async (_event, payload: unknown) => {
    try {
      const safePayload = validatePrintLogPayload(payload)
      await queueLogWrite(() => appendPrintLog(JSON.stringify({ ...safePayload, app: 'maxlabel' }) + '\n'))
      return { ok: true, path: printLogPath() }
    } catch (error) {
      return { ok: false, message: String((error as { message?: string }).message ?? error) }
    }
  })
  ipcMain.handle('log:list', async () => {
    try {
      await waitLogWrites()
      if (!existsSync(printLogPath())) return { ok: true, logs: [] }
      return { ok: true, logs: parseLogs(await readPrintLog()) }
    } catch (error) {
      return { ok: false, message: String((error as { message?: string }).message ?? error) }
    }
  })
  ipcMain.handle('log:export', async () => {
    try {
      await waitLogWrites()
      if (!existsSync(printLogPath())) return { ok: false, message: '暂无打印记录' }
      const rows = parseLogs(await readPrintLog(), Number.MAX_SAFE_INTEGER)
      const escapeCsv = (value: unknown) => {
        const text = String(value ?? '')
        return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
      }
      const head = ['时间', '模板', '打印方式', '数量', '单签拷贝', '计划标签张数', '已发送标签张数', '状态', '测试打印', '打印机']
      const lines = rows.map((row) => [row.time, row.title, row.mode, row.count, row.copies, row.physicalCount ?? Number(row.count ?? 0) * Number(row.copies ?? 0), row.sentCount ?? '', row.status ?? 'completed', row.test ? '是' : '否', row.printer].map(escapeCsv).join(','))
      const options = {
        title: '导出打印历史',
        defaultPath: join(app.getPath('documents'), `打印历史-${new Date().toISOString().slice(0, 10)}.csv`),
        filters: [{ name: 'CSV', extensions: ['csv'] }]
      }
      const owner = getMainWindow()
      const result = owner ? await dialog.showSaveDialog(owner, options) : await dialog.showSaveDialog(options)
      if (result.canceled || !result.filePath) return { ok: false, message: '已取消导出' }
      await writeFile(result.filePath, '\ufeff' + [head.join(','), ...lines].join('\r\n'), 'utf-8')
      return { ok: true, path: result.filePath }
    } catch (error) {
      return { ok: false, message: String((error as { message?: string }).message ?? error) }
    }
  })
  ipcMain.handle('log:delete', async (_event, time: string) => {
    try {
      await queueLogWrite(async () => {
        if (!existsSync(printLogPath())) return
        const rows = parseLogs(await readPrintLog(), Number.MAX_SAFE_INTEGER).filter((row) => row.time !== time)
        await atomicWriteText(printLogPath(), rows.map((row) => JSON.stringify(row)).join('\n') + (rows.length ? '\n' : ''))
      })
      return { ok: true }
    } catch (error) {
      return { ok: false, message: String((error as { message?: string }).message ?? error) }
    }
  })
  ipcMain.handle('log:clear', async () => {
    try {
      await queueLogWrite(async () => {
        if (existsSync(printLogPath())) await atomicWriteText(printLogPath(), '')
      })
      return { ok: true }
    } catch (error) {
      return { ok: false, message: String((error as { message?: string }).message ?? error) }
    }
  })
  ipcMain.handle('log:open', async () => {
    try {
      await waitLogWrites()
      if (!existsSync(printLogPath())) await writeFile(printLogPath(), '', 'utf-8')
      const message = await shell.openPath(printLogPath())
      return { ok: !message, message: message || undefined, path: printLogPath() }
    } catch (error) {
      return { ok: false, message: String((error as { message?: string }).message ?? error) }
    }
  })
}
