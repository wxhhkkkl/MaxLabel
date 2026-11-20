import { test, expect, type Page } from '@playwright/test'
import { launchApp } from './fixtures/electron-app'

async function createLabel(page: Page): Promise<void> {
  await page.locator('[data-testid="toolbar"] button[title="新建标签模版"]').click()
  await page.locator('[data-testid="new-label-dialog"]').waitFor({ timeout: 10_000 })
  await page.locator('[data-testid="new-label-select"]').click()
  await expect(page.locator('[data-testid="toolbar"]')).toBeVisible({ timeout: 10_000 })
}

async function openBarcodeProps(page: Page): Promise<void> {
  await page.locator('[data-tool="barcode"]').click()
  await page.locator('canvas').first().click({ position: { x: 420, y: 320 }, force: true })
  await page.waitForTimeout(300)
  await page.keyboard.press('Alt+Enter')
  await page.locator('[data-testid="object-props-dialog"]').waitFor({ timeout: 10_000 })
  await page.locator('[data-testid="object-props-tab-barcode"]').click()
}

/** 一维码反白：条码特殊选项里的复选框，保存后重新打开仍生效。 */
test('一维码可以设置反白（白码黑底）', async () => {
  const launched = await launchApp()
  const w = launched.window
  try {
    await createLabel(w)
    await openBarcodeProps(w)

    const inverse = w.locator('[data-testid="barcode-inverse"]')
    await expect(inverse).toBeVisible()
    await inverse.check()
    await expect(inverse).toBeChecked()
    await w.locator('[data-testid="object-props-ok"]').click()
    await expect(w.locator('[data-testid="object-props-dialog"]')).toHaveCount(0)

    // 重新打开确认写入模型
    await w.locator('canvas').first().click({ position: { x: 420, y: 320 }, force: true })
    await w.keyboard.press('Alt+Enter')
    await w.locator('[data-testid="object-props-dialog"]').waitFor({ timeout: 10_000 })
    await w.locator('[data-testid="object-props-tab-barcode"]').click()
    await expect(w.locator('[data-testid="barcode-inverse"]')).toBeChecked()
  } finally {
    await launched.close()
  }
})
