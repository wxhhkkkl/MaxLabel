import { test, expect, type Page } from '@playwright/test'
import { launchApp } from './fixtures/electron-app'

async function createLabel(page: Page): Promise<void> {
  await page.locator('[data-testid="toolbar"] button[title="新建标签模版"]').click()
  await page.locator('[data-testid="new-label-dialog"]').waitFor({ timeout: 10_000 })
  await page.locator('[data-testid="new-label-select"]').click()
  await expect(page.locator('[data-testid="toolbar"]')).toBeVisible({ timeout: 10_000 })
}

test('Ctrl+A 只选画布对象，不选界面文字', async () => {
  const launched = await launchApp()
  const w = launched.window
  try {
    // 起始页：不能选中任何界面文字
    await w.keyboard.press('Control+a')
    expect(await w.evaluate(() => String(window.getSelection() ?? ''))).toBe('')

    await createLabel(w)
    await w.locator('[data-tool="text"]').click()
    await w.locator('canvas').first().click({ position: { x: 300, y: 250 }, force: true })
    await w.locator('[data-tool="barcode"]').click()
    await w.locator('canvas').first().click({ position: { x: 500, y: 300 }, force: true })
    await w.keyboard.press('Escape')
    await w.locator('canvas.upper-canvas').click({ position: { x: 20, y: 20 } })
    await w.keyboard.press('Control+a')

    // 只选中两个真实对象，文字对象 + 条码对象；没有辅助层/界面元素
    const selection = JSON.parse(
      (await w.locator('[data-active-fabric-selection]').getAttribute('data-active-fabric-selection')) ?? '{}'
    ) as { ids?: string[] }
    expect(selection.ids).toHaveLength(2)
    expect(await w.evaluate(() => String(window.getSelection() ?? ''))).toBe('')
  } finally {
    await launched.close()
  }
})
