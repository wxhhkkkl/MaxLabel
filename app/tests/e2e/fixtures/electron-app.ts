import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { _electron as electron, type ElectronApplication, type Page } from 'playwright'

export const appRoot = resolve(__dirname, '../../..')

export interface LaunchedApp {
  app: ElectronApplication
  window: Page
  userDataDir: string
  close(): Promise<void>
}

function childEnv(appDataDir: string, extra: Record<string, string>): Record<string, string> {
  const env = Object.fromEntries(
    Object.entries(process.env).filter((entry): entry is [string, string] => entry[1] !== undefined)
  )
  delete env.ELECTRON_RUN_AS_NODE
  env.APPDATA = appDataDir
  return { ...env, ...extra }
}

async function dismissFirstRun(window: Page): Promise<void> {
  // The first-run guide is opened from a React effect after the start page renders.
  await window.keyboard.press('Escape').catch(() => undefined)
  await window.waitForTimeout(200)
  const dialog = window.locator('[data-testid="get-started-dialog"]')
  try {
    await dialog.waitFor({ state: 'visible', timeout: 3000 })
    await dialog.locator('button[aria-label="关闭"]').click()
    await dialog.waitFor({ state: 'hidden', timeout: 3000 })
  } catch {
    // No first-run dialog on this profile; nothing to dismiss.
  }
  await window.keyboard.press('Escape').catch(() => undefined)
  await window.waitForTimeout(150)
}

export async function launchApp(
  env: Record<string, string> = {},
  options: { dismissFirstRun?: boolean } = {}
): Promise<LaunchedApp> {
  const userDataDir = await mkdtemp(join(tmpdir(), 'maxlabel-e2e-'))
  const app = await electron.launch({
    cwd: appRoot,
    args: ['.', `--user-data-dir=${join(userDataDir, 'chromium')}`],
    // E2E 默认注入“企业版”授权（仅非打包构建生效），让既有用例可以新建/编辑；
    // 只读与版本限制用例通过传入相同的环境变量覆盖。
    env: childEnv(userDataDir, { MAXLABEL_TEST_ENTITLEMENT: 'enterprise', ...env }),
    timeout: 30_000
  })
  const window = await app.firstWindow()
  await window.waitForLoadState('domcontentloaded')
  await window.locator('[data-testid="start-page"]').waitFor({ timeout: 15_000 })
  if (options.dismissFirstRun !== false) await dismissFirstRun(window)

  return {
    app,
    window,
    userDataDir,
    async close() {
      try {
        await app.evaluate(({ app: electronApp }) => electronApp.exit(0))
      } catch {
        // The app may already be exiting.
      }
      const child = app.process()
      if (child && !child.killed) {
        await Promise.race([
          new Promise<void>((resolveExit) => child.once('exit', () => resolveExit())),
          new Promise<void>((resolveTimeout) => setTimeout(resolveTimeout, 3_000))
        ])
        if (!child.killed) child.kill()
      }
      await rm(userDataDir, { recursive: true, force: true }).catch(() => undefined)
    }
  }
}

/** Write a minimal valid `.msdx` fixture and return its path. */
export async function writeFixtureTemplate(dir: string, name = `e2e-${Date.now()}.msdx`): Promise<string> {
  const path = join(dir, name)
  const envelope = {
    format: 'maxlabel-msdx',
    version: 2,
    app: 'MaxLabel',
    doc: {
      version: 2,
      name: 'E2E 测试',
      widthMm: 60,
      heightMm: 40,
      objects: [
        {
          id: 'text-1',
          type: 'text',
          x: 4,
          y: 4,
          w: 40,
          h: 6,
          rotation: 0,
          fontFamily: 'Arial',
          fontSize: 5,
          bold: false,
          align: 'left',
          color: '#000000',
          source: { kind: 'constant', value: 'E2E' }
        }
      ]
    }
  }
  await writeFile(path, JSON.stringify(envelope, null, 2), 'utf8')
  return path
}

/** Create a hidden blank BrowserWindow and return its Playwright page. */
export async function openHarnessWindow(app: ElectronApplication): Promise<Page> {
  const before = new Set(app.windows())
  const nextWindow = app.waitForEvent('window', {
    predicate: (page) => !before.has(page),
    timeout: 15_000
  })
  await app.evaluate(async ({ BrowserWindow }) => {
    const win = new BrowserWindow({
      show: false,
      width: 1000,
      height: 800,
      webPreferences: { backgroundThrottling: false, sandbox: true }
    })
    await win.loadURL('about:blank')
  })
  const page = await nextWindow
  await page.waitForLoadState('domcontentloaded')
  return page
}

/** Create a fixture directory + template that lives outside the app profile. */
export async function makeFixtureTemplate(): Promise<{ dir: string; path: string }> {
  const dir = await mkdtemp(join(tmpdir(), 'maxlabel-fixture-'))
  return { dir, path: await writeFixtureTemplate(dir) }
}

/**
 * Open a template through the existing MAXLABEL_OPEN_PATH hook. Pass the path to
 * launchApp as `{ MAXLABEL_OPEN_PATH: path }`; the main process reads it when the
 * open command runs.
 */
/**
 * 打开应用内「打印机设置」页。编辑态的「文件」菜单没有该入口（只有启始页有），
 * 面板上的「设置」按钮对 Windows 队列打印机会打开 Windows 属性 —— 所以走打印对话框的「打印机属性」。
 */
export async function openPrinterSettingsFromPrintDialog(
  page: Page,
  labels: { print: string; close: string } = { print: '打印', close: '关闭打印对话框' }
): Promise<void> {
  await page.locator(`[data-testid="toolbar"] [title="${labels.print}"]`).click()
  await page.locator('[data-testid="print-dialog"]').waitFor({ timeout: 10_000 })
  await page.locator('[data-testid="print-dialog-printer-properties"]').click()
  await page.locator('[data-testid="printer-settings-dialog"]').waitFor({ timeout: 10_000 })
}

/** 关闭打印对话框（从打印机设置返回后）。 */
export async function closePrintDialog(page: Page, label = '关闭打印对话框'): Promise<void> {
  await page.locator(`[data-testid="print-dialog"] button[aria-label="${label}"]`).click()
  await page.locator('[data-testid="print-dialog"]').waitFor({ state: 'detached', timeout: 10_000 })
}

/** 图形工具：点开图形面板并选中指定形状（默认方形）。 */
export async function pickShapeTool(page: Page, shape = 'rect'): Promise<void> {
  await page.locator('[data-tool="rect"]').click()
  await page.locator(`[data-testid="shape-pick-${shape}"]`).click()
}

/**
 * 把当前模板的端口固定成「Windows 驱动打印」。
 *
 * 新建标签会选中本机第一台打印机，端口随机器环境变化（可能是 USB 直连）；
 * 变色设置只在驱动端口下提供，涉及它的用例必须先把端口固定下来。
 */
export async function setDocumentPortToDriver(page: Page): Promise<void> {
  await openPrinterSettingsFromPrintDialog(page)
  await page.locator('[data-testid="printer-settings-port-tab"]').click()
  await page.locator('[data-testid="printer-port-type"]').selectOption('driver')
  await page.locator('[data-testid="printer-settings-save"]').click()
  await closePrintDialog(page)
}

export async function openFixture(window: Page): Promise<void> {
  const startLink = window.locator('[title="打开本机上保存的标签格式模板"]')
  const toolbarOpen = window.locator('[title="打开标签模版"]')
  for (let attempt = 0; attempt < 2; attempt++) {
    if (await startLink.count()) await startLink.click()
    else await toolbarOpen.click()
    await window.waitForTimeout(500)
    if (!(await window.locator('[data-testid="start-page"]').isVisible().catch(() => false))) break
    // A lingering first-run/other modal may have consumed the first click.
    await window.keyboard.press('Escape').catch(() => undefined)
    await window.waitForTimeout(200)
  }
  await window.locator('[data-testid="start-page"]').waitFor({ state: 'hidden', timeout: 15_000 })
  await window.locator('[data-testid="toolbar"]').waitFor({ timeout: 15_000 })
}
