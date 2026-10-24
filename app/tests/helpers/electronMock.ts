import { vi } from 'vitest'

export interface ElectronMockOptions {
  userDataDir?: string
  appPath?: string
}

/**
 * Build a fresh Electron module mock. Use with:
 *   vi.mock('electron', async () => (await import('./helpers/electronMock')).createElectronMock())
 */
export function createElectronMock(options: ElectronMockOptions = {}) {
  const userDataDir = options.userDataDir ?? 'C:/maxlabel-test-user-data'
  const appPath = options.appPath ?? process.cwd()

  const app = {
    isPackaged: false,
    getPath: vi.fn((name: string) => (name === 'userData' ? userDataDir : userDataDir)),
    getAppPath: vi.fn(() => appPath),
    getVersion: vi.fn(() => '1.0.22'),
    whenReady: vi.fn(async () => undefined),
    on: vi.fn(),
    once: vi.fn(),
    quit: vi.fn(),
    exit: vi.fn()
  }

  const safeStorage = {
    isEncryptionAvailable: vi.fn(() => false),
    encryptString: vi.fn((value: string) => Buffer.from(value, 'utf8')),
    decryptString: vi.fn((value: Buffer) => value.toString('utf8'))
  }

  const dialog = {
    showSaveDialog: vi.fn(),
    showOpenDialog: vi.fn(),
    showMessageBox: vi.fn(),
    showErrorBox: vi.fn()
  }

  const ipcMain = {
    handle: vi.fn(),
    removeHandler: vi.fn(),
    on: vi.fn(),
    removeAllListeners: vi.fn()
  }

  // 必须是普通函数：`new BrowserWindow(...)` 不能用箭头函数构造。
  const BrowserWindow = vi.fn(function () {
    return {
      loadURL: vi.fn(),
      loadFile: vi.fn(),
      on: vi.fn(),
      once: vi.fn(),
      show: vi.fn(),
      hide: vi.fn(),
      destroy: vi.fn(),
      isDestroyed: vi.fn(() => false),
      setContentSize: vi.fn(),
      webContents: {
        send: vi.fn(),
        executeJavaScript: vi.fn(async () => undefined),
        openDevTools: vi.fn(),
        getURL: vi.fn(() => ''),
        setWindowOpenHandler: vi.fn(),
        on: vi.fn()
      }
    }
  })

  const shell = {
    openPath: vi.fn(async () => ''),
    openExternal: vi.fn(async () => undefined)
  }

  const nativeImage = {
    createFromDataURL: vi.fn(() => ({ isEmpty: () => true }))
  }

  const clipboard = {
    writeImage: vi.fn(),
    readImage: vi.fn()
  }

  return {
    app,
    safeStorage,
    dialog,
    ipcMain,
    BrowserWindow,
    shell,
    nativeImage,
    clipboard,
    ClipboardItem: class ClipboardItem {}
  }
}
