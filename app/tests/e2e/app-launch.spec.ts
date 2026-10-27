import { test, expect } from '@playwright/test'
import { launchApp } from './fixtures/electron-app'

test('launches to the start page and creates a label', async () => {
  const launched = await launchApp()
  try {
    await expect(launched.window.locator('[data-testid="start-page"]')).toBeVisible()
    // 015：启动即最大化（不是全屏，任务栏仍可用）。
    expect(await launched.app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0]?.isMaximized())).toBe(true)

    // 新建直接进「选择标签格式」页，不再经过模板向导。
    await launched.window.locator('[data-testid="toolbar"] button[title="新建标签模版"]').click()
    await launched.window.locator('[data-testid="new-label-dialog"]').waitFor({ timeout: 10_000 })
    await launched.window.locator('[data-testid="new-label-select"]').click()
    await expect(launched.window.locator('[data-testid="toolbar"]')).toBeVisible({ timeout: 10_000 })
    await expect(launched.window.locator('[data-testid="start-page"]')).toHaveCount(0)
  } finally {
    await launched.close()
  }
})
