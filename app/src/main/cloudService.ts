// ---------- MaxLabel 云服务：远程服务器连接 ----------
// 云服务端部署在用户自己的服务器上（FastAPI + Vue，见项目 server/ 目录）。
// 客户端不携带后端，仅通过 HTTP 连接服务器：授权鉴权（/api/license/*）、
// 账户（/api/auth/*）、云存储（/api/cloud/*）。
// 服务器地址：客户端系统选项里配置（localStorage 'maxlabel_server_url'），
// 本地开发默认 http://127.0.0.1:8420，可在服务设置中切换到部署地址。
import { BrowserWindow } from 'electron'
import { normalizeServerUrl } from './serverUrlPolicy'

export const DEFAULT_SERVER_URL = 'http://127.0.0.1:8420'

let cloudWin: BrowserWindow | null = null

function normalize(url: string): string {
  const normalized = normalizeServerUrl(url)
  if (normalized === null) throw new Error('服务器地址无效；远程服务器必须使用 HTTPS，本机地址可使用 HTTP')
  return normalized
}

function sameOrigin(candidate: string, allowed: string): boolean {
  try { return new URL(candidate).origin === new URL(allowed).origin }
  catch { return false }
}

/** 主进程默认服务器地址（渲染层配置后优先用渲染层传入值） */
export function defaultServerUrl(): string {
  try {
    return normalize(process.env.MAXLABEL_SERVER_URL || DEFAULT_SERVER_URL)
  } catch {
    return ''
  }
}

/** 打开云服务窗口，加载指定服务器地址（未传则用默认/已配置地址） */
export async function openCloudWindow(serverUrl?: string): Promise<{ ok: boolean; url?: string; error?: string }> {
  let base: string
  try {
    base = normalize(serverUrl ?? '')
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : '云服务器地址无效' }
  }
  const url = base ? base : defaultServerUrl()
  if (!url) return { ok: false, error: '未配置云服务器地址' }

  if (cloudWin && !cloudWin.isDestroyed()) {
    if (cloudWin.isMinimized()) cloudWin.restore()
    if (sameOrigin(cloudWin.webContents.getURL(), url)) {
      cloudWin.focus()
      return { ok: true, url }
    }
    // Navigation guards capture the allowed origin for the window. Reusing the
    // window for another server would therefore either reject the new URL or
    // leave an old-origin guard in place, so recreate it deterministically.
    cloudWin.destroy()
    cloudWin = null
  }

  cloudWin = new BrowserWindow({
    width: 1180,
    height: 780,
    title: 'MaxLabel 云服务',
    backgroundColor: '#f4f6f8',
    autoHideMenuBar: true,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  })
  cloudWin.on('closed', () => {
    cloudWin = null
  })
  cloudWin.webContents.setWindowOpenHandler(() => ({ action: 'deny' }))
  cloudWin.webContents.on('will-navigate', (event, targetUrl) => {
    if (!sameOrigin(targetUrl, url)) event.preventDefault()
  })
  try {
    await cloudWin.loadURL(url + '/')
    return { ok: true, url }
  } catch {
    cloudWin.destroy()
    cloudWin = null
    return { ok: false, error: `无法连接云服务器（${url}）` }
  }
}

/** 关闭云服务窗口（应用退出时调用） */
export function closeCloudWindow(): void {
  if (cloudWin && !cloudWin.isDestroyed()) {
    cloudWin.destroy()
  }
  cloudWin = null
}
