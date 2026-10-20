import { app, BrowserWindow, dialog, ipcMain as electronIpcMain, shell } from 'electron'
import { join } from 'path'
import { writeFile } from 'fs/promises'
import { validatePrintLogPayload } from './validation'
import { assertKnownIpcChannel, secureIpcHandler } from './senderGuard'
import { reportPrintRecord } from '../printReport'
import { normalizeLanguage, translate } from '../../shared/i18n/translate'
import {
  MAX_PRINT_LOG_ROWS,
  appendPrintLog,
  clearLogFile,
  deleteLogRows,
  ensureLogFile,
  logsToCsv,
  readLogs
} from './logStore'

function printLogPath(): string {
  return join(app.getPath('userData'), 'print-log.jsonl')
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
      await queueLogWrite(() => appendPrintLog(printLogPath(), JSON.stringify({ ...safePayload, app: 'maxlabel' }) + '\n'))
      // 商城上报是旁路：本地日志写成功后才尝试，失败完全吞掉；测试打印/未开启/未配置都跳过。
      const mall = (payload as { mall?: unknown } | null)?.mall
      if (!safePayload.test && mall && typeof mall === 'object') {
        const context = mall as { baseUrl?: unknown; tenantId?: unknown; enabled?: unknown }
        const baseUrl = typeof context.baseUrl === 'string' ? context.baseUrl.trim() : ''
        const tenantId = Number(context.tenantId)
        if (context.enabled === true && baseUrl && Number.isInteger(tenantId) && tenantId > 0) {
          void reportPrintRecord({ baseUrl, tenantId }, safePayload).catch(() => {})
        }
      }
      return { ok: true, path: printLogPath() }
    } catch (error) {
      return { ok: false, message: String((error as { message?: string }).message ?? error), messageKey: 'error.log' }
    }
  })
  ipcMain.handle('log:list', async () => {
    try {
      await waitLogWrites()
      return { ok: true, logs: await readLogs(printLogPath(), MAX_PRINT_LOG_ROWS) }
    } catch (error) {
      return { ok: false, message: String((error as { message?: string }).message ?? error), messageKey: 'error.log' }
    }
  })
  ipcMain.handle('log:export', async (_event, language?: unknown) => {
    const lang = normalizeLanguage(language)
    try {
      await waitLogWrites()
      const path = printLogPath()
      const rows = await readLogs(path, Number.MAX_SAFE_INTEGER)
      if (!rows.length) return { ok: false, message: '暂无打印记录', messageKey: 'history.empty' }
      const options = {
        title: translate(lang, 'dialog.exportLog.title'),
        defaultPath: join(app.getPath('documents'), `打印历史-${new Date().toISOString().slice(0, 10)}.csv`),
        filters: [{ name: 'CSV', extensions: ['csv'] }]
      }
      const owner = getMainWindow()
      const result = owner ? await dialog.showSaveDialog(owner, options) : await dialog.showSaveDialog(options)
      if (result.canceled || !result.filePath) return { ok: false, message: translate(lang, 'status.exportCanceled') }
      await writeFile(result.filePath, logsToCsv(rows), 'utf-8')
      return { ok: true, path: result.filePath }
    } catch (error) {
      return { ok: false, message: String((error as { message?: string }).message ?? error), messageKey: 'error.log' }
    }
  })
  ipcMain.handle('log:delete', async (_event, time: string) => {
    try {
      await queueLogWrite(() => deleteLogRows(printLogPath(), time))
      return { ok: true }
    } catch (error) {
      return { ok: false, message: String((error as { message?: string }).message ?? error), messageKey: 'error.log' }
    }
  })
  ipcMain.handle('log:clear', async () => {
    try {
      await queueLogWrite(() => clearLogFile(printLogPath()))
      return { ok: true }
    } catch (error) {
      return { ok: false, message: String((error as { message?: string }).message ?? error), messageKey: 'error.log' }
    }
  })
  ipcMain.handle('log:open', async () => {
    try {
      await waitLogWrites()
      const path = printLogPath()
      await ensureLogFile(path)
      const message = await shell.openPath(path)
      return { ok: !message, message: message || undefined, path }
    } catch (error) {
      return { ok: false, message: String((error as { message?: string }).message ?? error), messageKey: 'error.log' }
    }
  })
}
