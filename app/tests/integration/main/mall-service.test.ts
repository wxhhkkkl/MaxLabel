import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('electron', async () => (await import('../../helpers/electronMock')).createElectronMock())

import { BrowserWindow } from 'electron'
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
  it('opens the storefront login page in a sandboxed exact-origin window', () => {
    openMallLoginWindow(context)
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

  it('reuses the same login window for the same origin', () => {
    const first = openMallLoginWindow(context)
    const second = openMallLoginWindow(context)
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

  it('rejects remote plain HTTP before creating a window', () => {
    expect(() => openMallWindow({ baseUrl: 'http://mall.test', tenantId: 162 }))
      .toThrow(/HTTPS/)
    expect(BrowserWindow).not.toHaveBeenCalled()
  })

  it('closes both login and mall windows', () => {
    const login = openMallLoginWindow(context)
    const mall = openMallWindow(context)
    closeMallWindows()
    expect(login.destroy).toHaveBeenCalled()
    expect(mall.destroy).toHaveBeenCalled()
  })
})
