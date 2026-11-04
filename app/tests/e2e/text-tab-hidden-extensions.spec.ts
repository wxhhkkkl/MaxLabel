import { test, expect, type Page } from '@playwright/test'
import { launchApp } from './fixtures/electron-app'

/**
 * 现场要求：文字属性「文本」页隐藏大小写转换及其下的扩展项
 * （子串、截短、字符数限制、控制字符说明），页面只保留类型与属性两组字段。
 * 数据模型与打印行为不变：既有模板里的这些字段仍按原逻辑输出。
 */

async function openTextTab(page: Page): Promise<void> {
  await page.locator('[data-testid="toolbar"] button[title="新建标签模版"]').click()
  await page.locator('[data-testid="new-label-dialog"]').waitFor({ timeout: 10_000 })
  await page.locator('[data-testid="new-label-select"]').click()
  await expect(page.locator('[data-testid="toolbar"]')).toBeVisible({ timeout: 10_000 })

  await page.locator('[data-tool="text"]').click()
  await page.locator('canvas').first().click({ position: { x: 300, y: 300 }, force: true })
  await page.keyboard.press('Alt+Enter')
  await page.locator('[data-testid="object-props-dialog"]').waitFor({ timeout: 10_000 })
  await page.locator('[data-testid="object-props-tab-text"]').click()
}

test('文本页只保留类型和属性，隐藏大小写转换及其下扩展项', async () => {
  const launched = await launchApp()
  const w = launched.window
  try {
    await openTextTab(w)

    // 保留的两组字段
    await expect(w.locator('[data-testid="text-group-type"]')).toBeVisible()
    await expect(w.locator('[data-testid="text-group-props"]')).toBeVisible()
    await expect(w.locator('[data-testid="text-align"]')).toBeVisible()
    await expect(w.locator('[data-testid="text-line-width"]')).toBeVisible()
    await expect(w.locator('[data-testid="text-vertical"]')).toBeVisible()
    await expect(w.locator('[data-testid="text-char-template-enabled"]')).toBeVisible()

    // 大小写转换及其下的扩展项按现场要求不再显示
    await expect(w.locator('[data-testid="text-case-conversion"]')).toHaveCount(0)
    await expect(w.getByText('大小写转换', { exact: true })).toHaveCount(0)
    await expect(w.locator('[data-testid="text-extensions"]')).toHaveCount(0)
    await expect(w.locator('[data-testid="text-cut-type"]')).toHaveCount(0)
    await expect(w.locator('[data-testid="text-length-limit"]')).toHaveCount(0)
    await expect(w.locator('[data-testid="text-pad-direction"]')).toHaveCount(0)
    await expect(w.locator('[data-testid="text-trim-direction"]')).toHaveCount(0)
    await expect(w.getByText('子串起始（0 起）', { exact: true })).toHaveCount(0)
  } finally {
    await launched.close()
  }
})
