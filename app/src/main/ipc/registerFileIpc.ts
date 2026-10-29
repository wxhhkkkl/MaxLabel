import { dialog, ipcMain as electronIpcMain, nativeImage, shell, type BrowserWindow } from 'electron'
import { existsSync } from 'node:fs'
import { readBoundedFile, validateDatasetSourcePath, validateImagePath } from './validation'
import { assertPathAccess, grantPath } from './pathAccess'
import { MAX_IMAGE_DECOMPRESSED_BYTES, MAX_IMAGE_PIXELS } from '../../shared/print/limits'
import { assertKnownIpcChannel, secureIpcHandler } from './senderGuard'
import { IMAGE_FILE_FILTERS } from '../../shared/domain/imageFormats'
import { CLOSE_CONFIRM_CANCEL_ID, CLOSE_CONFIRM_DEFAULT_ID, closeConfirmButtons, closeConfirmText, resolveCloseChoice } from '../../shared/domain/closeGuard'
import { normalizeLanguage } from '../../shared/i18n/translate'

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
}
