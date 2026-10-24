import { BrowserWindow } from 'electron'
import type { MallContext } from '../shared/ipcContract'
import type { MallTokens } from './mallCredentials'
import { validateMallContext } from './mallRepository'

const LOGIN_PATH = '/?login=1&redirect=/account'

interface MallWindowState {
  window: BrowserWindow
  origin: string
}

let loginState: MallWindowState | null = null
let mallState: MallWindowState | null = null

function originOf(baseUrl: string): string {
  return new URL(baseUrl).origin
}

function isSameOrigin(url: string, origin: string): boolean {
  try {
    return new URL(url).origin === origin
  } catch {
    return false
  }
}

function createWindow(url: string, origin: string, width: number, height: number): BrowserWindow {
  const window = new BrowserWindow({
    width,
    height,
    show: true,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  })
  // 商城窗口不允许弹新窗；站内导航必须留在精确 origin。
  window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }))
  window.webContents.on('will-navigate', (event, target) => {
    if (!isSameOrigin(target, origin)) event.preventDefault()
  })
  void window.loadURL(url)
  return window
}

export function openMallLoginWindow(context: MallContext): BrowserWindow {
  const { baseUrl } = validateMallContext(context)
  const origin = originOf(baseUrl)
  if (loginState && !loginState.window.isDestroyed() && loginState.origin === origin) {
    loginState.window.show()
    return loginState.window
  }
  if (loginState && !loginState.window.isDestroyed()) loginState.window.destroy()
  const window = createWindow(`${baseUrl}${LOGIN_PATH}`, origin, 520, 680)
  loginState = { window, origin }
  window.on('closed', () => {
    if (loginState?.window === window) loginState = null
  })
  return window
}

export function closeMallLoginWindow(): void {
  if (loginState && !loginState.window.isDestroyed()) loginState.window.destroy()
  loginState = null
}

const TOKEN_SCRIPT = `(() => {
  try {
    return JSON.stringify({
      accessToken: localStorage.getItem('MAXLABEL_ACCESS_TOKEN'),
      refreshToken: localStorage.getItem('MAXLABEL_REFRESH_TOKEN')
    })
  } catch { return null }
})()`

export async function readTokensFromWindow(window: BrowserWindow, origin: string): Promise<MallTokens | null> {
  if (window.isDestroyed()) return null
  if (!isSameOrigin(window.webContents.getURL(), origin)) return null
  const raw = await window.webContents.executeJavaScript(TOKEN_SCRIPT, true) as string | null
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw) as { accessToken?: unknown; refreshToken?: unknown }
    if (typeof parsed.accessToken !== 'string' || typeof parsed.refreshToken !== 'string'
      || !parsed.accessToken || !parsed.refreshToken) {
      return null
    }
    // 店面 localStorage 不保存 expiresTime；按 access token 30 分钟、保守提前 5 分钟刷新。
    return {
      accessToken: parsed.accessToken,
      refreshToken: parsed.refreshToken,
      expiresTime: Date.now() + 25 * 60 * 1000
    }
  } catch {
    return null
  }
}

export async function waitForLoginTokens(
  window: BrowserWindow,
  baseUrl: string,
  timeoutMs = 5 * 60 * 1000
): Promise<MallTokens> {
  const origin = originOf(baseUrl)
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    if (window.isDestroyed()) throw new Error('登录窗口已关闭')
    const tokens = await readTokensFromWindow(window, origin)
    if (tokens) return tokens
    await new Promise((resolve) => setTimeout(resolve, 500))
  }
  throw new Error('登录超时，请重试')
}

export function openMallWindow(context: MallContext, path = '/'): BrowserWindow {
  const { baseUrl } = validateMallContext(context)
  const origin = originOf(baseUrl)
  if (mallState && !mallState.window.isDestroyed() && mallState.origin === origin) {
    mallState.window.show()
    void mallState.window.loadURL(`${baseUrl}${path.startsWith('/') ? path : `/${path}`}`)
    return mallState.window
  }
  if (mallState && !mallState.window.isDestroyed()) mallState.window.destroy()
  const window = createWindow(`${baseUrl}${path.startsWith('/') ? path : `/${path}`}`, origin, 1180, 780)
  mallState = { window, origin }
  window.on('closed', () => {
    if (mallState?.window === window) mallState = null
  })
  return window
}

/** 主进程刷新令牌后，把新值写回已打开的商城窗口并重载当前页。 */
export function syncMallSession(context: MallContext, tokens: MallTokens): void {
  const { baseUrl } = validateMallContext(context)
  const origin = originOf(baseUrl)
  const windows = [loginState, mallState]
    .map((state) => state?.window)
    .filter((window): window is BrowserWindow => Boolean(window && !window.isDestroyed()))
  for (const window of windows) {
    if (!isSameOrigin(window.webContents.getURL(), origin)) continue
    const script = `(() => {
      localStorage.setItem('MAXLABEL_ACCESS_TOKEN', ${JSON.stringify(tokens.accessToken)});
      localStorage.setItem('MAXLABEL_REFRESH_TOKEN', ${JSON.stringify(tokens.refreshToken)});
      return true;
    })()`
    void window.webContents.executeJavaScript(script, true).catch(() => {})
  }
}

export function closeMallWindows(): void {
  closeMallLoginWindow()
  if (mallState && !mallState.window.isDestroyed()) mallState.window.destroy()
  mallState = null
}

