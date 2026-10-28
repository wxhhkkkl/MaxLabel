import { test, expect, type Page } from '@playwright/test'
import { launchApp } from './fixtures/electron-app'

async function openAdvanced(page: Page): Promise<void> {
  await page.locator('[data-testid="toolbar"] button[title="新建标签模版"]').click()
  await page.locator('[data-testid="new-label-dialog"]').waitFor({ timeout: 10_000 })
  await page.locator('[data-testid="new-label-select"]').click()
  await expect(page.locator('[data-testid="toolbar"]')).toBeVisible({ timeout: 10_000 })
  await page.locator('[data-tool="barcode"]').click()
  await page.locator('canvas').first().click({ position: { x: 420, y: 320 }, force: true })
  await page.waitForTimeout(400)
  await page.keyboard.press('Alt+Enter')
  await page.locator('[data-testid="object-props-dialog"]').waitFor({ timeout: 10_000 })
  await page.locator('[data-testid="source-advanced"]').click()
}

/**
 * 015：设置类窗口切换页签时不允许改变大小——否则「确定/取消」跟着跳，很难点。
 * 做法是两个页签同时挂载、叠在同一个栅格里（Modal 的 TabPanels），高度取较高的那个。
 */
test('settings dialogs keep their size when switching tabs', async () => {
  const launched = await launchApp()
  const w = launched.window
  try {
    await openAdvanced(w)
    const dialog = w.locator('[data-testid="source-advanced-dialog"]')
    await expect(dialog).toBeVisible()
    const before = await dialog.boundingBox()

    await w.locator('[data-testid="source-advanced-tab-cut"]').click()
    await w.waitForTimeout(200)
    const after = await dialog.boundingBox()

    expect(before).not.toBeNull()
    expect(after).not.toBeNull()
    expect(after!.height).toBe(before!.height)
    expect(after!.width).toBe(before!.width)

    // 切回来同样不变
    await w.locator('[data-testid="source-advanced-tab-length"]').click()
    await w.waitForTimeout(150)
    expect((await dialog.boundingBox())!.height).toBe(before!.height)

    // 勾选长度限制时给出可直接用的默认值
    await w.locator('[data-testid="source-limit-min"]').check()
    await expect(w.locator('[data-testid="source-limit-min-value"]')).toHaveValue('1')
    await expect(w.locator('[data-testid="source-limit-pad-char"]')).toHaveValue('0')
    await w.locator('[data-testid="source-limit-max"]').check()
    await expect(w.locator('[data-testid="source-limit-max-value"]')).toHaveValue('8')

    // 截断的多项可以同时勾选（原版是独立复选框，不是单选）
    await w.locator('[data-testid="source-advanced-tab-cut"]').click()
    await w.locator('[data-testid="cut-trim-left"]').check()
    await w.locator('[data-testid="cut-drop-left"]').check()
    await w.locator('[data-testid="cut-drop-right"]').check()
    await w.locator('[data-testid="cut-keep"]').check()
    await expect(w.locator('[data-testid="cut-trim-left"]')).toBeChecked()
    await expect(w.locator('[data-testid="cut-drop-left"]')).toBeChecked()
    await expect(w.locator('[data-testid="cut-drop-right"]')).toBeChecked()
    await expect(w.locator('[data-testid="cut-keep"]')).toBeChecked()

    // 字符验证整块暂时隐藏
    await expect(w.locator('[data-testid="source-advanced-dialog"]')).not.toContainText('字符验证')
    await expect(w.locator('[data-testid="cut-allow-chars"]')).toHaveCount(0)
  } finally {
    await launched.close()
  }
})
