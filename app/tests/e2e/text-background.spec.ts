import { test, expect, type Page } from '@playwright/test'
import { launchApp } from './fixtures/electron-app'

/**
 * 现场反馈：文字选了背景色，画布上不显示。
 * 原因是文字默认 backgroundTransparent=true，只改 backgroundColor 会被渲染层忽略；
 * 选背景色时必须同时切换为不透明。
 */

async function createLabel(page: Page): Promise<void> {
  await page.locator('[data-testid="toolbar"] button[title="新建标签模版"]').click()
  await page.locator('[data-testid="new-label-dialog"]').waitFor({ timeout: 10_000 })
  await page.locator('[data-testid="new-label-select"]').click()
  await expect(page.locator('[data-testid="toolbar"]')).toBeVisible({ timeout: 10_000 })
}

async function setColor(page: Page, testId: string, value: string): Promise<void> {
  await page.locator(`[data-testid="${testId}"]`).evaluate((element, next) => {
    const input = element as HTMLInputElement
    // 绕过 React 的 value tracker，否则派发 input 事件不会触发 onChange。
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set
    setter?.call(input, next)
    input.dispatchEvent(new Event('input', { bubbles: true }))
    input.dispatchEvent(new Event('change', { bubbles: true }))
  }, value)
}

test('文字设置背景色后画布立即显示', async () => {
  const launched = await launchApp()
  const w = launched.window
  try {
    await createLabel(w)
    await w.locator('[data-tool="text"]').click()
    await w.locator('canvas').first().click({ position: { x: 300, y: 300 }, force: true })
    await w.keyboard.press('Alt+Enter')
    await w.locator('[data-testid="object-props-dialog"]').waitFor({ timeout: 10_000 })

    await w.locator('[data-testid="object-props-tab-font"]').click()
    await setColor(w, 'text-font-background', '#ff0000')
    // 选背景色会同时切换为不透明
    await w.locator('[data-testid="object-props-tab-general"]').click()
    await expect(w.locator('[data-testid="obj-background"]')).toHaveValue('opaque')
    await w.locator('[data-testid="object-props-ok"]').click()
    await w.waitForTimeout(500)

    const hasRed = await w.evaluate(() => {
      const el = document.querySelectorAll('canvas')[0] as HTMLCanvasElement
      const ctx = el.getContext('2d')
      if (!ctx) return false
      const data = ctx.getImageData(0, 0, el.width, el.height).data
      for (let i = 0; i < data.length; i += 4) {
        if (data[i] > 200 && data[i + 1] < 80 && data[i + 2] < 80 && data[i + 3] > 100) return true
      }
      return false
    })
    expect(hasRed).toBe(true)
  } finally {
    await launched.close()
  }
})
