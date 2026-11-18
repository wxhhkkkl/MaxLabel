import { test, expect, type Page } from '@playwright/test'
import { launchApp } from './fixtures/electron-app'

/**
 * 「新建标签」里选过的介质类型和页面设置（左空/上空等）要记住：
 * 确定后再打开「新建标签」应保持上次的选择，而不是回到设置前的默认值。
 */

async function openNewLabel(page: Page): Promise<void> {
  await page.locator('[data-testid="toolbar"] button[title="新建标签模版"]').click()
  await page.locator('[data-testid="new-label-dialog"]').waitFor({ timeout: 10_000 })
}

test('新建标签记住介质类型与页面设置', async () => {
  const launched = await launchApp()
  const w = launched.window
  try {
    await openNewLabel(w)
    // 选一台真实队列，避免依赖本机默认打印机
    const printer = w.locator('[data-testid="new-label-printer"]')
    await w.waitForTimeout(1200)
    await printer.selectOption('Microsoft Print to PDF')
    await w.locator('[data-testid="new-label-media-roll"]').check()
    await w.locator('[data-testid="new-label-page-toggle"]').click()
    await w.locator('[data-testid="new-label-page-left"]').fill('2.5')
    await w.locator('[data-testid="new-label-page-top"]').fill('1.5')
    await w.locator('[data-testid="new-label-select"]').click()
    await expect(w.locator('[data-testid="new-label-dialog"]')).toHaveCount(0, { timeout: 10_000 })

    await openNewLabel(w)
    await expect(w.locator('[data-testid="new-label-media-roll"]')).toBeChecked()
    await w.locator('[data-testid="new-label-page-toggle"]').click()
    await expect(w.locator('[data-testid="new-label-page-left"]')).toHaveValue('2.5')
    await expect(w.locator('[data-testid="new-label-page-top"]')).toHaveValue('1.5')
  } finally {
    await launched.close()
  }
})
