import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('electron', async () => (await import('../../helpers/electronMock')).createElectronMock())

import { BrowserWindow, session } from 'electron'
import {
  clearMallSession,
  closeMallWindows,
  openMallWindow,
  syncMallSession
} from '@main/mallService'

const context = { baseUrl: 'https://mall.test', tenantId: 162 }
const tokens = { accessToken: 'access-1', refreshToken: 'refresh-1', expiresTime: 123 }

afterEach(() => {
  closeMallWindows()
  vi.mocked(BrowserWindow).mockClear()
})

describe('mall service windows', () => {
  it('opens the storefront in a sandboxed exact-origin window', () => {
    openMallWindow(context)
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
    expect(window.loadURL).toHaveBeenCalledWith('https://mall.test/')
    expect(window.webContents.setWindowOpenHandler).toHaveBeenCalled()
  })

  it('reuses the same mall window for the same origin', () => {
    const first = openMallWindow(context)
    const second = openMallWindow(context, '/membership')
    expect(second).toBe(first)
    expect(BrowserWindow).toHaveBeenCalledTimes(1)
    expect(first.loadURL).toHaveBeenLastCalledWith('https://mall.test/membership')
  })

  it('writes refreshed tokens into its localStorage', () => {
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

  it('seeds tokens into a storefront window opened after an in-app login', async () => {
    syncMallSession(context, tokens)
    const window = openMallWindow(context, '/membership')
    vi.mocked(window.webContents.getURL).mockReturnValue('https://mall.test/membership')
    vi.mocked(window.webContents.executeJavaScript).mockResolvedValue(true)

    const finishLoad = (vi.mocked(window.webContents.on).mock.calls as unknown as
      Array<[string, () => void]>).find(([event]) => event === 'did-finish-load')?.[1]
    expect(finishLoad).toBeTruthy()
    finishLoad!()

    await vi.waitFor(() => expect(window.webContents.executeJavaScript).toHaveBeenCalledWith(
      expect.stringContaining('access-1'), true))
    await vi.waitFor(() => expect(window.webContents.reload).toHaveBeenCalled())
  })

  it('reloads an open storefront once when an in-app login changes the tokens', async () => {
    const window = openMallWindow(context)
    vi.mocked(window.webContents.getURL).mockReturnValue('https://mall.test/')
    vi.mocked(window.webContents.executeJavaScript).mockResolvedValue(true)

    syncMallSession(context, tokens, { reload: true })

    await vi.waitFor(() => expect(window.webContents.reload).toHaveBeenCalledTimes(1))
  })

  it('does not reload an open storefront on a routine token refresh', async () => {
    const window = openMallWindow(context)
    vi.mocked(window.webContents.getURL).mockReturnValue('https://mall.test/')
    vi.mocked(window.webContents.executeJavaScript).mockResolvedValue(true)

    syncMallSession(context, tokens)

    await vi.waitFor(() => expect(window.webContents.executeJavaScript).toHaveBeenCalled())
    expect(window.webContents.reload).not.toHaveBeenCalled()
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

  it('closes the storefront window', () => {
    const mall = openMallWindow(context)
    closeMallWindows()
    expect(mall.destroy).toHaveBeenCalled()
  })

  it('clears the storefront localStorage on logout so the next account starts clean', async () => {
    const mall = openMallWindow(context)
    await clearMallSession(context)
    expect(mall.destroy).toHaveBeenCalled()
    expect(session.defaultSession.clearStorageData).toHaveBeenCalledWith({
      origin: 'https://mall.test',
      storages: ['localstorage']
    })
  })
})
