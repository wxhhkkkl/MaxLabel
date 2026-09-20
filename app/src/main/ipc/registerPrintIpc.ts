import { BrowserWindow, dialog, ipcMain as electronIpcMain, type WebContents } from 'electron'
import { randomUUID } from 'crypto'
import { mkdir, rename, rm, writeFile } from 'fs/promises'
import { join } from 'path'
import { pathToFileURL } from 'url'
import { tmpdir } from 'os'
import iconv from 'iconv-lite'
import type { CommandPayload } from '../../shared/ipcContract'
import { listWindowsComPorts, listWindowsPrinterDevices, listWindowsUsbPrinterPorts, sendCommand } from '../printing/commandTransport'
import { validateCommandPayload, validatePrintJobId, validatePrintPayload } from './validation'
import type { PrintTransportResult } from '../../shared/ipcContract'
import { MAX_PRINT_PHYSICAL_LABELS } from '../../shared/print/plan'
import { assertKnownIpcChannel, secureIpcHandler } from './senderGuard'

function commandBuffer(payload: CommandPayload): Buffer {
  const encode = (value: string) => payload.encoding === 'gbk' ? iconv.encode(value, 'gb18030') : Buffer.from(value, 'utf8')
  return payload.segments
    ? Buffer.concat(payload.segments.map((segment) => segment.type === 'text' ? encode(segment.str) : Buffer.from(segment.data)))
    : encode(payload.text ?? '')
}

function printHtml(pages: Array<{ dataUrl: string; copies: number }>, widthMm: number, heightMm: number): { html: string; copies: number } {
  const physicalPages = pages.reduce((sum, page) => sum + page.copies, 0)
  if (physicalPages > MAX_PRINT_PHYSICAL_LABELS) throw new Error(`驱动打印页数过大（最大 ${MAX_PRINT_PHYSICAL_LABELS} 张）`)
  // Electron's copies option repeats the whole document (A,B,A,B). LabelShop
  // semantics repeat each logical page before moving to the next one (A,A,B,B).
  // Expand here so driver output follows the same order as native protocols.
  const expanded = pages.flatMap((page) => Array.from({ length: page.copies }, () => page))
  const body = expanded.map((page) => `<div class="page"><img src="${page.dataUrl}"></div>`).join('')
  return {
    html: `<!doctype html><html><head><meta charset="utf-8"><style>*{margin:0;padding:0;box-sizing:border-box}@page{size:${widthMm}mm ${heightMm}mm;margin:0}html,body{width:100%;height:100%}.page{width:${widthMm}mm;height:${heightMm}mm;overflow:hidden;page-break-after:always;break-after:page}.page:last-child{page-break-after:auto;break-after:auto}img{display:block;width:${widthMm}mm;height:${heightMm}mm}</style></head><body>${body}</body></html>`,
    copies: 1
  }
}

const activePrintJobs = new Map<string, { controller: AbortController; cancel: () => void }>()

function jobIdOrCreate(raw: unknown): string {
  return raw === undefined ? randomUUID() : validatePrintJobId(raw)
}

function canceledResult(message = '已取消打印'): PrintTransportResult {
  return { ok: false, canceled: true, status: 'canceled', message }
}

async function atomicWriteBuffer(filePath: string, data: Uint8Array): Promise<void> {
  const temporary = `${filePath}.${randomUUID()}.tmp`
  try {
    await writeFile(temporary, data)
    await rename(temporary, filePath)
  } finally {
    await rm(temporary, { force: true }).catch(() => {})
  }
}

export function registerPrintIpc(getWindow: () => BrowserWindow | null): void {
  const secureHandle = (channel: string, handler: Parameters<typeof electronIpcMain.handle>[1]) => { assertKnownIpcChannel(channel); return electronIpcMain.handle(channel, secureIpcHandler(getWindow, handler as never) as never) }
  const ipcMain = { handle: secureHandle }
  ipcMain.handle('ports:list', async () => {
    try {
      // 串口（COM）与 USB 打印机端口（真机属性对话框的「端口(O)」下拉）一次取回。
      const [comPorts, usbPrinterPorts] = await Promise.all([listWindowsComPorts(), listWindowsUsbPrinterPorts()])
      return { ok: true, comPorts, usbPrinterPorts }
    }
    catch (error) { return { ok: false, comPorts: [], usbPrinterPorts: [], message: String((error as { message?: string }).message ?? error) } }
  })
  ipcMain.handle('printers:list', async (event) => {
    // 两个来源各自兜底：Electron 的打印队列枚举偶发失败（远程会话/新用户配置目录）时，
    // 不能把设备枚举（USBPRINT/PnP）的结果一起丢掉，否则「选择标签格式」页会一台打印机都列不出来。
    const messages: string[] = []
    let systemPrinters: Array<{ name: string; displayName: string; status: number }> = []
    try {
      const printers = await (event.sender as WebContents).getPrintersAsync()
      systemPrinters = printers.map((printer) => ({ name: printer.name, displayName: printer.displayName ?? printer.name, status: 0 }))
    } catch (error) {
      messages.push('系统打印队列枚举失败：' + String((error as { message?: string }).message ?? error))
    }
    let devicePrinters: Array<{ name: string; displayName: string; status: number }> = []
    try {
      devicePrinters = await listWindowsPrinterDevices()
    } catch (error) {
      messages.push('打印设备枚举失败：' + String((error as { message?: string }).message ?? error))
    }
    const seen = new Set<string>()
    const merged = [...systemPrinters, ...devicePrinters].filter((printer) => {
      const key = printer.name.trim().toLowerCase()
      if (!key || seen.has(key)) return false
      seen.add(key)
      return true
    })
    return { ok: true, printers: merged, ...(messages.length ? { message: messages.join('；') } : {}) }
  })
  ipcMain.handle('print-label', async (_event, rawPayload: unknown, rawJobId?: unknown) => {
    let payload: ReturnType<typeof validatePrintPayload>
    try { payload = validatePrintPayload(rawPayload) }
    catch (error) { return { ok: false, status: 'failed', message: String((error as { message?: string }).message ?? error) } }
    let jobId: string
    try { jobId = jobIdOrCreate(rawJobId) }
    catch (error) { return { ok: false, status: 'failed', message: String((error as { message?: string }).message ?? error) } }
    if (activePrintJobs.has(jobId)) return { ok: false, status: 'failed', message: '打印任务 ID 重复，已拒绝重复提交' }
    const controller = new AbortController()
    let resolvePrint: ((ok: boolean) => void) | undefined
    let canceled = false
    let window: BrowserWindow
    try {
      window = new BrowserWindow({ show: false, webPreferences: { sandbox: true, contextIsolation: true, nodeIntegration: false } })
    } catch (error) {
      return { ok: false, status: 'failed', message: String((error as { message?: string }).message ?? error) }
    }
    const active = {
      controller,
      cancel: () => {
        canceled = true
        resolvePrint?.(false)
        if (!window.isDestroyed()) window.destroy()
      }
    }
    activePrintJobs.set(jobId, active)
    let tempDir: string | undefined
    let cleanupPromise: Promise<void> | undefined
    const cleanup = (): Promise<void> => {
      if (!tempDir) return Promise.resolve()
      if (!cleanupPromise) cleanupPromise = rm(tempDir, { recursive: true, force: true }).catch(() => {})
      return cleanupPromise
    }
    window.on('closed', cleanup)
    try {
      tempDir = join(tmpdir(), `maxlabel-print-${randomUUID()}`)
      await mkdir(tempDir, { recursive: true })
      const localPages: Array<{ dataUrl: string; copies: number }> = []
      for (const [index, page] of payload.pages.entries()) {
        if (controller.signal.aborted) return canceledResult()
        const comma = page.dataUrl.indexOf(',')
        if (comma < 0) throw new Error(`第 ${index + 1} 页打印图片无效`)
        const filePath = join(tempDir, `p${index}.png`)
        await writeFile(filePath, Buffer.from(page.dataUrl.slice(comma + 1), 'base64'))
        localPages.push({ dataUrl: pathToFileURL(filePath).toString(), copies: page.copies ?? 1 })
      }
      if (controller.signal.aborted) return canceledResult()
      const document = printHtml(localPages, payload.widthMm, payload.heightMm)
      const htmlPath = join(tempDir, 'index.html')
      await writeFile(htmlPath, document.html, 'utf8')
      await window.loadFile(htmlPath)
      if (controller.signal.aborted) return canceledResult()
      const ok = await new Promise<boolean>((resolve) => {
        resolvePrint = resolve
        window.webContents.print({
          silent: false,
          ...(payload.printerName ? { deviceName: payload.printerName } : {}),
          pageSize: { width: Math.round(payload.widthMm * 1000), height: Math.round(payload.heightMm * 1000) },
          margins: { marginType: 'none' }, printBackground: true, copies: document.copies
        }, resolve)
      })
      if (controller.signal.aborted || canceled) return canceledResult()
      return ok ? { ok: true, status: 'accepted', message: '已提交系统打印任务（打印机实际完成状态需以设备为准）' } : { ok: false, status: 'failed', message: '系统打印任务未提交' }
    } catch (error) {
      await cleanup()
      if (controller.signal.aborted || canceled) return canceledResult()
      return { ok: false, status: 'failed', message: String((error as Error).message ?? error) }
    } finally {
      if (activePrintJobs.get(jobId) === active) activePrintJobs.delete(jobId)
      setTimeout(() => { if (!window.isDestroyed()) window.destroy() }, 800)
    }
  })
  ipcMain.handle('print:command', async (_event, rawPayload: unknown, rawJobId?: unknown) => {
    let payload: ReturnType<typeof validateCommandPayload>
    try { payload = validateCommandPayload(rawPayload) }
    catch (error) { return { ok: false, status: 'failed', message: String((error as { message?: string }).message ?? error) } }
    let data: Buffer
    let jobId: string
    try {
      data = commandBuffer(payload)
      jobId = jobIdOrCreate(rawJobId)
    } catch (error) {
      return { ok: false, status: 'failed', message: String((error as { message?: string }).message ?? error) }
    }
    if (activePrintJobs.has(jobId)) return { ok: false, status: 'failed', message: '打印任务 ID 重复，已拒绝重复提交' }
    const controller = new AbortController()
    const active = { controller, cancel: () => controller.abort() }
    activePrintJobs.set(jobId, active)
    if (payload.port.type !== 'file') {
      try { return await sendCommand(data, payload.port, controller.signal) }
      finally { if (activePrintJobs.get(jobId) === active) activePrintJobs.delete(jobId) }
    }
    try {
      if (controller.signal.aborted) return canceledResult()
      const owner = getWindow()
      const options = { defaultPath: 'label.prn', filters: [{ name: '打印指令文件', extensions: ['prn', 'txt', 'bin'] }, { name: '所有文件', extensions: ['*'] }] }
      const result = owner ? await dialog.showSaveDialog(owner, options) : await dialog.showSaveDialog(options)
      if (result.canceled || !result.filePath) return canceledResult('已取消保存指令文件')
      if (controller.signal.aborted) return canceledResult()
      await atomicWriteBuffer(result.filePath, data)
      return { ok: true, status: 'accepted', bytesWritten: data.byteLength, message: '已写入指令文件：' + result.filePath }
    } catch (error) {
      if (controller.signal.aborted) return canceledResult()
      return { ok: false, status: 'failed', message: String((error as { message?: string }).message ?? error) }
    } finally { if (activePrintJobs.get(jobId) === active) activePrintJobs.delete(jobId) }
  })
  ipcMain.handle('print:cancel', async (_event, rawJobId: unknown) => {
    try {
      const jobId = validatePrintJobId(rawJobId)
      const active = activePrintJobs.get(jobId)
      if (!active) return { ok: true, canceled: false, message: '打印任务已结束' }
      active.controller.abort()
      active.cancel()
      return { ok: true, canceled: true }
    } catch (error) {
      return { ok: false, canceled: false, message: String((error as { message?: string }).message ?? error) }
    }
  })
}
