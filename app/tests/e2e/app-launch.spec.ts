import { test, expect } from '@playwright/test'
import { launchApp } from './fixtures/electron-app'

test('launches to the start page and creates a label', async () => {
  const launched = await launchApp()
  try {
    await expect(launched.window.locator('[data-testid="start-page"]')).toBeVisible()

    await launched.window.locator('[title="新建新的标签格式模板"]').click()
    await launched.window.locator('[data-testid="wizard-next"]').waitFor({ timeout: 10_000 })
    await launched.window.locator('[data-testid="wizard-next"]').click()
    await launched.window.locator('[data-testid="new-label-dialog"]').waitFor({ timeout: 10_000 })
    await launched.window.locator('[data-testid="new-label-select"]').click()
    await expect(launched.window.locator('[data-testid="toolbar"]')).toBeVisible({ timeout: 10_000 })
    await expect(launched.window.locator('[data-testid="start-page"]')).toHaveCount(0)
  } finally {
    await launched.close()
  }
})
