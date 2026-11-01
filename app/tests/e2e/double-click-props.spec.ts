import { test, expect, type Page } from '@playwright/test'
import { launchApp } from './fixtures/electron-app'

/**
 * 双击对象 = 打开「对象属性」（020 现场反馈）
 *
 * 多行文字用的是 fabric 的 Textbox（继承 IText），**自带双击就地编辑**：双击后
 * 光标进到文字里能直接打字，属性框反而不出来。复刻版要的是双击一律开属性，
 * 所以关掉了 fabric 的 `editable`，并补了一条 fabric 侧的双击兜底。
 */

async function createLabel(page: Page): Promise<void> {
  await page.locator('[data-testid="toolbar"] button[title="新建标签模版"]').click()
  await page.locator('[data-testid="new-label-dialog"]').waitFor({ timeout: 10_000 })
  await page.locator('[data-testid="new-label-select"]').click()
  await expect(page.locator('[data-testid="toolbar"]')).toBeVisible({ timeout: 10_000 })
}

test('双击普通对象打开属性', async () => {
  const launched = await launchApp()
  const w = launched.window
  try {
    await createLabel(w)
    await w.locator('[data-tool="rect"]').click()
    await w.locator('canvas').first().click({ position: { x: 400, y: 400 }, force: true })
    await w.locator('canvas').first().dblclick({ position: { x: 400, y: 400 }, force: true })
    await expect(w.locator('[data-testid="object-props-dialog"]')).toBeVisible({ timeout: 10_000 })
  } finally {
    await launched.close()
  }
})

test('双击多行文字打开属性，且不会进入就地编辑', async () => {
  const launched = await launchApp()
  const w = launched.window
  try {
    await createLabel(w)
    await w.locator('[data-tool="text"]').click()
    await w.locator('canvas').first().click({ position: { x: 300, y: 300 }, force: true })
    await w.keyboard.press('Alt+Enter')
    await expect(w.locator('[data-testid="object-props-dialog"]')).toBeVisible({ timeout: 10_000 })
    await w.locator('[data-testid="object-props-tab-text"]').click()
    await w.locator('[data-testid="text-type-multi"]').check()
    await w.locator('[data-testid="object-props-ok"]').click()
    await w.waitForTimeout(200)

    await w.locator('canvas').first().dblclick({ position: { x: 320, y: 320 }, force: true })
    await expect(w.locator('[data-testid="object-props-dialog"]')).toBeVisible({ timeout: 10_000 })
    // fabric 的就地编辑会在画布容器里插入隐藏 textarea；关掉 editable 后不应出现。
    // ⚠️ 只数画布容器内的，别把属性对话框里「常量内容」的文本框算进来。
    const editorTextareas = await w.evaluate(() => {
      const root = document.querySelector('[data-testid="paper-outline"]')?.parentElement ?? null
      return root?.querySelectorAll('textarea').length ?? 0
    })
    expect(editorTextareas).toBe(0)
  } finally {
    await launched.close()
  }
})
