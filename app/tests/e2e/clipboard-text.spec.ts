import { test, expect, type Page } from '@playwright/test'
import { launchApp } from './fixtures/electron-app'

async function createLabel(page: Page): Promise<void> {
  await page.locator('[data-testid="toolbar"] button[title="新建标签模版"]').click()
  await page.locator('[data-testid="new-label-dialog"]').waitFor({ timeout: 10_000 })
  await page.locator('[data-testid="new-label-select"]').click()
  await expect(page.locator('[data-testid="toolbar"]')).toBeVisible({ timeout: 10_000 })
}

async function clipboardText(page: Page): Promise<string> {
  return page.evaluate(() => navigator.clipboard.readText())
}

async function renderedTypeCount(page: Page): Promise<number> {
  const value = await page.locator('[data-rendered-object-types]').getAttribute('data-rendered-object-types')
  return value ? value.split(',').filter(Boolean).length : 0
}

test('复制对象时系统剪贴板得到纯文本，内部粘贴仍还原对象', async () => {
  const launched = await launchApp()
  const w = launched.window
  try {
    await createLabel(w)

    // 文字对象：Ctrl+C 写纯文本，不写带样式的 JSON。
    await w.locator('[data-tool="text"]').click()
    await w.locator('canvas').first().click({ position: { x: 300, y: 250 }, force: true })
    await w.keyboard.press('Control+c')
    await expect.poll(() => clipboardText(w)).toBe('文字内容')
    expect(await renderedTypeCount(w)).toBe(1)
    await w.keyboard.press('Control+v')
    await expect.poll(() => renderedTypeCount(w)).toBe(2)

    // 条码对象：复制的是条码内容，不是 maxlabel-objects JSON。
    await w.locator('[data-tool="barcode"]').click()
    await w.locator('canvas').first().click({ position: { x: 500, y: 300 }, force: true })
    await w.keyboard.press('Control+c')
    await expect.poll(() => clipboardText(w)).toBe('1234567890')
    expect(await clipboardText(w)).not.toContain('maxlabel-objects')
    await w.keyboard.press('Control+v')
    await expect.poll(() => renderedTypeCount(w)).toBe(4)
  } finally {
    await launched.close()
  }
})
