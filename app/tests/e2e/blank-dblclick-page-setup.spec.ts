import { test, expect, type Page } from '@playwright/test'
import { launchApp } from './fixtures/electron-app'

/**
 * 双击画布空白区域 → 打开「标签格式设置」（与真机一致，见 parity/README.md
 * 「双击空白画布 → 标签格式设置」）。系统设置里提供开关，默认开启，可关闭。
 */

async function createLabel(page: Page): Promise<void> {
  await page.locator('[data-testid="toolbar"] button[title="新建标签模版"]').click()
  await page.locator('[data-testid="new-label-dialog"]').waitFor({ timeout: 10_000 })
  await page.locator('[data-testid="new-label-param-width"]').fill('60')
  await page.locator('[data-testid="new-label-param-height"]').fill('40')
  await page.locator('[data-testid="new-label-select"]').click()
  await expect(page.locator('[data-testid="toolbar"]')).toBeVisible({ timeout: 10_000 })
}

async function openOptions(page: Page): Promise<void> {
  await page.getByText('选项(O)', { exact: true }).click()
  await page.getByText('系统选项(C)...', { exact: true }).click()
  await page.locator('[data-testid="options-dialog"]').waitFor({ timeout: 10_000 })
}

async function dblclickBlankCanvas(page: Page): Promise<void> {
  await page.locator('canvas').first().dblclick({ position: { x: 120, y: 120 }, force: true })
}

test('双击画布空白区域打开标签格式设置，系统设置可关闭并持久化', async () => {
  const launched = await launchApp()
  const w = launched.window
  try {
    await createLabel(w)
    const dialog = w.locator('[data-testid="new-label-dialog"]')

    // 默认开启：双击空白画布打开「标签格式设置」（编辑模式）。
    await dblclickBlankCanvas(w)
    await expect(dialog).toBeVisible({ timeout: 10_000 })
    await expect(dialog).toHaveAttribute('aria-label', '标签格式设置')
    await dialog.locator('button[aria-label="关闭"]').click()
    await expect(dialog).toHaveCount(0)

    // 系统设置里的开关默认勾选；取消后双击不再打开。
    await openOptions(w)
    const toggle = w.locator('[data-testid="dblclick-blank-label-format"]')
    await expect(toggle).toBeChecked()
    await toggle.uncheck()
    await w.locator('[data-testid="options-save"]').click()
    await w.locator('[data-testid="options-dialog"]').waitFor({ state: 'detached', timeout: 10_000 })

    await dblclickBlankCanvas(w)
    await w.waitForTimeout(800)
    await expect(dialog).toHaveCount(0)

    // 重新打开开关后恢复。
    await openOptions(w)
    await w.locator('[data-testid="dblclick-blank-label-format"]').check()
    await w.locator('[data-testid="options-save"]').click()
    await w.locator('[data-testid="options-dialog"]').waitFor({ state: 'detached', timeout: 10_000 })
    await dblclickBlankCanvas(w)
    await expect(dialog).toBeVisible({ timeout: 10_000 })
    await dialog.locator('button[aria-label="关闭"]').click()
  } finally {
    await launched.close()
  }
})
