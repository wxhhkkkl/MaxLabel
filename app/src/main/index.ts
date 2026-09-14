import { app, shell, BrowserWindow, ipcMain, dialog, clipboard, nativeImage, ClipboardItem } from 'electron'
import { dirname, join, resolve } from 'path'
import { existsSync } from 'fs'
import { mkdir, rename, rm, writeFile } from 'fs/promises'
import { randomUUID } from 'crypto'
import { closeCloudWindow } from './cloudService'
import { registerServiceIpc } from './ipc/registerServiceIpc'
import { registerFileIpc } from './ipc/registerFileIpc'
import { registerLogIpc } from './ipc/registerLogIpc'
import { registerTemplateIpc } from './ipc/registerTemplateIpc'
import { registerPrintIpc } from './ipc/registerPrintIpc'
import { validateBarcodeExportPayload, validateDataUrl } from './ipc/validation'
import { assertPathAccess } from './ipc/pathAccess'
import { openPreviewWindow } from './previewWindow'
import { assertKnownIpcChannel, secureIpcHandler } from './ipc/senderGuard'
import { IPC_CHANNELS } from '../shared/ipcContract'

let mainWindow: BrowserWindow | null = null
let allowMainWindowClose = false
const secureHandle = (channel: string, handler: Parameters<typeof ipcMain.handle>[1]) => { assertKnownIpcChannel(channel); return ipcMain.handle(channel, secureIpcHandler(() => mainWindow, handler as never) as never) }

function createWindow(): BrowserWindow {
  const win = new BrowserWindow({
    width: 1360,
    height: 860,
    minWidth: 1000,
    minHeight: 640,
    show: false,
    autoHideMenuBar: true,
    title: 'MaxLabel',
    backgroundColor: '#F4F3EE',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  })

  win.on('ready-to-show', () => win.show())
  win.on('close', (event) => {
    if (allowMainWindowClose) return
    event.preventDefault()
    win.webContents.send(IPC_CHANNELS.closeRequested)
  })
  win.on('closed', () => {
    mainWindow = null
    allowMainWindowClose = false
  })

  win.webContents.setWindowOpenHandler((details) => {
    try {
      const url = new URL(details.url)
      if (url.protocol === 'https:' || url.protocol === 'http:') void shell.openExternal(url.toString()).catch(() => {})
    } catch { /* 忽略非法外部链接。 */ }
    return { action: 'deny' }
  })

  if (process.env['ELECTRON_RENDERER_URL']) {
    void win.loadURL(process.env['ELECTRON_RENDERER_URL']).catch((error) => console.error('渲染页面加载失败', error))
  } else {
    void win.loadFile(join(__dirname, '../renderer/index.html')).catch((error) => console.error('渲染页面加载失败', error))
  }
  return win
}

// ---------- IPC：打开帮助文档 ----------
secureHandle('help:open', async () => {
  try {
    const packagedDocs = join(process.resourcesPath, 'docs', 'labelshop-help-zh')
    const developmentDocs = join(app.getAppPath(), 'docs', 'labelshop-help-zh')
    const docs = existsSync(packagedDocs) ? packagedDocs : developmentDocs
    const helpHome = join(docs, 'Introduction.htm')
    if (existsSync(helpHome)) {
      await shell.openPath(helpHome)
    } else if (existsSync(docs)) {
      await shell.openPath(docs)
    } else {
      await shell.openExternal('https://www.360code.com/')
    }
    return { ok: true }
  } catch (e) {
    return { ok: false, message: String((e as { message?: string }).message ?? e) }
  }
})

// ---------- IPC：打印预览（独立窗口） ----------
secureHandle('preview:open', async (_event, rawPayload: unknown) => {
  try { return await openPreviewWindow(rawPayload) }
  catch (error) { return { ok: false, message: String((error as { message?: string }).message ?? error) } }
})

registerFileIpc(() => mainWindow)
registerLogIpc(() => mainWindow)
registerServiceIpc(() => mainWindow)

registerTemplateIpc(() => mainWindow)
registerPrintIpc(() => mainWindow)

secureHandle('app:close-window', () => {
  allowMainWindowClose = true
  mainWindow?.close()
})
// ---------- IPC：复制条码图片到剪贴板 ----------
secureHandle('barcode:copy', async (_event, dataUrl: string) => {
  try {
    const img = nativeImage.createFromDataURL(validateDataUrl(dataUrl, '条码图片'))
    if (img.isEmpty()) return { ok: false, message: '图片数据无效' }
    await clipboard.write([
      new ClipboardItem({ 'image/png': new Blob([new Uint8Array(img.toPNG())], { type: 'image/png' }) })
    ])
    return { ok: true }
  } catch (e) {
    return { ok: false, message: String((e as { message?: string }).message ?? e) }
  }
})

// ---------- IPC：批量导出条码图片 ----------
secureHandle(
  'export:barcodes',
  async (_event, payload: { items: Array<{ name: string; dataUrl: string }>; dir?: string }) => {
    try {
      const items = validateBarcodeExportPayload(payload)
      let dir = typeof payload?.dir === 'string' ? payload.dir.trim() : ''
      if (dir) dir = await assertPathAccess(dir, 'write')
      else {
        const opts = {
          title: '选择条码导出目录',
          properties: ['openDirectory'] as Array<'openDirectory'>
        }
        const res = mainWindow ? await dialog.showOpenDialog(mainWindow, opts) : await dialog.showOpenDialog(opts)
        if (res.canceled || !res.filePaths.length) return { canceled: true }
        dir = res.filePaths[0]
      }
      const staging = join(dir, `.maxlabel-export-${randomUUID()}`)
      const committed: Array<{ target: string; backup?: string }> = []
      try {
        await mkdir(staging, { recursive: true })
        for (const it of items) {
          const base64 = it.dataUrl.split(',')[1]
          if (!base64) continue
          await writeFile(join(staging, it.name), Buffer.from(base64, 'base64'))
        }
        for (const it of items) {
          const target = resolve(dir, it.name)
          if (dirname(target) !== resolve(dir)) throw new Error('条码文件名超出所选目录')
          const staged = join(staging, it.name)
          const backup = `${target}.${randomUUID()}.bak`
          let backupPath: string | undefined
          if (existsSync(target)) {
            await rename(target, backup)
            backupPath = backup
          }
          try {
            await rename(staged, target)
            committed.push({ target, backup: backupPath })
          } catch (error) {
            if (backupPath) await rename(backupPath, target).catch(() => {})
            throw error
          }
        }
        for (const entry of committed) if (entry.backup) await rm(entry.backup, { force: true })
        return { canceled: false, ok: true, dir, count: committed.length }
      } catch (error) {
        for (const entry of committed.reverse()) {
          await rm(entry.target, { force: true }).catch(() => {})
          if (entry.backup) await rename(entry.backup, entry.target).catch(() => {})
        }
        throw error
      } finally {
        await rm(staging, { recursive: true, force: true }).catch(() => {})
      }
    } catch (error) {
      return { ok: false, message: String((error as { message?: string }).message ?? error) }
    }
  }
)

// ---------- 应用生命周期 ----------
app.whenReady().then(async () => {
  // 云服务部署在用户服务器上，客户端不本地拉起后端；
  // 打开云服务窗口/在线激活时按配置的服务器地址直连。
  mainWindow = createWindow()
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      mainWindow = createWindow()
    }
  })
}).catch((error) => {
  console.error('应用启动失败', error)
  app.quit()
})

app.on('window-all-closed', () => {
  closeCloudWindow()
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('before-quit', () => {
  closeCloudWindow()
})
