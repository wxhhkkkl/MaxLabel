// ---------- MaxLabel 云服务：远程服务器连接 ----------
// 云服务端部署在用户自己的服务器上（FastAPI + Vue，见项目 server/ 目录）。
// 客户端不携带后端，仅通过 HTTP 连接服务器：授权鉴权（/api/license/*）、
// 账户（/api/auth/*）、云存储（/api/cloud/*）。
// 服务器地址：客户端系统选项里配置（localStorage 'maxlabel_server_url'），
// 开发/演示默认 http://127.0.0.1:8420，正式部署请改为服务器域名。
import { app, BrowserWindow } from 'electron'

export const DEFAULT_SERVER_URL = 'http://127.0.0.1:8420'

let cloudWin: BrowserWindow | null = null

function normalize(url: string): string {
  return String(url || '').trim().replace(/\/+$/, '')
}

/** 主进程默认服务器地址（渲染层配置后优先用渲染层传入值） */
export function defaultServerUrl(): string {
  return normalize(process.env.MAXLABEL_SERVER_URL || DEFAULT_SERVER_URL)
}

/** 打开云服务窗口，加载指定服务器地址（未传则用默认/已配置地址） */
export async function openCloudWindow(serverUrl?: string): Promise<{ ok: boolean; url?: string; error?: string }> {
  const base = normalize(serverUrl ?? '')
  const url = base ? base : defaultServerUrl()
  if (!url) return { ok: false, error: '未配置云服务器地址' }

  if (cloudWin && !cloudWin.isDestroyed()) {
    if (cloudWin.isMinimized()) cloudWin.restore()
    if (cloudWin.webContents.getURL().startsWith(url)) {
      cloudWin.focus()
      return { ok: true, url }
    }
    cloudWin.loadURL(url + '/')
    cloudWin.focus()
    return { ok: true, url }
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
