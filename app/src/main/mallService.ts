import { BrowserWindow, session } from 'electron'
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

/**
 * 支付收银台白名单。
 *
 * 商城窗口默认只允许站内导航（防钓鱼）。但支付宝电脑网站支付是**整页跳转**：
 * 前端把 `window.location.href` 设为支付宝网关，收银台再跳 `excashier`。
 * 不放行这些域名，`will-navigate` 会把跳转拦下 —— 用户看到的就是「点了没反应」。
 */
const PAYMENT_HOST_PATTERNS = [
  /(^|\.)alipay\.com$/i,
  /(^|\.)alipaydev\.com$/i,
  /(^|\.)alipayobjects\.com$/i,
  // 支付宝收银台支持淘宝/天猫账号登录，必要时会跳到这些域名。
  /(^|\.)taobao\.com$/i,
  /(^|\.)tmall\.com$/i,
  /(^|\.)alibaba\.com$/i
]

function isAllowedNavigation(target: string, origin: string): boolean {
  if (isSameOrigin(target, origin)) return true
  try {
    const url = new URL(target)
    if (url.protocol !== 'https:') return false
    return PAYMENT_HOST_PATTERNS.some((pattern) => pattern.test(url.hostname))
  } catch {
    return false
  }
}

/** 站内 + 支付收银台可导航；其余外部域名一律拦下。子窗口沿用同一策略。 */
function hardenNavigation(window: BrowserWindow, origin: string): void {
  window.webContents.setWindowOpenHandler(({ url }) => {
    if (!isAllowedNavigation(url, origin)) return { action: 'deny' }
    return {
      action: 'allow',
      overrideBrowserWindowOptions: {
        width: 1100,
        height: 800,
        autoHideMenuBar: true,
        webPreferences: {
          contextIsolation: true,
          nodeIntegration: false,
          sandbox: true
        }
      }
    }
  })
  window.webContents.on('will-navigate', (event, target) => {
    if (isAllowedNavigation(target, origin)) return
    console.warn(`[mall] 已拦截外部导航：${target}`)
    event.preventDefault()
  })
  window.webContents.on('did-create-window', (child) => {
    hardenNavigation(child, origin)
  })
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
  hardenNavigation(window, origin)
  void window.loadURL(url)
  return window
}

/**
 * 打开登录窗口。
 *
 * 登录窗口与商城窗口共用同一个持久化 session：上一次登录遗留的令牌会让等待令牌的
 * 轮询在窗口刚出现时就“读到”旧令牌并关闭窗口（用户看到的是弹框闪退）。令牌只存在
 * localStorage 里，所以新开登录窗口前先清空该站点的本地存储，让商城重新展示登录表单。
 */
export async function openMallLoginWindow(context: MallContext): Promise<BrowserWindow> {
  const { baseUrl } = validateMallContext(context)
  const origin = originOf(baseUrl)
  if (loginState && !loginState.window.isDestroyed() && loginState.origin === origin) {
    loginState.window.show()
    return loginState.window
  }
  if (loginState && !loginState.window.isDestroyed()) loginState.window.destroy()
  await session.defaultSession.clearStorageData({ origin, storages: ['localstorage'] })
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

