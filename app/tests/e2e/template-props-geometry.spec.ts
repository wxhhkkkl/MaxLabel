import { test, expect } from '@playwright/test'
import { launchApp } from './fixtures/electron-app'

async function createDefaultSheetLabel(page: import('playwright').Page): Promise<void> {
  await page.locator('[title="新建新的标签格式模板"]').click()
  await page.locator('[data-testid="wizard-next"]').waitFor({ timeout: 10_000 })
  await page.locator('[data-testid="wizard-next"]').click()
  await page.locator('[data-testid="new-label-dialog"]').waitFor({ timeout: 10_000 })
  await page.locator('[data-testid="new-label-select"]').click()
  await expect(page.locator('[data-testid="toolbar"]')).toBeVisible({ timeout: 10_000 })
}

async function openTemplateProps(page: import('playwright').Page): Promise<void> {
  await page.getByText('文件(F)', { exact: true }).first().click()
  await page.getByText('模板属性设置(M)...', { exact: true }).first().click()
  await page.locator('[data-testid="template-props-dialog"]').waitFor({ timeout: 10_000 })
}

test('preset formats keep page and label geometry read-only', async () => {
  const launched = await launchApp()
  const w = launched.window
  try {
    await createDefaultSheetLabel(w)
    await openTemplateProps(w)

    const readOnly = async (testId: string) =>
      w.locator(`[data-testid="${testId}"]`).evaluate((element) => (element as HTMLInputElement).readOnly)

    expect(await readOnly('template-page-width')).toBe(true)
    expect(await readOnly('template-label-width')).toBe(true)
    expect(await readOnly('template-label-height')).toBe(true)
    expect(await readOnly('template-label-cols')).toBe(true)
    await expect(w.locator('[data-testid="template-label-shape"]')).toBeDisabled()
    await expect(w.locator('[data-testid="template-label-hole"]')).toBeDisabled()

    await w.locator('[data-testid="template-props-dialog"]').getByText('取消', { exact: true }).click()
    await expect(w.locator('[data-testid="template-props-dialog"]')).toHaveCount(0)
  } finally {
    await launched.close()
  }
})

test('标签格式设置 opens the New Label dialog without replacing the current document', async () => {
  const launched = await launchApp()
  const w = launched.window
  try {
    await createDefaultSheetLabel(w)
    const spec = w.locator('[data-testid="status-label-spec"]')
    const before = (await spec.textContent()) ?? ''

    await w.getByText('文件(F)', { exact: true }).first().click()
    await w.getByText('标签格式设置(L)...', { exact: true }).first().click()
    await w.locator('[data-testid="new-label-dialog"]').waitFor({ timeout: 10_000 })
    await w.locator('[data-testid="new-label-cancel"]').click()
    await expect(w.locator('[data-testid="new-label-dialog"]')).toHaveCount(0)
    await expect(spec).toHaveText(before)
  } finally {
    await launched.close()
  }
})
