import { test, expect, type Locator, type Page } from '@playwright/test'
import { launchApp } from './fixtures/electron-app'

async function createLabel(page: Page): Promise<void> {
  await page.locator('[data-testid="toolbar"] button[title="新建标签模版"]').click()
  await page.locator('[data-testid="wizard-next"]').waitFor({ timeout: 10_000 })
  await page.locator('[data-testid="wizard-next"]').click()
  await page.locator('[data-testid="new-label-dialog"]').waitFor({ timeout: 10_000 })
  await page.locator('[data-testid="new-label-select"]').click()
  await expect(page.locator('[data-testid="toolbar"]')).toBeVisible({ timeout: 10_000 })
}

async function setNumber(locator: Locator, value: string): Promise<void> {
  await locator.click()
  await locator.press('Control+A')
  await locator.press('Backspace')
  await locator.pressSequentially(value, { delay: 5 })
}

async function openMenu(page: Page, title: string): Promise<void> {
  await page.getByText(title, { exact: true }).first().click()
}

test('fit height, manual zoom persistence and layout rotation', async () => {
  const launched = await launchApp()
  const w = launched.window
  try {
    await createLabel(w)
    await openMenu(w, '查看(V)')
    await w.locator('[data-menu-item="适应高度"]').click()
    await expect(w.locator('[data-zoom-mode="h"]')).toBeVisible()

    await openMenu(w, '查看(V)')
    await w.locator('[data-menu-item="放大(I)"]').click()
    const zoomBefore = (await w.locator('[data-testid="status-zoom"]').textContent()) ?? ''
    await launched.app.evaluate(({ BrowserWindow }) => {
      BrowserWindow.getAllWindows()[0]?.setContentSize(900, 700)
    })
    await w.waitForTimeout(300)
    expect(await w.locator('[data-testid="status-zoom"]').textContent()).toBe(zoomBefore)

    await openMenu(w, '查看(V)')
    await w.locator('[data-menu-item="标签旋转"]').hover()
    await w.locator('[data-menu-item="右旋90度"]').click()
    await expect(w.locator('[data-rotation="90"]')).toBeVisible()
  } finally {
    await launched.close()
  }
})

test('property geometry, invalid fallback and clipboard/group commands', async () => {
  const launched = await launchApp()
  const w = launched.window
  try {
    await createLabel(w)
    await w.locator('[data-tool="text"]').click()
    await w.locator('canvas').first().click({ position: { x: 300, y: 300 }, force: true })
    await w.keyboard.press('Alt+Enter')
    await w.locator('[data-testid="object-props-dialog"]').waitFor({ timeout: 10_000 })
    await w.locator('[data-testid="object-props-tab-general"]').click()

    await setNumber(w.locator('[data-testid="obj-x"]'), '10')
    await w.locator('[data-testid="obj-rotation"]').selectOption('90')
    await w.locator('[data-testid="object-props-ok"]').click()

    await w.keyboard.press('Alt+Enter')
    await w.locator('[data-testid="object-props-dialog"]').waitFor({ timeout: 10_000 })
    await w.locator('[data-testid="object-props-tab-general"]').click()
    await expect(w.locator('[data-testid="obj-x"]')).toHaveValue('10')
    await expect(w.locator('[data-testid="obj-rotation"]')).toHaveValue('90')

    await setNumber(w.locator('[data-testid="obj-x"]'), 'abc')
    await w.locator('[data-testid="object-props-ok"]').click()
    await w.keyboard.press('Alt+Enter')
    await w.locator('[data-testid="object-props-dialog"]').waitFor({ timeout: 10_000 })
    await w.locator('[data-testid="object-props-tab-general"]').click()
    await expect(w.locator('[data-testid="obj-x"]')).toHaveValue('10')
    await w.locator('[data-testid="object-props-ok"]').click()

    await w.locator('[data-tool="text"]').click()
    await w.locator('canvas').first().click({ position: { x: 360, y: 360 }, force: true })
    await w.keyboard.press('Control+A')
    await w.keyboard.press('Control+C')
    await expect(w.locator('[data-testid="status-bar"]')).toHaveAttribute('title', /已复制/)
    await w.keyboard.press('Control+V')
    await expect(w.locator('[data-testid="status-bar"]')).toHaveAttribute('title', /已粘贴/)
    await w.keyboard.press('Control+A')
    await w.keyboard.press('Control+G')
    await expect(w.locator('[data-testid="status-bar"]')).toHaveAttribute('title', /已组合/)
    await w.keyboard.press('Control+U')
    await expect(w.locator('[data-testid="status-bar"]')).toHaveAttribute('title', /已取消组合/)
  } finally {
    await launched.close()
  }
})
