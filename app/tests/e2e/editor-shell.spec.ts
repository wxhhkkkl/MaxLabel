import { test, expect, type Page } from '@playwright/test'
import { launchApp } from './fixtures/electron-app'

async function createLabelFromStart(page: Page): Promise<void> {
  await page.locator('[title="新建新的标签格式模板"]').click()
  await page.locator('[data-testid="wizard-next"]').waitFor({ timeout: 10_000 })
  await page.locator('[data-testid="wizard-next"]').click()
  await page.locator('[data-testid="new-label-dialog"]').waitFor({ timeout: 10_000 })
  await page.locator('[data-testid="new-label-select"]').click()
  await expect(page.locator('[data-testid="toolbar"]')).toBeVisible({ timeout: 10_000 })
}

async function openMenu(page: Page, title: string): Promise<void> {
  await page.getByText(title, { exact: true }).first().click()
}

test('menus reflect start-page and document availability', async () => {
  const launched = await launchApp()
  const w = launched.window
  try {
    await openMenu(w, '文件(F)')
    await expect(w.locator('[data-menu-item="关闭(C)"]')).toHaveAttribute('data-menu-disabled', 'true')
    await w.keyboard.press('Escape')

    await createLabelFromStart(w)
    await openMenu(w, '文件(F)')
    await expect(w.locator('[data-menu-item="保存(S)"]')).toHaveAttribute('data-menu-disabled', 'true')
    await expect(w.locator('[data-menu-item="打印(P)..."]')).toHaveAttribute('data-menu-disabled', 'false')
    await expect(w.locator('[data-menu-item="打印预览(V)"]')).toHaveAttribute('data-menu-disabled', 'false')
    await w.keyboard.press('Escape')

    await openMenu(w, '编辑(E)')
    await expect(w.locator('[data-menu-item="撤销(U)"]')).toHaveAttribute('data-menu-disabled', 'true')
  } finally {
    await launched.close()
  }
})

test('toolbar group visibility persists across a reload', async () => {
  const launched = await launchApp()
  const w = launched.window
  try {
    await createLabelFromStart(w)
    await expect(w.locator('[title="帮助主题"]')).toHaveCount(1)

    await w.locator('[data-testid="toolbar-customize"]').click()
    await w.locator('[data-testid="toolbar-customize-root"]').click()
    await w.locator('[data-testid="toolbar-customize-standard"]').click()
    await w.locator('[data-testid="toolbar-group-help"] input').uncheck()
    await w.locator('[data-testid="status-bar"]').click()
    await expect(w.locator('[title="帮助主题"]')).toHaveCount(0)

    await w.reload()
    await w.locator('[data-testid="start-page"]').waitFor({ timeout: 15_000 })
    await expect(w.locator('[title="帮助主题"]')).toHaveCount(0)
  } finally {
    await launched.close()
  }
})

test('panels, theme, fit width and label rotation respond to the View menu', async () => {
  const launched = await launchApp()
  const w = launched.window
  try {
    await createLabelFromStart(w)

    await openMenu(w, '查看(V)')
    await w.locator('[data-menu-item="状态栏(S)"]').click()
    await expect(w.locator('[data-testid="status-bar"]')).toHaveCount(0)
    await openMenu(w, '查看(V)')
    await w.locator('[data-menu-item="状态栏(S)"]').click()
    await expect(w.locator('[data-testid="status-bar"]')).toBeVisible()

    await openMenu(w, '选项(O)')
    await w.locator('[data-menu-item="应用程序外观(A)"]').hover()
    await w.locator('[data-menu-item="黑色样式(L)"]').click()
    await expect
      .poll(() => w.locator('#root > div').evaluate((element) => element.style.getPropertyValue('--app-accent')))
      .toBe('#5B8DB8')

    await openMenu(w, '查看(V)')
    await w.locator('[data-menu-item="适应宽度"]').click()
    await expect(w.locator('[data-zoom-mode="w"]')).toBeVisible()

    await openMenu(w, '查看(V)')
    await w.locator('[data-menu-item="标签旋转"]').hover()
    await w.locator('[data-menu-item="右旋90度"]').click()
    await expect(w.locator('[data-rotation="90"]')).toBeVisible()
  } finally {
    await launched.close()
  }
})

test('tabs stay independent and the window title follows the active document', async () => {
  const launched = await launchApp()
  const w = launched.window
  try {
    await expect.poll(() => w.title()).toContain('起始页')

    await createLabelFromStart(w)
    await expect.poll(() => w.title()).toContain('新标签模板1')
    // The strip includes the start-page tab plus the document.
    await expect(w.locator('[data-testid="document-tab"]')).toHaveCount(2)

    await openMenu(w, '文件(F)')
    await w.locator('[data-menu-item="新建(N)"]').click()
    await w.locator('[data-testid="wizard-next"]').waitFor({ timeout: 10_000 })
    await w.locator('[data-testid="wizard-next"]').click()
    await w.locator('[data-testid="new-label-dialog"]').waitFor({ timeout: 10_000 })
    await w.locator('[data-testid="new-label-select"]').click()
    await expect(w.locator('[data-testid="document-tab"]')).toHaveCount(3)

    await w.keyboard.press('Control+W')
    await expect(w.locator('[data-testid="document-tab"]')).toHaveCount(2)
    await expect.poll(() => w.title()).toContain('新标签模板1')
  } finally {
    await launched.close()
  }
})

test('object properties never show a literal MFC accelerator', async () => {
  const launched = await launchApp()
  const w = launched.window
  try {
    await createLabelFromStart(w)
    await w.locator('[data-tool="text"]').click()
    await w.locator('canvas').first().click({ position: { x: 300, y: 300 }, force: true })
    await w.keyboard.press('Alt+Enter')
    const dialog = w.locator('[data-testid="object-props-dialog"]')
    await expect(dialog).toBeVisible({ timeout: 10_000 })
    const text = (await dialog.textContent()) ?? ''
    expect(text).not.toMatch(/\(&[A-Za-z0-9]\)/)
  } finally {
    await launched.close()
  }
})
