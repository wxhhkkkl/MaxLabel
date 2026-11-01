import { test, expect, type Page } from '@playwright/test'
import { launchApp } from './fixtures/electron-app'

/** 019 真图层：图层面板主流程（建层 / 重命名 / 显隐 / 关闭重开 / 删除确认） */

async function createLabel(page: Page): Promise<void> {
  await page.locator('[data-testid="toolbar"] button[title="新建标签模版"]').click()
  await page.locator('[data-testid="new-label-dialog"]').waitFor({ timeout: 10_000 })
  await page.locator('[data-testid="new-label-select"]').click()
  await expect(page.locator('[data-testid="toolbar"]')).toBeVisible({ timeout: 10_000 })
}

test('all layer toolbar buttons are visible and enabled (SC-006)', async () => {
  const launched = await launchApp()
  const w = launched.window
  try {
    await createLabel(w)

    // SC-006：工具栏按钮 0 个禁用 —— 包括默认图层为活动层时（删除也要可点，
    // 由命令层拒绝并提示，而不是把按钮灰掉）。
    // 2026-11-01 所有者要求去掉「设置」：它与「图层属性」打开同一个对话框，属重复入口。
    const tools = ['new', 'copy', 'delete', 'rename', 'properties']
    for (const tool of tools) {
      const button = w.locator(`[data-testid="layer-tool-${tool}"]`)
      await expect(button).toBeVisible()
      await expect(button).toBeEnabled()
    }
  } finally {
    await launched.close()
  }
})

test('creates a layer, renames and hides it, then reopens the panel from the View menu', async () => {
  const launched = await launchApp()
  const w = launched.window
  try {
    await createLabel(w)

    // 新建图层：出现图层行，并成为活动图层
    await w.locator('[data-testid="layer-tool-new"]').click()
    const row = w.locator('[data-testid="layer-row"]').first()
    await expect(row).toBeVisible({ timeout: 10_000 })
    await expect(row).toHaveAttribute('data-active', 'true')

    // 重命名
    await w.locator('[data-testid="layer-tool-rename"]').click()
    await w.locator('[data-testid="layer-props-dialog"]').waitFor({ timeout: 10_000 })
    await w.locator('[data-testid="layer-props-name"]').fill('底图')
    await w.locator('[data-testid="layer-props-save"]').click()
    await expect(w.locator('[data-testid="layer-row"]').first()).toContainText('底图')

    // 隐藏该图层
    await w.locator('[data-testid="layer-row"]').first().locator('[data-testid="layer-column-visibility"]').click()
    await expect(w.locator('[data-testid="layer-row"]').first()).toHaveAttribute('data-visible', 'false')

    // 关闭面板后，从「查看 → 显示图层窗体」重开（R10）
    await w.locator('[title="关闭图层窗体"]').click()
    await expect(w.locator('[data-testid="layer-panel"]')).toHaveCount(0)
    await w.locator('[data-menu-title="查看(V)"]').click()
    await w.locator('[data-menu-item="显示图层窗体"]').click()
    await expect(w.locator('[data-testid="layer-panel"]')).toBeVisible({ timeout: 10_000 })
  } finally {
    await launched.close()
  }
})

test('deleting a non-empty layer asks for confirmation and removes it together with its objects', async () => {
  const launched = await launchApp()
  const w = launched.window
  try {
    await createLabel(w)

    // 先建图层（新层自动成为活动层），再在画布上造一个对象 —— 新对象落在活动图层（Q4）
    await w.locator('[data-testid="layer-tool-new"]').click()
    await expect(w.locator('[data-testid="layer-row"]').first()).toHaveAttribute('data-active', 'true', { timeout: 10_000 })

    await w.locator('[data-tool="text"]').click()
    await w.locator('canvas').first().click({ position: { x: 300, y: 300 }, force: true })
    // 新对象落在活动图层：面板里出现 1 个对象行（在新建图层下，默认层仍为 0）
    await expect(w.locator('[data-testid="layer-object-row"]')).toHaveCount(1, { timeout: 10_000 })
    await expect(w.locator('[data-testid="layer-default"]')).toContainText('0')

    // 删除非空图层：应弹出确认，确认后图层消失
    const dialogs: string[] = []
    w.on('dialog', (dialog) => {
      dialogs.push(dialog.message())
      void dialog.accept()
    })
    await w.locator('[data-testid="layer-tool-delete"]').click()

    await expect(w.locator('[data-testid="layer-row"]')).toHaveCount(0, { timeout: 10_000 })
    expect(dialogs.join()).toContain('1')
  } finally {
    await launched.close()
  }
})
