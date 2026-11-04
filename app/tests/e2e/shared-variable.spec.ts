import { test, expect, type Page } from '@playwright/test'
import { launchApp } from './fixtures/electron-app'

/**
 * 现场要求：
 * 1. 切到键盘输入时保留原文字内容作为画布提示；
 * 2. 共享变量名只能是英文+数字且英文开头；
 * 3. 同名共享变量以最后一次保存为准（A 键盘输入 → B 常量，A 也跟着变）。
 */

async function createLabel(page: Page): Promise<void> {
  await page.locator('[data-testid="toolbar"] button[title="新建标签模版"]').click()
  await page.locator('[data-testid="new-label-dialog"]').waitFor({ timeout: 10_000 })
  await page.locator('[data-testid="new-label-select"]').click()
  await expect(page.locator('[data-testid="toolbar"]')).toBeVisible({ timeout: 10_000 })
}

async function createText(page: Page, x: number, y: number): Promise<void> {
  await page.locator('[data-tool="text"]').click()
  await page.locator('canvas').first().click({ position: { x, y }, force: true })
  await page.waitForTimeout(350)
}

async function openDataSourceTab(page: Page): Promise<void> {
  await page.keyboard.press('Alt+Enter')
  await page.locator('[data-testid="object-props-dialog"]').waitFor({ timeout: 10_000 })
  await page.locator('[data-testid="object-props-tab-datasource"]').click()
}

test('键盘输入保留原文字提示；共享名只允许英文数字；最后保存的共享设置覆盖其它对象', async () => {
  const launched = await launchApp()
  const w = launched.window
  try {
    await createLabel(w)
    await createText(w, 150, 150)
    const aId = await w.locator('[data-testid="layer-object-row"]').first().getAttribute('data-object-id')
    if (!aId) throw new Error('missing A id')

    await openDataSourceTab(w)
    await w.locator('[data-testid="constant-source-value"]').fill('AAAA')
    await w.locator('[data-testid="source-kind-select"]').selectOption('keyboard')
    // 切换后自动带入原常量内容
    await expect(w.locator('[data-testid="keyboard-placeholder"]')).toHaveValue('AAAA')
    // 非法字符与开头数字会被清洗
    await w.locator('[data-testid="source-shared-name"]').fill('ha-ha 1')
    await expect(w.locator('[data-testid="source-shared-name"]')).toHaveValue('haha1')
    await w.locator('[data-testid="object-props-ok"]').click()
    await expect(w.locator('[data-testid="object-props-dialog"]')).toHaveCount(0)

    // B 后设置为同名共享变量的常量来源
    await createText(w, 750, 500)
    await openDataSourceTab(w)
    await w.locator('[data-testid="constant-source-value"]').fill('BBBB')
    await w.locator('[data-testid="source-shared-name"]').fill('haha1')
    await w.locator('[data-testid="object-props-ok"]').click()

    // 回到 A：应以 B 的最后设置为准
    await w.locator(`[data-testid="layer-object-row"][data-object-id="${aId}"]`).click()
    await openDataSourceTab(w)
    await expect(w.locator('[data-testid="source-kind-select"]')).toHaveValue('constant')
    await expect(w.locator('[data-testid="constant-source-value"]')).toHaveValue('BBBB')
    await expect(w.locator('[data-testid="source-shared-name"]')).toHaveValue('haha1')
  } finally {
    await launched.close()
  }
})
