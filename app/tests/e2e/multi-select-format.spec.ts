import { test, expect, type Page } from '@playwright/test'
import { launchApp } from './fixtures/electron-app'

async function createLabel(page: Page): Promise<void> {
  await page.locator('[data-testid="toolbar"] button[title="新建标签模版"]').click()
  await page.locator('[data-testid="new-label-dialog"]').waitFor({ timeout: 10_000 })
  await page.locator('[data-testid="new-label-select"]').click()
  await expect(page.locator('[data-testid="toolbar"]')).toBeVisible({ timeout: 10_000 })
}

/** 多选文字后，格式栏的粗体/字体应作用于**所有**选中文字，而不只是第一个。 */
test('多选文字后加粗作用于全部选中对象', async () => {
  const launched = await launchApp()
  const w = launched.window
  try {
    await createLabel(w)
    const canvas = w.locator('canvas').first()
    await w.locator('[data-tool="text"]').click()
    await canvas.click({ position: { x: 260, y: 240 }, force: true })
    await w.waitForTimeout(300)
    await w.locator('[data-tool="text"]').click()
    await canvas.click({ position: { x: 520, y: 300 }, force: true })
    await w.waitForTimeout(300)

    await w.keyboard.press('Control+A')
    await w.locator('[data-testid="format-bar"] button[title="粗体"]').click()
    await w.waitForTimeout(400)

    for (const position of [{ x: 260, y: 240 }, { x: 520, y: 300 }]) {
      await canvas.click({ position, force: true })
      await w.waitForTimeout(200)
      await w.keyboard.press('Alt+Enter')
      await expect(w.locator('[data-testid="object-props-dialog"]')).toBeVisible({ timeout: 10_000 })
      await w.locator('[data-testid="object-props-tab-font"]').click()
      await expect(w.locator('[data-testid="text-font-style"]')).toHaveValue('bold')
      await w.locator('[data-testid="object-props-ok"]').click()
      await w.waitForTimeout(200)
    }
  } finally {
    await launched.close()
  }
})
