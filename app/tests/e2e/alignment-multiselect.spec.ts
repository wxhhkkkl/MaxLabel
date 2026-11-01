import { test, expect, type Page } from '@playwright/test'
import { launchApp } from './fixtures/electron-app'

async function createLabel(page: Page): Promise<void> {
  await page.locator('[data-testid="toolbar"] button[title="新建标签模版"]').click()
  await page.locator('[data-testid="new-label-dialog"]').waitFor({ timeout: 10_000 })
  await page.locator('[data-testid="new-label-select"]').click()
  await expect(page.locator('[data-testid="toolbar"]')).toBeVisible({ timeout: 10_000 })
}

/**
 * 对齐命令会改文档并触发画布全量重建。重建后必须把「整组选中」装回去，
 * 否则多选降成单选，对齐/尺寸/间距按钮用一次就置灰，无法连续操作。
 */
test('alignment keeps the multi-selection for repeated commands', async () => {
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
    const alignLeft = w.locator('[data-testid="align-bar"] button[title="左齐"]')
    await expect(alignLeft).toBeEnabled()
    await alignLeft.click()

    // 对齐后选中集仍是两个：按钮保持可用，DOM 快照里也能读到两个 id。
    await expect(w.locator('[data-testid="align-bar"] button[title="左齐"]')).toBeEnabled()
    const selection = JSON.parse(
      (await w.locator('[data-active-fabric-selection]').first().getAttribute('data-active-fabric-selection')) ?? '{}'
    )
    expect(selection.ids).toHaveLength(2)
  } finally {
    await launched.close()
  }
})
