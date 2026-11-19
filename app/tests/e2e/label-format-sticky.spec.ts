import { test, expect, type Page } from '@playwright/test'
import { launchApp } from './fixtures/electron-app'

/**
 * 「新建标签」的默认介质一律是卷筒标签；页面设置（左空/上空等）仍要记住：
 * 确定后再打开「新建标签」应保持上次的页面设置，但介质不再恢复上次的平张。
 */

async function openNewLabel(page: Page): Promise<void> {
  await page.locator('[data-testid="toolbar"] button[title="新建标签模版"]').click()
  await page.locator('[data-testid="new-label-dialog"]').waitFor({ timeout: 10_000 })
}

test('新建标签对普通 Windows 驱动也默认卷筒标签', async () => {
  const launched = await launchApp()
  const w = launched.window
  try {
    await openNewLabel(w)
    await w.waitForTimeout(1200)
    // 普通页式驱动（旧逻辑会按驱动推断成平张）
    await w.locator('[data-testid="new-label-printer"]').selectOption('Microsoft Print to PDF')
    await expect(w.locator('[data-testid="new-label-media-roll"]')).toBeChecked()
    await expect(w.locator('[data-testid="new-label-media-sheet"]')).not.toBeChecked()
    // 默认值改了，但仍能手动切回平张
    await w.locator('[data-testid="new-label-media-sheet"]').check()
    await expect(w.locator('[data-testid="new-label-media-sheet"]')).toBeChecked()
    // 重新选择打印机后介质回到卷筒默认
    await w.locator('[data-testid="new-label-printer"]').selectOption('Microsoft Print to PDF')
    await expect(w.locator('[data-testid="new-label-media-roll"]')).toBeChecked()
  } finally {
    await launched.close()
  }
})

test('新建标签不恢复上次的平张介质，但仍记住页面设置', async () => {
  const launched = await launchApp()
  const w = launched.window
  try {
    await openNewLabel(w)
    // 选一台真实队列，避免依赖本机默认打印机
    const printer = w.locator('[data-testid="new-label-printer"]')
    await w.waitForTimeout(1200)
    await printer.selectOption('Microsoft Print to PDF')
    await w.locator('[data-testid="new-label-media-sheet"]').check()
    await w.locator('[data-testid="new-label-page-toggle"]').click()
    await w.locator('[data-testid="new-label-page-left"]').fill('2.5')
    await w.locator('[data-testid="new-label-page-top"]').fill('1.5')
    await w.locator('[data-testid="new-label-select"]').click()
    await expect(w.locator('[data-testid="new-label-dialog"]')).toHaveCount(0, { timeout: 10_000 })

    await openNewLabel(w)
    // 上次确认的是平张，但新建标签仍默认卷筒
    await expect(w.locator('[data-testid="new-label-media-roll"]')).toBeChecked()
    await expect(w.locator('[data-testid="new-label-media-sheet"]')).not.toBeChecked()
    // 页面设置照旧记住
    await w.locator('[data-testid="new-label-page-toggle"]').click()
    await expect(w.locator('[data-testid="new-label-page-left"]')).toHaveValue('2.5')
    await expect(w.locator('[data-testid="new-label-page-top"]')).toHaveValue('1.5')
  } finally {
    await launched.close()
  }
})
