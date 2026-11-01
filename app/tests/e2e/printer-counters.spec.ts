import { test, expect } from '@playwright/test'
import { launchApp, makeFixtureTemplate } from './fixtures/electron-app'

/**
 * 打印机设置里的「设备计数器」：驱动端口读不到设备值时，
 * 必须显示本软件累计并说明原因，不能假装读到了设备终身计数。
 */
test('printer settings shows counters and explains unsupported ports', async () => {
  const fixture = await makeFixtureTemplate()
  const launched = await launchApp({ MAXLABEL_OPEN_PATH: fixture.path })
  const w = launched.window
  try {
    await w.locator('[data-testid="start-page"]').waitFor({ timeout: 15_000 })
    await w.locator('[data-testid="toolbar"] [title="打开标签模版"]').click()
    await w.locator('[data-testid="print-dock"]').waitFor({ timeout: 15_000 })
    await w.locator('[data-testid="print-printer-settings"]').click()

    await expect(w.locator('[data-testid="printer-counters"]')).toBeVisible()
    await w.locator('[data-testid="printer-counter-read"]').click()
    await expect(w.locator('[data-testid="printer-counter-local"]')).toBeVisible({ timeout: 10_000 })
    await expect(w.locator('[data-testid="printer-counter-notes"]')).toContainText('不支持')
  } finally {
    await launched.close()
  }
})
