import { test, expect, type Locator } from '@playwright/test'
import { launchApp } from './fixtures/electron-app'

/** React-controlled number inputs: clear first, then type, so fill cannot append. */
async function setNumber(locator: Locator, value: string): Promise<void> {
  await locator.click()
  await locator.press('Control+A')
  await locator.press('Backspace')
  await locator.pressSequentially(value, { delay: 5 })
}

async function openNewLabelDialog(page: import('playwright').Page): Promise<void> {
  await page.locator('[data-testid="toolbar"] button[title="新建标签模版"]').click()
  await page.locator('[data-testid="wizard-next"]').waitFor({ timeout: 10_000 })
  await page.locator('[data-testid="wizard-next"]').click()
  await page.locator('[data-testid="new-label-dialog"]').waitFor({ timeout: 10_000 })
}

async function openTemplateProps(page: import('playwright').Page): Promise<void> {
  await page.getByText('文件(F)', { exact: true }).first().click()
  await page.getByText('模板属性设置(M)...', { exact: true }).first().click()
  await page.locator('[data-testid="template-props-dialog"]').waitFor({ timeout: 10_000 })
}

test('rejects an out-of-range custom size and keeps the dialog open', async () => {
  const launched = await launchApp()
  const w = launched.window
  try {
    await openNewLabelDialog(w)
    await w.locator('[data-testid="new-label-custom"]').click()
    await w.locator('[data-testid="custom-label-dialog"]').waitFor({ timeout: 10_000 })

    await setNumber(w.locator('[data-testid="new-label-custom-width"]'), '4')
    await w.locator('[data-testid="custom-label-confirm"]').click()

    await expect(w.locator('[data-testid="custom-label-dialog"]')).toBeVisible()
    await expect(w.locator('[data-testid="start-page"]')).toBeVisible()
  } finally {
    await launched.close()
  }
})

test('clamps a typed row count to 100 instead of failing document creation', async () => {
  const launched = await launchApp()
  const w = launched.window
  try {
    await openNewLabelDialog(w)
    await w.locator('[data-testid="new-label-custom"]').click()
    await w.locator('[data-testid="custom-label-dialog"]').waitFor({ timeout: 10_000 })

    await setNumber(w.locator('[data-testid="new-label-custom-rows"]'), '200')
    await w.locator('[data-testid="custom-label-confirm"]').click()

    await expect(w.locator('[data-testid="toolbar"]')).toBeVisible({ timeout: 10_000 })
    await expect(w.locator('[data-testid="status-label-spec"]')).toContainText('200枚/页')
  } finally {
    await launched.close()
  }
})

test('creates a custom format and keeps a rectangular hole when reopened', async () => {
  const launched = await launchApp()
  const w = launched.window
  try {
    await openNewLabelDialog(w)
    await w.locator('[data-testid="new-label-custom"]').click()
    await w.locator('[data-testid="custom-label-dialog"]').waitFor({ timeout: 10_000 })

    await setNumber(w.locator('[data-testid="new-label-custom-width"]'), '80')
    await setNumber(w.locator('[data-testid="new-label-custom-height"]'), '50')
    await setNumber(w.locator('[data-testid="new-label-custom-cols"]'), '2')
    await setNumber(w.locator('[data-testid="new-label-custom-rows"]'), '1')
    await setNumber(w.locator('[data-testid="new-label-custom-col-gap"]'), '0')
    await setNumber(w.locator('[data-testid="new-label-custom-row-gap"]'), '0')
    await w.locator('[data-testid="custom-label-shape"]').selectOption('roundRect')
    await w.locator('[data-testid="custom-label-hole"]').selectOption('rectangle')
    await setNumber(w.locator('[data-testid="custom-label-hole-size"]'), '6')
    await w.locator('[data-testid="custom-label-confirm"]').click()
    await expect(w.locator('[data-testid="toolbar"]')).toBeVisible({ timeout: 10_000 })
    await expect(w.locator('[data-testid="status-label-spec"]')).toContainText('80mm x 50mm')
    await expect(w.locator('[data-testid="status-label-spec"]')).toContainText('圆角2枚/页')

    await openTemplateProps(w)
    await expect(w.locator('[data-testid="template-label-width"]')).toHaveValue('80')
    await expect(w.locator('[data-testid="template-label-height"]')).toHaveValue('50')
    await expect(w.locator('[data-testid="template-label-cols"]')).toHaveValue('2')
    await expect(w.locator('[data-testid="template-label-rows"]')).toHaveValue('1')
    await expect(w.locator('[data-testid="template-label-shape"]')).toHaveValue('roundRect')
    await expect(w.locator('[data-testid="template-label-hole"]')).toHaveValue('rectangle')
    expect(Number(await w.locator('[data-testid="template-label-hole-size"]').inputValue())).toBe(6)

    // Switch the hole to a circle and persist it.
    await w.locator('[data-testid="template-label-hole"]').selectOption('circle')
    await setNumber(w.locator('[data-testid="template-label-hole-size"]'), '6')
    await w.locator('[data-testid="template-props-dialog"]').getByText('确定', { exact: true }).click()
    await expect(w.locator('[data-testid="template-props-dialog"]')).toHaveCount(0)

    await openTemplateProps(w)
    await expect(w.locator('[data-testid="template-label-hole"]')).toHaveValue('circle')
    expect(Number(await w.locator('[data-testid="template-label-hole-size"]').inputValue())).toBe(6)
  } finally {
    await launched.close()
  }
})
