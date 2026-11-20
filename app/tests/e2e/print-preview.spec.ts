import { rm } from 'node:fs/promises'
import { test, expect } from '@playwright/test'
import { launchApp, makeFixtureTemplate, openFixture } from './fixtures/electron-app'

test('opens the print preview window and renders one page', async () => {
  const fixture = await makeFixtureTemplate()
  const launched = await launchApp({ MAXLABEL_OPEN_PATH: fixture.path })
  try {
    await openFixture(launched.window)

    const previewPromise = launched.app.waitForEvent('window', { timeout: 15_000 })
    await launched.window.locator('[title="打印预览"]').click()
    const preview = await previewPromise
    await preview.waitForLoadState('domcontentloaded')

    await expect(preview.locator('#ppage')).toHaveText('1/1', { timeout: 15_000 })
    const image = preview.locator('.page img').first()
    await expect
      .poll(() => image.evaluate((element) => (element as HTMLImageElement).naturalWidth), { timeout: 15_000 })
      .toBeGreaterThan(0)

    const closed = preview.waitForEvent('close', { timeout: 10_000 })
    await preview.locator('#pclose').click()
    await closed
  } finally {
    await launched.close()
    await rm(fixture.dir, { recursive: true, force: true }).catch(() => undefined)
  }
})

test('submits through the normal print workflow when printing from preview', async () => {
  const fixture = await makeFixtureTemplate()
  const launched = await launchApp({ MAXLABEL_OPEN_PATH: fixture.path })
  try {
    await openFixture(launched.window)
    await launched.app.evaluate(({ ipcMain }) => {
      for (const channel of ['print-label', 'print:command']) {
        ipcMain.removeHandler(channel)
        ipcMain.handle(channel, () => ({ ok: true, status: 'accepted' }))
      }
    })
    const opening = launched.app.waitForEvent('window')
    await launched.window.locator('[title="打印预览"]').click()
    const preview = await opening
    await expect(preview.locator('#ppage')).toHaveText('1/1')
    await preview.evaluate(() => {
      // Guard the regression test against opening the system print dialog on the old implementation.
      window.print = () => undefined
    })
    await preview.locator('#pprint').click()
    await expect.poll(() => launched.window.evaluate(async () => (await window.maxlabel.listPrintLogs()).logs?.length ?? 0)).toBe(1)
  } finally {
    await launched.close()
    await rm(fixture.dir, { recursive: true, force: true }).catch(() => undefined)
  }
})
