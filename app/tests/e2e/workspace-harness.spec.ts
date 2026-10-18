import { resolve } from 'node:path'
import { buildSync } from 'esbuild'
import { expect, test } from '@playwright/test'
import { launchApp, openHarnessWindow } from './fixtures/electron-app'

test('keeps workspace rulers, fit modes, zoom and paper clipping correct', async () => {
  test.setTimeout(120_000)
  const code = buildSync({
    entryPoints: [resolve(__dirname, 'harness/workspace.tsx')],
    bundle: true,
    platform: 'browser',
    format: 'iife',
    globalName: 'workspaceHarness',
    write: false,
    jsx: 'automatic',
    target: 'es2022'
  }).outputFiles[0].text

  const launched = await launchApp()
  try {
    const page = await openHarnessWindow(launched.app)
    await page.evaluate(`${code}\nworkspaceHarness.mount()`)

    const large = (await page.evaluate('workspaceHarness.geometry()')) as { width: number }
    await launched.app.evaluate(({ BrowserWindow }) => {
      const win = BrowserWindow.getAllWindows().find((item) => item.webContents.getURL() === 'about:blank')
      win?.setContentSize(640, 480)
    })
    await page.evaluate('workspaceHarness.settle()')
    const small = (await page.evaluate('workspaceHarness.geometry()')) as { width: number }
    expect(small.width).toBeLessThan(large.width)

    await page.evaluate('workspaceHarness.redraw()')
    await page.evaluate('workspaceHarness.fitModes()')
    await page.evaluate('workspaceHarness.contextMenu()')

    const manual = await page.evaluate('workspaceHarness.manual()')
    await launched.app.evaluate(({ BrowserWindow }) => {
      const win = BrowserWindow.getAllWindows().find((item) => item.webContents.getURL() === 'about:blank')
      win?.setContentSize(900, 700)
    })
    await page.evaluate('workspaceHarness.settle()')
    expect(await page.evaluate('workspaceHarness.zoom()')).toBe(manual)

    await page.evaluate('workspaceHarness.fit()')
    await page.evaluate('workspaceHarness.paper()')
  } finally {
    await launched.close()
  }
})
