import { test, expect, type Page } from '@playwright/test'
import { launchApp } from './fixtures/electron-app'

async function createLabel(page: Page): Promise<void> {
  await page.locator('[data-testid="toolbar"] button[title="新建标签模版"]').click()
  await page.locator('[data-testid="new-label-dialog"]').waitFor({ timeout: 10_000 })
  await page.locator('[data-testid="new-label-select"]').click()
  await expect(page.locator('[data-testid="toolbar"]')).toBeVisible({ timeout: 10_000 })
}

/**
 * 015 现场反馈：画布上的条码和文字都比打印模糊。
 *
 * 根因不是分辨率，是**位置**：视口宽度与标签宽度之差是奇数时，居中用的
 * `(visibleW - stageW) / 2` 会算出 xxx.5，画布停在半个像素上，浏览器合成时
 * 对整张位图重采样一次——条码和文字一起发虚，而打印走另一条链路所以不受影响。
 */
async function canvasOrigin(page: Page): Promise<{ x: number; y: number }> {
  const rect = await page.locator('canvas').first().boundingBox()
  if (!rect) throw new Error('canvas not found')
  return { x: rect.x, y: rect.y }
}

test('canvas lands on whole pixels so text and barcodes stay sharp', async () => {
  const launched = await launchApp()
  const w = launched.window
  try {
    await createLabel(w)
    await w.waitForTimeout(300)

    for (const rotation of [0, 90, 180, 270]) {
      if (rotation > 0) {
        await w.getByText('查看(V)', { exact: true }).first().click()
        await w.locator('[data-menu-item="标签旋转"]').hover()
        await w.locator('[data-menu-item="右旋90度"]').click()
        await w.waitForTimeout(200)
      }
      const origin = await canvasOrigin(w)
      expect(Number.isInteger(origin.x), `x=${origin.x} @${rotation}°`).toBe(true)
      expect(Number.isInteger(origin.y), `y=${origin.y} @${rotation}°`).toBe(true)
    }
  } finally {
    await launched.close()
  }
})
