import { test, expect, type Page } from '@playwright/test'
import { launchApp } from './fixtures/electron-app'

async function createLabel(page: Page): Promise<void> {
  await page.locator('[title="新建新的标签格式模板"]').click()
  await page.locator('[data-testid="wizard-next"]').waitFor({ timeout: 10_000 })
  await page.locator('[data-testid="wizard-next"]').click()
  await page.locator('[data-testid="new-label-dialog"]').waitFor({ timeout: 10_000 })
  await page.locator('[data-testid="new-label-select"]').click()
  await expect(page.locator('[data-testid="toolbar"]')).toBeVisible({ timeout: 10_000 })
}

async function createObject(page: Page, tool: string, y = 300): Promise<void> {
  await page.locator(`[data-tool="${tool}"]`).click()
  await page.locator('canvas').first().click({ position: { x: 300, y }, force: true })
  await page.keyboard.press('Alt+Enter')
  await page.locator('[data-testid="object-props-dialog"]').waitFor({ timeout: 10_000 })
  await page.locator('[data-testid="object-props-tab-general"]').click()
}

test('configures a text colour mode and granularity', async () => {
  const launched = await launchApp()
  const w = launched.window
  try {
    await createLabel(w)
    await createObject(w, 'text')

    await w.locator('[data-testid="color-change-mode"]').selectOption('index')
    await w.locator('[data-testid="color-change-input"]').fill('12')
    await w.locator('[data-testid="color-change-granularity"]').selectOption('char')
    await w.locator('[data-testid="object-props-ok"]').click()
    await expect(w.locator('[data-testid="object-props-dialog"]')).toHaveCount(0)

    await w.keyboard.press('Alt+Enter')
    await w.locator('[data-testid="object-props-dialog"]').waitFor({ timeout: 10_000 })
    await w.locator('[data-testid="object-props-tab-general"]').click()
    await expect(w.locator('[data-testid="color-change-mode"]')).toHaveValue('index')
    await expect(w.locator('[data-testid="color-change-input"]')).toHaveValue('12')
    await expect(w.locator('[data-testid="color-change-granularity"]')).toHaveValue('char')
  } finally {
    await launched.close()
  }
})

test('offers block and gradient granularity for a barcode', async () => {
  const launched = await launchApp()
  const w = launched.window
  try {
    await createLabel(w)
    await createObject(w, 'barcode', 360)

    await w.locator('[data-testid="color-change-mode"]').selectOption('rgb')
    await w.locator('[data-testid="color-change-input"]').fill('#FF0000|#00FF00')
    const granularity = w.locator('[data-testid="color-change-granularity"]')
    await expect(granularity.locator('option')).toHaveCount(3)
    await expect(granularity.locator('option[value="block"]')).toHaveCount(1)
    await expect(granularity.locator('option[value="gradient"]')).toHaveCount(1)
    await granularity.selectOption('block')
    await expect(granularity).toHaveValue('block')
  } finally {
    await launched.close()
  }
})

test('keeps private and shared colour tables in their own scopes', async () => {
  const launched = await launchApp()
  const w = launched.window
  try {
    await createLabel(w)
    await createObject(w, 'text')

    await w.locator('[data-testid="color-change-mode"]').selectOption('index')
    await expect(w.locator('[data-testid="color-index-source"]')).toHaveValue('private')
    await w.locator('[data-testid="color-index-private-add"]').click()
    await w.locator('[data-testid="color-index-private-value-0"]').fill('#123456')

    await w.locator('[data-testid="color-index-source"]').selectOption('shared')
    await w.locator('[data-testid="color-index-shared-add"]').click()
    await w.locator('[data-testid="color-index-shared-value-0"]').fill('#654321')
    await w.locator('[data-testid="object-props-ok"]').click()

    await w.keyboard.press('Alt+Enter')
    await w.locator('[data-testid="object-props-dialog"]').waitFor({ timeout: 10_000 })
    await w.locator('[data-testid="object-props-tab-general"]').click()
    await expect(w.locator('[data-testid="color-index-source"]')).toHaveValue('shared')
    await expect(w.locator('[data-testid="color-index-shared-value-0"]')).toHaveValue('#654321')
    await w.locator('[data-testid="color-index-source"]').selectOption('private')
    await expect(w.locator('[data-testid="color-index-private-value-0"]')).toHaveValue('#123456')
  } finally {
    await launched.close()
  }
})
