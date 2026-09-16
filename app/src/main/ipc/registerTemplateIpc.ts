import { app, dialog, ipcMain as electronIpcMain, type BrowserWindow } from 'electron'
import { existsSync } from 'fs'
import { mkdir, readdir, rename, rm, stat, writeFile } from 'fs/promises'
import { randomUUID } from 'crypto'
import { basename, dirname, join, relative, resolve } from 'path'
import { readBoundedFile, redactTemplateJson, validateTemplatePath } from './validation'
import { assertPathAccess, grantPath, grantTemplateDirectory } from './pathAccess'
import { assertKnownIpcChannel, secureIpcHandler } from './senderGuard'

const MAX_LOCAL_TEMPLATES = 1000
const MAX_LOCAL_TEMPLATE_BYTES = 256 * 1024 * 1024

function templatesDir(): string {
  return join(app.getPath('userData'), 'templates')
}

async function atomicWriteText(path: string, content: string): Promise<void> {
  const temporary = `${path}.${randomUUID()}.tmp`
  try {
    await writeFile(temporary, content, 'utf-8')
    await rename(temporary, path)
  } finally {
    await rm(temporary, { force: true }).catch(() => {})
  }
}

function isInside(parent: string, candidate: string): boolean {
  const rel = relative(resolve(parent), resolve(candidate))
  return rel !== '' && !rel.startsWith('..') && !rel.includes(`..${process.platform === 'win32' ? '\\' : '/'}`)
}

export function registerTemplateIpc(getWindow: () => BrowserWindow | null): void {
  const secureHandle = (channel: string, handler: Parameters<typeof electronIpcMain.handle>[1]) => { assertKnownIpcChannel(channel); return electronIpcMain.handle(channel, secureIpcHandler(getWindow, handler as never) as never) }
  const ipcMain = { handle: secureHandle }
  ipcMain.handle('template:save', async (_event, json: string, suggestedName: string) => {
    try {
      const base = basename(suggestedName || '未命名').replace(/\.(msdx|json|lsdx)$/i, '')
      const options = {
        defaultPath: base + '.msdx',
        filters: [
          { name: 'MaxLabel 标签模板', extensions: ['msdx'] },
          { name: '兼容旧格式', extensions: ['json'] }
        ]
      }
      const win = getWindow()
      const result = win ? await dialog.showSaveDialog(win, options) : await dialog.showSaveDialog(options)
      if (result.canceled || !result.filePath) return { canceled: true }
      await grantPath(result.filePath, ['read', 'write'])
      await grantTemplateDirectory(result.filePath)
      await atomicWriteText(result.filePath, redactTemplateJson(json))
      return { canceled: false, filePath: result.filePath }
    } catch (error) {
      return { canceled: false, message: String((error as { message?: string }).message ?? error) }
    }
  })

  ipcMain.handle('template:open', async () => {
    try {
      const options = {
        filters: [
          { name: '标签文件', extensions: ['msdx', 'lsdx', 'json'] },
          { name: 'MaxLabel 标签模板', extensions: ['msdx', 'json'] },
          { name: 'LabelShop 标签文件', extensions: ['lsdx'] }
        ],
        properties: ['openFile'] as Array<'openFile'>
      }
      const win = getWindow()
      // 原生文件对话框位于 CDP / 自动化上下文之外，无法被回归脚本驱动；
      // 与 updater 的 MAXLABEL_UPDATE_URL 同一模式，允许用 MAXLABEL_OPEN_PATH
      // 指定一个文件直接返回（部署与回归用）。未设置时仍走真实对话框。
      const override = String(process.env['MAXLABEL_OPEN_PATH'] ?? '').trim()
      const result = override
        ? { canceled: false, filePaths: [resolve(override)] }
        : win ? await dialog.showOpenDialog(win, options) : await dialog.showOpenDialog(options)
      if (result.canceled || !result.filePaths.length) return { canceled: true }
      // 打开文件只允许读取；写权限由保存对话框或 saveTo 显式授予。
      await grantPath(result.filePaths[0], ['read'])
      await grantTemplateDirectory(result.filePaths[0])
      const content = (await readBoundedFile(result.filePaths[0], 16 * 1024 * 1024)).toString('utf-8')
      return { canceled: false, filePath: result.filePaths[0], content }
    } catch (error) {
      return { canceled: false, message: String((error as { message?: string }).message ?? error) }
    }
  })

  ipcMain.handle('template:openPath', async (_event, filePath: string) => {
    try {
      const path = await assertPathAccess(resolve(validateTemplatePath(filePath)), 'read')
      return { ok: true, filePath: path, content: (await readBoundedFile(path, 16 * 1024 * 1024)).toString('utf-8') }
    } catch (error) {
      return { ok: false, message: String((error as { message?: string }).message ?? error) }
    }
  })

  ipcMain.handle('template:saveTo', async (_event, filePath: string, json: string) => {
    try {
      const path = await assertPathAccess(resolve(validateTemplatePath(filePath)), 'read')
      // 用户明确执行保存后，才把已打开的模板升级为可写能力，保留 Ctrl+S 习惯。
      await grantPath(path, ['write'])
      await mkdir(dirname(path), { recursive: true })
      await atomicWriteText(path, redactTemplateJson(json))
      return { ok: true, filePath: path }
    } catch (error) {
      return { ok: false, message: String((error as { message?: string }).message ?? error) }
    }
  })

  ipcMain.handle('template:list', async () => {
    const dir = templatesDir()
    try {
      await mkdir(dir, { recursive: true })
      const files = (await readdir(dir)).filter((file) => file.toLowerCase().endsWith('.json'))
      const truncated = files.length > MAX_LOCAL_TEMPLATES
      const items: Array<{ name: string; path: string; mtime: number; size: number; widthMm?: number; heightMm?: number; remark?: string; thumb?: string }> = []
      for (const file of files.slice(0, MAX_LOCAL_TEMPLATES)) {
        const path = join(dir, file)
        try {
          const info = await stat(path)
          const item: (typeof items)[number] = { name: file.replace(/\.json$/i, ''), path, mtime: info.mtimeMs, size: info.size }
          try {
            const parsed = JSON.parse((await readBoundedFile(path, 16 * 1024 * 1024)).toString('utf-8')) as Record<string, unknown>
            if (typeof parsed.widthMm === 'number') item.widthMm = parsed.widthMm
            if (typeof parsed.heightMm === 'number') item.heightMm = parsed.heightMm
            if (typeof parsed.remark === 'string') item.remark = parsed.remark
            if (typeof parsed.thumb === 'string' && parsed.thumb.length < 400000) item.thumb = parsed.thumb
          } catch { /* 损坏模板仍列出，允许用户删除。 */ }
          items.push(item)
        } catch { /* 单个文件错误不影响模板库。 */ }
      }
      items.sort((a, b) => b.mtime - a.mtime)
      return { ok: true, dir, items, ...(truncated ? { truncated: true } : {}) }
    } catch (error) {
      return { ok: false, message: String((error as { message?: string }).message ?? error) }
    }
  })

  ipcMain.handle('template:saveToLib', async (_event, name: string, json: string) => {
    try {
      const dir = templatesDir()
      await mkdir(dir, { recursive: true })
      await grantPath(dir, ['read', 'write'], true)
      const cleanJson = redactTemplateJson(json)
      const incomingBytes = Buffer.byteLength(cleanJson, 'utf8')
      const existingFiles = (await readdir(dir)).filter((file) => file.toLowerCase().endsWith('.json'))
      if (existingFiles.length >= MAX_LOCAL_TEMPLATES) return { ok: false, error: `本机模板库最多 ${MAX_LOCAL_TEMPLATES} 个模板` }
      let existingBytes = 0
      for (const file of existingFiles) {
        try { existingBytes += (await stat(join(dir, file))).size } catch { /* 文件刚被删除，按当前可见集合继续。 */ }
      }
      if (existingBytes + incomingBytes > MAX_LOCAL_TEMPLATE_BYTES) return { ok: false, error: '本机模板库总容量超过 256 MB' }
      const safe = (String(name ?? '未命名').replace(/[\\/:*?"<>|]/g, '_').trim() || '未命名').slice(0, 180)
      let path = join(dir, safe + '.json')
      let suffix = 1
      while (existsSync(path)) path = join(dir, `${safe} (${suffix++}).json`)
      await atomicWriteText(path, cleanJson)
      return { ok: true, path }
    } catch (error) {
      return { ok: false, message: String((error as { message?: string }).message ?? error) }
    }
  })

  ipcMain.handle('template:delete', async (_event, filePath: string) => {
    try {
      const dir = templatesDir()
      const path = resolve(String(filePath ?? ''))
      if (!isInside(dir, path) || !path.toLowerCase().endsWith('.json')) {
        return { ok: false, message: '仅支持删除模板库中的 JSON 模板' }
      }
      await rm(path, { force: true })
      return { ok: true }
    } catch (error) {
      return { ok: false, message: String((error as { message?: string }).message ?? error) }
    }
  })
}
