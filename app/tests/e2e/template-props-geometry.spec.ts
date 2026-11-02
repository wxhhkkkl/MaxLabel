import { test, expect } from '@playwright/test'
import { launchApp } from './fixtures/electron-app'

async function createDefaultSheetLabel(page: import('playwright').Page): Promise<void> {
  await page.locator('[data-testid="toolbar"] button[title="新建标签模版"]').click()
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

test('标签格式设置修改当前标签，而不是新建一个标签', async () => {
  const launched = await launchApp()
  const w = launched.window
  try {
    await createDefaultSheetLabel(w)
    // 先放一个对象，确认改格式后对象仍在
    await w.locator('[data-tool="text"]').click()
    await w.locator('canvas').first().click({ position: { x: 220, y: 200 }, force: true })
    await expect(w.locator('[data-testid="layer-object-row"]')).toHaveCount(1)
    const tabs = w.locator('[data-testid="document-tab"]')
    const tabCount = await tabs.count()

    await w.getByText('文件(F)', { exact: true }).first().click()
    await w.getByText('标签格式设置(L)...', { exact: true }).first().click()
    await w.locator('[data-testid="new-label-dialog"]').waitFor({ timeout: 10_000 })
    // edit 模式的初值来自当前标签
    await expect(w.locator('[data-testid="new-label-param-width"]')).toHaveValue('100')
    await expect(w.locator('[data-testid="new-label-param-height"]')).toHaveValue('70')

    await w.locator('[data-testid="new-label-param-width"]').fill('60')
    await w.locator('[data-testid="new-label-param-height"]').fill('40')
    await w.locator('[data-testid="new-label-select"]').click()

    await expect(w.locator('[data-testid="new-label-dialog"]')).toHaveCount(0)
    await expect(w.locator('[data-testid="status-label-spec"]')).toContainText('60mm x 40mm')
    // 没有生成新标签页，原对象也保留
    await expect(tabs).toHaveCount(tabCount)
    await expect(w.locator('[data-testid="layer-object-row"]')).toHaveCount(1)
  } finally {
    await launched.close()
  }
})

test('点击状态栏标签尺寸打开标签格式设置并作用于当前标签', async () => {
  const launched = await launchApp()
  const w = launched.window
  try {
    await createDefaultSheetLabel(w)
    const tabs = w.locator('[data-testid="document-tab"]')
    const tabCount = await tabs.count()

    await w.locator('[data-testid="status-label-spec"]').click()
    await w.locator('[data-testid="new-label-dialog"]').waitFor({ timeout: 10_000 })
    await expect(w.locator('[data-testid="new-label-param-width"]')).toHaveValue('100')

    await w.locator('[data-testid="new-label-param-width"]').fill('50')
    await w.locator('[data-testid="new-label-select"]').click()

    await expect(w.locator('[data-testid="new-label-dialog"]')).toHaveCount(0)
    await expect(w.locator('[data-testid="status-label-spec"]')).toContainText('50mm x 70mm')
    await expect(tabs).toHaveCount(tabCount)
  } finally {
    await launched.close()
  }
})
