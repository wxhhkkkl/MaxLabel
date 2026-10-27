import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('electron', async () => (await import('../../helpers/electronMock')).createElectronMock())

import { BrowserWindow, session } from 'electron'
import {
  closeMallWindows,
  openMallLoginWindow,
  openMallWindow,
  readTokensFromWindow,
  syncMallSession
} from '@main/mallService'

const context = { baseUrl: 'https://mall.test', tenantId: 162 }

afterEach(() => {
  closeMallWindows()
  vi.mocked(BrowserWindow).mockClear()
})

describe('mall service windows', () => {
  it('opens the storefront login page in a sandboxed exact-origin window', async () => {
    await openMallLoginWindow(context)
    expect(BrowserWindow).toHaveBeenCalledTimes(1)
    const options = vi.mocked(BrowserWindow).mock.calls[0][0] as {
      webPreferences: Record<string, unknown>
    }
    expect(options.webPreferences).toMatchObject({
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    })
    const window = vi.mocked(BrowserWindow).mock.results[0].value
    expect(window.loadURL).toHaveBeenCalledWith('https://mall.test/?login=1&redirect=/account')
    expect(window.webContents.setWindowOpenHandler).toHaveBeenCalled()
  })

  it('clears tokens left behind by an earlier storefront session before opening the login window', async () => {
    await openMallLoginWindow(context)
    const clear = vi.mocked(session.defaultSession.clearStorageData)
    expect(clear).toHaveBeenCalledWith({ origin: 'https://mall.test', storages: ['localstorage'] })
    // 必须先清空再加载页面，否则页面脚本会立刻读到旧令牌，登录窗口刚出现就被关闭。
    expect(clear.mock.invocationCallOrder[0]).toBeLessThan(vi.mocked(BrowserWindow).mock.invocationCallOrder[0])
  })

  it('reuses the same login window for the same origin', async () => {
    const first = await openMallLoginWindow(context)
    const second = await openMallLoginWindow(context)
    expect(second).toBe(first)
    expect(BrowserWindow).toHaveBeenCalledTimes(1)
  })

  it('opens the mall and writes refreshed tokens into its localStorage', () => {
    const window = openMallWindow(context, '/membership')
    expect(window.loadURL).toHaveBeenCalledWith('https://mall.test/membership')
    vi.mocked(window.webContents.getURL).mockReturnValue('https://mall.test/membership')

    syncMallSession(context, {
      accessToken: 'access-1',
      refreshToken: 'refresh-1',
      expiresTime: 123
    })

    expect(window.webContents.executeJavaScript).toHaveBeenCalledWith(
      expect.stringContaining('access-1'),
      true
    )
    expect(window.webContents.executeJavaScript).toHaveBeenCalledWith(
      expect.stringContaining('refresh-1'),
      true
    )
  })

  it('reads tokens back after the storefront refreshes its own localStorage', async () => {
    const window = openMallWindow(context)
    vi.mocked(window.webContents.getURL).mockReturnValue('https://mall.test/account')
    vi.mocked(window.webContents.executeJavaScript).mockResolvedValue(JSON.stringify({
      accessToken: 'a2', refreshToken: 'r2'
    }))

    await expect(readTokensFromWindow(window, 'https://mall.test')).resolves.toMatchObject({
      accessToken: 'a2', refreshToken: 'r2'
    })
  })

  it('lets the Alipay cashier navigate but keeps blocking other external origins', () => {
    const window = openMallWindow(context)
    const calls = vi.mocked(window.webContents.on).mock.calls as unknown as
      Array<[string, (...args: never[]) => void]>
    const call = calls.find(([event]) => event === 'will-navigate')
    expect(call).toBeTruthy()
    const navigate = call![1] as (event: { preventDefault: () => void }, target: string) => void

    const gateway = { preventDefault: vi.fn() }
    navigate(gateway, 'https://openapi.alipay.com/gateway.do?out_trade_no=1')
    expect(gateway.preventDefault).not.toHaveBeenCalled()

    const cashier = { preventDefault: vi.fn() }
    navigate(cashier, 'https://excashier.alipay.com/standard/auth.htm?payOrderId=1')
    expect(cashier.preventDefault).not.toHaveBeenCalled()

    const sameOrigin = { preventDefault: vi.fn() }
    navigate(sameOrigin, 'https://mall.test/order/1')
    expect(sameOrigin.preventDefault).not.toHaveBeenCalled()

    const evil = { preventDefault: vi.fn() }
    navigate(evil, 'https://evil.test/phish')
    expect(evil.preventDefault).toHaveBeenCalled()
  })

  it('allows Alipay popups but denies other external popups', () => {
    const window = openMallWindow(context)
    const handler = vi.mocked(window.webContents.setWindowOpenHandler).mock.calls[0][0] as
      (details: { url: string }) => { action: string }
    expect(handler({ url: 'https://openapi.alipay.com/gateway.do' }).action).toBe('allow')
    expect(handler({ url: 'https://evil.test/phish' })).toEqual({ action: 'deny' })
  })

  it('rejects remote plain HTTP before creating a window', () => {
    expect(() => openMallWindow({ baseUrl: 'http://mall.test', tenantId: 162 }))
      .toThrow(/HTTPS/)
    expect(BrowserWindow).not.toHaveBeenCalled()
  })

  it('closes both login and mall windows', async () => {
    const login = await openMallLoginWindow(context)
    const mall = openMallWindow(context)
    closeMallWindows()
    expect(login.destroy).toHaveBeenCalled()
    expect(mall.destroy).toHaveBeenCalled()
  })
})
