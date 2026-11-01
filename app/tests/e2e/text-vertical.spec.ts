import { test, expect, type Page } from '@playwright/test'
import { launchApp } from './fixtures/electron-app'

/**
 * 竖排文字（020 现场需求）：文字对象 → 文本页 → 勾选「竖排（从上到下）」。
 * 这里钉住开关存在且能保存；具体排布由 shared 的 `verticalText` 单测保证。
 */

async function createLabel(page: Page): Promise<void> {
  await page.locator('[data-testid="toolbar"] button[title="新建标签模版"]').click()
  await page.locator('[data-testid="new-label-dialog"]').waitFor({ timeout: 10_000 })
  await page.locator('[data-testid="new-label-select"]').click()
  await expect(page.locator('[data-testid="toolbar"]')).toBeVisible({ timeout: 10_000 })
}

test('文字属性里可以勾选竖排，重新打开后仍保留', async () => {
  const launched = await launchApp()
  const w = launched.window
  try {
    await createLabel(w)
    await w.locator('[data-tool="text"]').click()
    await w.locator('canvas').first().click({ position: { x: 300, y: 300 }, force: true })
    await w.keyboard.press('Alt+Enter')
    await expect(w.locator('[data-testid="object-props-dialog"]')).toBeVisible({ timeout: 10_000 })

    await w.locator('[data-testid="object-props-tab-text"]').click()
    const vertical = w.locator('[data-testid="text-vertical"]')
    await expect(vertical).toBeVisible({ timeout: 10_000 })
    await expect(vertical).not.toBeChecked()
    // 单行未竖排时没有「行距」（那是多行字段）
    await expect(w.locator('[data-testid="text-line-spacing"]')).toHaveCount(0)
    await vertical.check()
    // 竖排后字符间距 = 行距，必须可调
    await expect(w.locator('[data-testid="text-line-spacing"]')).toHaveCount(1)
    await w.locator('[data-testid="text-line-spacing"]').fill('1')
    await w.locator('[data-testid="object-props-ok"]').click()

    // 重开确认已保存
    await w.keyboard.press('Alt+Enter')
    await expect(w.locator('[data-testid="object-props-dialog"]')).toBeVisible({ timeout: 10_000 })
    await w.locator('[data-testid="object-props-tab-text"]').click()
    await expect(w.locator('[data-testid="text-vertical"]')).toBeChecked()
  } finally {
    await launched.close()
  }
})
