import { test, expect, type Page } from '@playwright/test'
import { launchApp } from './fixtures/electron-app'

/**
 * 系统设置 →「默认标签尺寸」必须作用于新建标签；
 * 同时确认云服务器/商城地址/租户、上报打印记录、编辑页签已从设置里隐藏。
 */

async function openOptions(page: Page): Promise<void> {
  await page.getByText('选项(O)', { exact: true }).click()
  await page.getByText('系统选项(C)...', { exact: true }).click()
  await page.locator('[data-testid="options-dialog"]').waitFor({ timeout: 10_000 })
}

test('默认标签尺寸生效；服务器/商城/上报/编辑设置已隐藏', async () => {
  const launched = await launchApp()
  const w = launched.window
  try {
    await w.locator('[data-testid="start-page"]').waitFor({ timeout: 15_000 })
    await openOptions(w)

    // 已隐藏的设置
    for (const testId of ['options-server-url', 'options-mall-entry-url', 'options-mall-tenant-id', 'options-print-report', 'options-tab-edit']) {
      await expect(w.locator(`[data-testid="${testId}"]`)).toHaveCount(0)
    }

    await w.locator('[data-testid="options-default-label-width"]').fill('50')
    await w.locator('[data-testid="options-default-label-height"]').fill('25')
    await w.locator('[data-testid="options-save"]').click()

    await w.locator('[data-testid="toolbar"] button[title="新建标签模版"]').click()
    await w.locator('[data-testid="new-label-dialog"]').waitFor({ timeout: 10_000 })
    await expect(w.locator('[data-testid="new-label-param-width"]')).toHaveValue('50')
    await expect(w.locator('[data-testid="new-label-param-height"]')).toHaveValue('25')
    await w.locator('[data-testid="new-label-select"]').click()
    await expect(w.locator('[data-testid="status-label-spec"]')).toContainText('50mm x 25mm')
  } finally {
    await launched.close()
  }
})
