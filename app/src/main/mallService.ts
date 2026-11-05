import { BrowserWindow, session } from 'electron'
import type { MallContext } from '../shared/ipcContract'
import type { MallTokens } from './mallCredentials'
import { validateMallContext } from './mallRepository'

interface MallWindowState {
  window: BrowserWindow
  origin: string
}

let mallState: MallWindowState | null = null
/** 最近一次登录/刷新得到的令牌；商城窗口在登录之后才打开时用它播种 localStorage。 */
let sessionState: { origin: string; tokens: MallTokens } | null = null
const seededWindows = new WeakSet<BrowserWindow>()

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

/** 写入店面 localStorage；返回值表示令牌是否真的变了（用于决定是否重载）。 */
function tokenScript(tokens: MallTokens): string {
  return `(() => {
    const access = ${JSON.stringify(tokens.accessToken)};
    const refresh = ${JSON.stringify(tokens.refreshToken)};
    const changed = localStorage.getItem('MAXLABEL_ACCESS_TOKEN') !== access
      || localStorage.getItem('MAXLABEL_REFRESH_TOKEN') !== refresh;
    localStorage.setItem('MAXLABEL_ACCESS_TOKEN', access);
    localStorage.setItem('MAXLABEL_REFRESH_TOKEN', refresh);
    return changed;
  })()`
}

/**
 * 店面在页面脚本启动时读取 localStorage；登录发生在软件内时，商城窗口可能后开，
 * 所以每次加载完成都补写一次令牌。只有令牌确实变化时才重载，避免加载循环。
 */
function seedTokensOnLoad(window: BrowserWindow, origin: string): void {
  if (seededWindows.has(window)) return
  seededWindows.add(window)
  window.webContents.on('did-finish-load', () => {
    const state = sessionState
    if (!state || state.origin !== origin || window.isDestroyed()) return
    if (!isSameOrigin(window.webContents.getURL(), origin)) return
    void window.webContents.executeJavaScript(tokenScript(state.tokens), true)
      .then((changed) => {
        if (changed && !window.isDestroyed()) window.webContents.reload()
      })
      .catch(() => {})
  })
}

export function openMallWindow(context: MallContext, path = '/'): BrowserWindow {
  const { baseUrl } = validateMallContext(context)
  const origin = originOf(baseUrl)
  if (mallState && !mallState.window.isDestroyed() && mallState.origin === origin) {
    mallState.window.show()
    seedTokensOnLoad(mallState.window, origin)
    void mallState.window.loadURL(`${baseUrl}${path.startsWith('/') ? path : `/${path}`}`)
    return mallState.window
  }
  if (mallState && !mallState.window.isDestroyed()) mallState.window.destroy()
  const window = createWindow(`${baseUrl}${path.startsWith('/') ? path : `/${path}`}`, origin, 1180, 780)
  mallState = { window, origin }
  seedTokensOnLoad(window, origin)
  window.on('closed', () => {
    if (mallState?.window === window) mallState = null
  })
  return window
}

/**
 * 主进程登录或刷新令牌后，把新值写回已打开的商城窗口。
 * 登录（reload=true）时店面状态还没更新，重载一次让页面按新令牌重建会话；
 * 例行刷新不重载，避免打断用户正在进行的购买流程。
 */
export function syncMallSession(context: MallContext, tokens: MallTokens, options?: { reload?: boolean }): void {
  const { baseUrl } = validateMallContext(context)
  const origin = originOf(baseUrl)
  sessionState = { origin, tokens }
  const window = mallState?.window
  if (!window || window.isDestroyed()) return
  if (!isSameOrigin(window.webContents.getURL(), origin)) return
  void window.webContents.executeJavaScript(tokenScript(tokens), true)
    .then((changed) => {
      if (changed && options?.reload && !window.isDestroyed()) window.webContents.reload()
    })
    .catch(() => {})
}

export function closeMallWindows(): void {
  if (mallState && !mallState.window.isDestroyed()) mallState.window.destroy()
  mallState = null
  sessionState = null
}

/**
 * 注销时同时清掉店面 localStorage：它和 Electron 的持久化 session 共用，
 * 只关窗口不清理的话，下次打开商城仍会读到上一账号的令牌。
 */
export async function clearMallSession(context: MallContext): Promise<void> {
  const { baseUrl } = validateMallContext(context)
  const origin = originOf(baseUrl)
  closeMallWindows()
  try {
    await session.defaultSession.clearStorageData({ origin, storages: ['localstorage'] })
  } catch {
    // 本地令牌已清理；浏览器存储清理失败不能阻塞注销。
  }
}

