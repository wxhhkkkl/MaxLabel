import { test, expect, type Page } from '@playwright/test'
import { launchApp } from './fixtures/electron-app'

/**
 * 打印面板与「标签格式设置」共用同一份打印机设置：
 * 在右侧面板选打印机 → 标签格式设置里显示同一台；在标签格式设置里改 → 右侧面板同步。
 */

async function createLabel(page: Page): Promise<void> {
  await page.locator('[data-testid="toolbar"] button[title="新建标签模版"]').click()
  await page.locator('[data-testid="new-label-dialog"]').waitFor({ timeout: 10_000 })
  await page.locator('[data-testid="new-label-param-width"]').fill('60')
  await page.locator('[data-testid="new-label-param-height"]').fill('40')
  await page.locator('[data-testid="new-label-select"]').click()
  await expect(page.locator('[data-testid="toolbar"]')).toBeVisible({ timeout: 10_000 })
}

test('打印面板与标签格式设置的打印机设置共通', async () => {
  const launched = await launchApp()
  const w = launched.window
  try {
    await createLabel(w)
    const dock = w.locator('[data-testid="print-printer"]')
    await expect(dock).toBeVisible({ timeout: 10_000 })
    await w.waitForTimeout(1500)
    const values = await dock.locator('option').evaluateAll((options) => options.map((option) => (option as HTMLOptionElement).value))
    const first = values.includes('Microsoft Print to PDF') ? 'Microsoft Print to PDF' : values.find((value) => value.startsWith('Microsoft') || value.includes('LaserJet'))
    expect(first).toBeTruthy()

    // 1) 右侧面板选打印机 → 标签格式设置里应同步选中
    await dock.selectOption(first!)
    await w.waitForTimeout(400)
    await w.locator('canvas').first().dblclick({ position: { x: 120, y: 120 }, force: true })
    await expect(w.locator('[data-testid="new-label-dialog"]')).toBeVisible({ timeout: 10_000 })
    const dialogPrinter = w.locator('[data-testid="new-label-printer"]')
    await expect(dialogPrinter).toHaveValue(first!)

    // 2) 在标签格式设置里改打印机 → 右侧面板应同步
    const dialogValues = await dialogPrinter.locator('option').evaluateAll((options) => options.map((option) => (option as HTMLOptionElement).value))
    const second = dialogValues.find((value) => value && value !== first)
    expect(second).toBeTruthy()
    await dialogPrinter.selectOption(second!)
    await w.locator('[data-testid="new-label-select"]').click()
    await w.locator('[data-testid="new-label-dialog"]').waitFor({ state: 'detached', timeout: 10_000 })
    await w.waitForTimeout(500)
    await expect(dock).toHaveValue(second!)
  } finally {
    await launched.close()
  }
})
