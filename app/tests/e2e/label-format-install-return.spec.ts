import { test, expect, type Page } from '@playwright/test'
import { launchApp } from './fixtures/electron-app'

/**
 * 在「标签格式设置」（当前标签）里点「安装」打印机后，返回应回到标签格式设置，
 * 而不是变成「选择标签格式」（否则再点确定会新建一个标签）。
 */

async function createLabel(page: Page): Promise<void> {
  await page.locator('[data-testid="toolbar"] button[title="新建标签模版"]').click()
  await page.locator('[data-testid="new-label-dialog"]').waitFor({ timeout: 10_000 })
  await page.locator('[data-testid="new-label-param-width"]').fill('60')
  await page.locator('[data-testid="new-label-param-height"]').fill('40')
  await page.locator('[data-testid="new-label-select"]').click()
  await expect(page.locator('[data-testid="toolbar"]')).toBeVisible({ timeout: 10_000 })
}

test('标签格式设置里安装打印机后返回原对话框，确定不会新建标签', async () => {
  const launched = await launchApp()
  const w = launched.window
  try {
    await createLabel(w)
    const tabsBefore = await w.locator('[data-testid="document-tab"]').count()

    await w.locator('canvas').first().dblclick({ position: { x: 120, y: 120 }, force: true })
    const dialog = w.locator('[data-testid="new-label-dialog"]')
    await expect(dialog).toBeVisible({ timeout: 10_000 })
    await expect(dialog).toHaveAttribute('aria-label', '标签格式设置')

    await w.locator('[data-testid="new-label-install"]').click()
    await expect(w.locator('[data-testid="printer-install-dialog"]')).toBeVisible({ timeout: 10_000 })
    await w.locator('[data-testid="printer-install-back"]').click()

    // 返回后仍是「标签格式设置」而不是「选择标签格式」
    await expect(w.locator('[data-testid="new-label-dialog"]')).toBeVisible({ timeout: 10_000 })
    await expect(w.locator('[data-testid="new-label-dialog"]')).toHaveAttribute('aria-label', '标签格式设置')

    await w.locator('[data-testid="new-label-select"]').click()
    await expect(w.locator('[data-testid="new-label-dialog"]')).toHaveCount(0, { timeout: 10_000 })
    await w.waitForTimeout(400)
    expect(await w.locator('[data-testid="document-tab"]').count()).toBe(tabsBefore)
  } finally {
    await launched.close()
  }
})
