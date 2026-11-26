import { dialog, ipcMain as electronIpcMain, nativeImage, shell, type BrowserWindow } from 'electron'
import { existsSync, readFileSync } from 'node:fs'
import { writeFile } from 'node:fs/promises'
import { basename, dirname, isAbsolute, join } from 'node:path'
import { readBoundedFile, validateDatasetSourcePath, validateImagePath } from './validation'
import { assertPathAccess, grantPath } from './pathAccess'
import { MAX_IMAGE_DECOMPRESSED_BYTES, MAX_IMAGE_PIXELS } from '../../shared/print/limits'
import { sniffImageMime } from '../../shared/print/imageBytes'
import { assertKnownIpcChannel, secureIpcHandler } from './senderGuard'
import { IMAGE_FILE_FILTERS } from '../../shared/domain/imageFormats'
import { CLOSE_CONFIRM_CANCEL_ID, CLOSE_CONFIRM_DEFAULT_ID, closeConfirmButtons, closeConfirmText, resolveCloseChoice } from '../../shared/domain/closeGuard'
import { normalizeLanguage } from '../../shared/i18n/translate'
import { assertEditable } from './editableGuard'
import { fetchCloudImage } from '../cloudImages'
import { httpGetBinary } from '../net'

const EXPORT_DATA_URL = /^data:(image\/(?:png|jpeg|gif|bmp|webp));base64,([A-Za-z0-9+/=]+)$/
const EXT_BY_MIME: Record<string, string> = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/gif': 'gif', 'image/bmp': 'bmp', 'image/webp': 'webp' }

function decodeExportImage(dataUrl: unknown): { buffer: Buffer; ext: string } {
  if (typeof dataUrl !== 'string' || dataUrl.length > MAX_IMAGE_DECOMPRESSED_BYTES * 2) throw new Error('图片数据超过大小限制')
  const match = EXPORT_DATA_URL.exec(dataUrl.trim())
  if (!match) throw new Error('图片数据格式无效')
  const buffer = Buffer.from(match[2], 'base64')
  if (!buffer.length || buffer.length > MAX_IMAGE_DECOMPRESSED_BYTES) throw new Error('图片数据超过大小限制')
  const mime = sniffImageMime(buffer)
  if (!mime) throw new Error('图片内容无法识别')
  return { buffer, ext: EXT_BY_MIME[mime] }
}

function validateExportItems(value: unknown): Array<{ fileName: string; dataUrl: string }> {
  if (!Array.isArray(value) || value.length === 0 || value.length > 1000) throw new Error('图片导出参数无效')
  return value.map((item) => {
    if (!item || typeof item !== 'object') throw new Error('图片导出参数无效')
    const record = item as { fileName?: unknown; dataUrl?: unknown }
    if (typeof record.fileName !== 'string' || !record.fileName.trim() || record.fileName.length > 255) throw new Error('图片文件名无效')
    if (typeof record.dataUrl !== 'string') throw new Error('图片数据格式无效')
    return { fileName: record.fileName, dataUrl: record.dataUrl }
  })
}

function sanitizeImageFileName(fileName: string, ext: string): string {
  const base = basename(fileName.replace(/\\/g, '/'))
    .replace(/\.(png|jpe?g|gif|bmp|webp)$/i, '')
    .replace(/[\\/:*?"<>|\u0000-\u001f]/g, '_')
    .trim()
  return `${(base || 'image').slice(0, 180)}.${ext}`
}

function chooseImagePath(dir: string, fileName: string, buffer: Buffer): { fileName: string; path: string } {
  for (let suffix = 1; suffix <= 1000; suffix += 1) {
    const candidate = suffix === 1
      ? fileName
      : fileName.replace(/(\.[^.]+)$/, ` (${suffix - 1})$1`)
    const path = join(dir, candidate)
    if (!existsSync(path)) return { fileName: candidate, path }
    try {
      if (readFileSync(path).equals(buffer)) return { fileName: candidate, path }
    } catch { /* 读不到就按冲突处理 */ }
  }
  throw new Error('图片目录中同名文件过多，请换一个目录')
}

export function registerFileIpc(getWindow: () => BrowserWindow | null): void {
  const secureHandle = (channel: string, handler: Parameters<typeof electronIpcMain.handle>[1]) => { assertKnownIpcChannel(channel); return electronIpcMain.handle(channel, secureIpcHandler(getWindow, handler as never) as never) }
  const ipcMain = { handle: secureHandle }
  ipcMain.handle('dialog:pickFile', async (_e, opts?: { filters?: Array<{ name: string; extensions: string[] }> }) => {
    try {
      // 与 template:open 的 MAXLABEL_OPEN_PATH 同一模式：原生「打开」对话框位于
      // CDP / 自动化上下文之外，回归脚本点不到它的按钮。设置该变量时直接返回该文件
      // （仍走下面的授权与读取路径），未设置时照常弹出真实对话框。
      const override = process.env['MAXLABEL_PICK_PATH']?.trim()
      const result: { canceled: boolean; filePaths: string[] } = override
        ? { canceled: false, filePaths: [override] }
        : await dialog.showOpenDialog({
          properties: ['openFile'],
          filters: opts?.filters ?? IMAGE_FILE_FILTERS
        })
      if (result.canceled || !result.filePaths[0]) return { ok: false, path: '' }
      await grantPath(result.filePaths[0], ['read'])
      return { ok: true, path: result.filePaths[0] }
    } catch (error) {
      return { ok: false, path: '', message: String((error as { message?: string }).message ?? error), messageKey: 'error.fileAccess' }
    }
  })
  ipcMain.handle('dataset:openSource', async (_e, filePath: unknown) => {
    try {
      const path = validateDatasetSourcePath(filePath)
      if (!existsSync(path)) throw new Error('源文件不存在，可能已被移动或删除，请重新导入')
      const message = await shell.openPath(path)
      return message ? { ok: false, message, messageKey: 'error.datasetSource' } : { ok: true }
    } catch (error) {
      return { ok: false, message: String((error as { message?: string }).message ?? error), messageKey: 'error.datasetSource' }
    }
  })
  ipcMain.handle('dialog:pickDir', async () => {
    try {
      const result = await dialog.showOpenDialog({ properties: ['openDirectory'] })
      if (result.canceled || !result.filePaths[0]) return { ok: false, path: '' }
      await grantPath(result.filePaths[0], ['read', 'write'], true)
      return { ok: true, path: result.filePaths[0] }
    } catch (error) {
      return { ok: false, path: '', message: String((error as { message?: string }).message ?? error), messageKey: 'error.fileAccess' }
    }
  })
  ipcMain.handle('dialog:confirmClose', async (_event, name: string, language?: unknown) => {
    const lang = normalizeLanguage(language)
    try {
      const result = await dialog.showMessageBox({
        type: 'question',
        ...closeConfirmText(name, lang),
        buttons: closeConfirmButtons(lang),
        defaultId: CLOSE_CONFIRM_DEFAULT_ID,
        cancelId: CLOSE_CONFIRM_CANCEL_ID,
        noLink: true
      })
      return resolveCloseChoice(result.response)
    } catch {
      return 'cancel'
    }
  })
  ipcMain.handle('image:read', async (_event, filePath: string) => {
    try {
      const path = await assertPathAccess(validateImagePath(filePath), 'read')
      const buf = await readBoundedFile(path, MAX_IMAGE_DECOMPRESSED_BYTES)
      const decoded = nativeImage.createFromBuffer(buf)
      const size = decoded.getSize()
      if (decoded.isEmpty() || size.width <= 0 || size.height <= 0) throw new Error('图片内容无法解码')
      if (size.width * size.height > MAX_IMAGE_PIXELS) throw new Error('图片像素尺寸过大（最大 4000 万像素）')
      const ext = path.toLowerCase().split('.').pop() || ''
      const mime = ext === 'png' ? 'image/png'
        : ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg'
          : ext === 'gif' ? 'image/gif'
            : ext === 'webp' ? 'image/webp'
              : ext === 'bmp' ? 'image/bmp' : 'image/png'
      return { ok: true, dataUrl: `data:${mime};base64,${buf.toString('base64')}`, path }
    } catch (error) {
      return { ok: false, message: String((error as { message?: string }).message ?? error), messageKey: 'error.fileAccess' }
    }
  })
  ipcMain.handle('image:fetchCloud', async (_event, reference: unknown) => {
    return fetchCloudImage(reference, {
      getBinary: (url) => httpGetBinary(url),
      decode: (buffer) => {
        const image = nativeImage.createFromBuffer(buffer)
        return image.isEmpty() ? null : image.getSize()
      }
    })
  })
  ipcMain.handle('image:exportToDirectory', async (_event, payload: unknown) => {
    try {
      assertEditable()
      const record = (payload && typeof payload === 'object' ? payload : {}) as { items?: unknown; suggestedDir?: unknown }
      const items = validateExportItems(record.items)
      const suggested = typeof record.suggestedDir === 'string' && isAbsolute(record.suggestedDir) ? record.suggestedDir : undefined
      // 建议目录通常还不存在（<模板名>_images）；对话框默认打开其父目录，由用户新建。
      const defaultPath = suggested ? (existsSync(suggested) ? suggested : dirname(suggested)) : undefined
      const options = {
        properties: ['openDirectory', 'createDirectory'] as Array<'openDirectory' | 'createDirectory'>,
        ...(defaultPath ? { defaultPath } : {})
      }
      const win = getWindow()
      const result = win ? await dialog.showOpenDialog(win, options) : await dialog.showOpenDialog(options)
      if (result.canceled || !result.filePaths[0]) return { ok: false, canceled: true }
      await grantPath(result.filePaths[0], ['read', 'write'], true)
      const dir = await assertPathAccess(result.filePaths[0], 'write')
      const files: Array<{ fileName: string; path: string }> = []
      for (const item of items) {
        const { buffer, ext } = decodeExportImage(item.dataUrl)
        const image = nativeImage.createFromBuffer(buffer)
        const size = image.isEmpty() ? null : image.getSize()
        if (!size || size.width <= 0 || size.height <= 0) throw new Error('图片内容无法解码')
        if (size.width * size.height > MAX_IMAGE_PIXELS) throw new Error('图片像素尺寸过大（最大 4000 万像素）')
        const chosen = chooseImagePath(dir, sanitizeImageFileName(item.fileName, ext), buffer)
        await writeFile(chosen.path, buffer)
        files.push(chosen)
      }
      return { ok: true, dir, files }
    } catch (error) {
      return { ok: false, message: String((error as { message?: string }).message ?? error), messageKey: 'error.fileAccess' }
    }
  })
}
