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

test('waits for every preview image to decode before printing the pages', async () => {
  const launched = await launchApp()
  try {
    const opening = launched.app.waitForEvent('window')
    const png = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a18kAAAAASUVORK5CYII='
    await launched.window.evaluate((url) => window.maxlabel.previewOpen({ pages: [url, url], widthMm: 50, heightMm: 30 }), png)
    const preview = await opening
    await expect(preview.locator('#ppage')).toHaveText('1/2')
    await preview.evaluate(() => {
      const second = document.querySelectorAll('img')[1]
      let finish!: () => void
      const pending = new Promise<void>((resolve) => { finish = resolve })
      second.decode = () => pending
      const state = { calls: 0, finish }
      window.print = () => { state.calls += 1 }
      Object.assign(window, { previewPrintTest: state })
    })
    const print = preview.locator('#pprint')
    await print.click()
    await expect(print).toBeDisabled()
    const calls = () => preview.evaluate(() => (window as unknown as { previewPrintTest: { calls: number } }).previewPrintTest.calls)
    expect(await calls()).toBe(0)
    await preview.evaluate(() => (window as unknown as { previewPrintTest: { finish: () => void } }).previewPrintTest.finish())
    await expect.poll(calls).toBe(1)
    await expect(print).toBeEnabled()
  } finally {
    await launched.close()
  }
})
