import { test, expect, type Page } from '@playwright/test'
import { launchApp } from './fixtures/electron-app'

/** 显示对象信息浮窗：左上角小字显示对象的「附加说明」。 */

async function createLabel(page: Page): Promise<void> {
  await page.locator('[data-testid="toolbar"] button[title="新建标签模版"]').click()
  await page.locator('[data-testid="new-label-dialog"]').waitFor({ timeout: 10_000 })
  await page.locator('[data-testid="new-label-select"]').click()
  await expect(page.locator('[data-testid="toolbar"]')).toBeVisible({ timeout: 10_000 })
}

test('对象信息浮窗显示附加说明；排列/查看菜单带图标', async () => {
  const launched = await launchApp()
  const w = launched.window
  try {
    await createLabel(w)
    await w.locator('[data-tool="text"]').click()
    await w.locator('canvas').first().click({ position: { x: 300, y: 250 }, force: true })
    await w.keyboard.press('Alt+Enter')
    await w.locator('[data-testid="object-props-dialog"]').waitFor({ timeout: 10_000 })
    await w.locator('[data-testid="object-props-tab-general"]').click()
    await w.locator('[data-testid="obj-note"]').fill('L3/2')
    await w.locator('[data-testid="object-props-ok"]').click()

    await w.locator('[data-menu-title="查看(V)"]').click()
    // 适应高度等菜单项带上工具栏图标
    await expect(w.locator('[data-menu-item="适应高度"] svg')).toHaveCount(1)
    await w.locator('[data-menu-item="显示对象信息(R)"]').click()
    await expect(w.locator('[data-testid="object-info-note"]')).toHaveText('L3/2')

    await w.locator('[data-menu-title="排列(A)"]').click()
    await expect(w.locator('[data-menu-item="组合(G)"] svg')).toHaveCount(1)
    await expect(w.locator('[data-menu-item="前移"] svg')).toHaveCount(1)
    await expect(w.locator('[data-menu-item="移到最后"] svg')).toHaveCount(1)
  } finally {
    await launched.close()
  }
})
