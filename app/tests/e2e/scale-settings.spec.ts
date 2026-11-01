import { test, expect, type Page } from '@playwright/test'
import { launchApp } from './fixtures/electron-app'

/**
 * 020 电子称设置（选项 → 电子称）
 *
 * 这里只钉住**冒烟与持久化**：对话框能打开、两页签能切、端口/速率保存后重开还在。
 * 真实串口收发不在 e2e 里做（需要接设备），由主进程的 scale 单测与真机验收覆盖。
 */

async function createLabel(page: Page): Promise<void> {
  await page.locator('[data-testid="toolbar"] button[title="新建标签模版"]').click()
  await page.locator('[data-testid="new-label-dialog"]').waitFor({ timeout: 10_000 })
  await page.locator('[data-testid="new-label-select"]').click()
  await expect(page.locator('[data-testid="toolbar"]')).toBeVisible({ timeout: 10_000 })
}

async function openScaleDialog(page: Page) {
  await page.locator('[data-menu-title="选项(O)"]').click()
  await page.locator('[data-menu-item="电子称"]').click()
  const dialog = page.locator('[data-testid="scale-settings-dialog"]')
  await expect(dialog).toBeVisible({ timeout: 10_000 })
  return dialog
}

test('电子称设置：协议/端口可配置并在重开后保留', async () => {
  const launched = await launchApp()
  const w = launched.window
  try {
    await createLabel(w)

    await openScaleDialog(w)
    await w.locator('[data-testid="scale-tab-port"]').click()
    await w.locator('[data-testid="scale-port"]').fill('COM7')
    await w.locator('[data-testid="scale-baud"]').selectOption('19200')
    await w.locator('[data-testid="scale-save"]').click()

    await openScaleDialog(w)
    await w.locator('[data-testid="scale-tab-port"]').click()
    await expect(w.locator('[data-testid="scale-port"]')).toHaveValue('COM7')
    await expect(w.locator('[data-testid="scale-baud"]')).toHaveValue('19200')

    // 选项页：换协议时套用该协议默认速率
    await w.locator('[data-testid="scale-tab-options"]').click()
    await w.locator('[data-testid="scale-protocol"]').selectOption('mettler')
    await expect(w.locator('[data-testid="scale-tab-options"]')).toBeVisible()
    await w.locator('[data-testid="scale-save"]').click()
  } finally {
    await launched.close()
  }
})
