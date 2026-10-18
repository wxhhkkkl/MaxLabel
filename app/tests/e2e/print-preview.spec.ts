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
