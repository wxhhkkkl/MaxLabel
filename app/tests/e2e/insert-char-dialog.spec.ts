import { test, expect, type Page } from '@playwright/test'
import { launchApp } from './fixtures/electron-app'

async function openBarcodeConstant(page: Page): Promise<void> {
  await page.locator('[data-testid="toolbar"] button[title="新建标签模版"]').click()
  await page.locator('[data-testid="new-label-dialog"]').waitFor({ timeout: 10_000 })
  await page.locator('[data-testid="new-label-select"]').click()
  await expect(page.locator('[data-testid="toolbar"]')).toBeVisible({ timeout: 10_000 })
  await page.locator('[data-tool="barcode"]').click()
  await page.locator('canvas').first().click({ position: { x: 420, y: 320 }, force: true })
  await page.waitForTimeout(400)
  await page.keyboard.press('Alt+Enter')
  await page.locator('[data-testid="object-props-dialog"]').waitFor({ timeout: 10_000 })
  await page.locator('[data-testid="object-props-tab-datasource"]').click()
}

/** 015：常量的控制字符改成「插入字符」弹窗选择，不再把所有按钮铺在页面上。 */
test('control characters are inserted through the dialog', async () => {
  const launched = await launchApp()
  const w = launched.window
  try {
    await openBarcodeConstant(w)

    // 页面上不再直接铺开 31 个控制符按钮
    await expect(w.locator('[data-testid="control-char-bar"]')).toHaveCount(0)
    await expect(w.locator('[data-testid="constant-insert-char"]')).toBeVisible()

    await w.locator('[data-testid="constant-insert-char"]').click()
    const dialog = w.locator('[data-testid="insert-char-dialog"]')
    await expect(dialog).toBeVisible()

    // 表头与首行内容对齐原版
    await expect(dialog).toContainText('字符名称')
    await expect(dialog).toContainText('ASCII值')
    await expect(dialog).toContainText('十六进制值')
    await expect(w.locator('[data-testid="insert-char-name-SOH"]')).toHaveText('标题开始')
    await expect(w.locator('[data-testid="insert-char-name-CR"]')).toHaveText('回车键')

    // 未选行时「插入」不可用
    await expect(w.locator('[data-testid="insert-char-insert"]')).toBeDisabled()

    await w.locator('[data-testid="insert-char-row-CR"]').click()
    await w.locator('[data-testid="insert-char-insert"]').click()
    await expect(dialog).toHaveCount(0)
    await expect(w.locator('[data-testid="constant-source-value"]')).toHaveValue('1234567890<CR>')
  } finally {
    await launched.close()
  }
})
