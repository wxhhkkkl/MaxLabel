import { test, expect, type Page } from '@playwright/test'
import { launchApp } from './fixtures/electron-app'

async function createLabel(page: Page): Promise<void> {
  await page.locator('[data-testid="toolbar"] button[title="新建标签模版"]').click()
  await page.locator('[data-testid="new-label-dialog"]').waitFor({ timeout: 10_000 })
  await page.locator('[data-testid="new-label-select"]').click()
  await expect(page.locator('[data-testid="toolbar"]')).toBeVisible({ timeout: 10_000 })
}

/** 画布上的条码是矢量绘制的：真正画出来（有深色像素）且能被选中。 */
test('barcode is drawn on the editor canvas as vectors', async () => {
  const launched = await launchApp()
  const w = launched.window
  try {
    await createLabel(w)
    await w.locator('[data-tool="barcode"]').click()
    const canvas = w.locator('canvas').first()
    await canvas.click({ position: { x: 420, y: 320 }, force: true })
    await w.waitForTimeout(600)

    const dark = await w.evaluate(() => {
      const el = document.querySelector('.lower-canvas') as HTMLCanvasElement | null
      if (!el) return -1
      const ctx = el.getContext('2d')
      if (!ctx) return -1
      const { data } = ctx.getImageData(0, 0, el.width, el.height)
      let count = 0
      for (let i = 0; i < data.length; i += 4) {
        if (data[i] < 100 && data[i + 1] < 100 && data[i + 2] < 100) count += 1
      }
      return count
    })
    // 条码的竖条是黑色，没画出来就是 0
    expect(dark).toBeGreaterThan(200)

    // 命中框：取消选中后再点条码本体，应该能重新选中。
    const transform = JSON.parse(
      (await w.locator('[data-active-fabric-transform]').first().getAttribute('data-active-fabric-transform')) ?? '{}'
    )
    const box = await canvas.boundingBox()
    if (!box) throw new Error('canvas has no bounding box')
    const zoom = transform.zoom ?? 1
    const centerX = (transform.left + (transform.width * (transform.scaleX ?? 1)) / 2) * zoom
    const centerY = transform.top * zoom

    await canvas.click({ position: { x: 30, y: 30 }, force: true })
    await expect(w.locator('[data-active-fabric-selection]')).toHaveCount(0)

    await w.mouse.click(box.x + centerX, box.y + centerY)
    await expect(w.locator('[data-active-fabric-selection]')).toHaveCount(1)
  } finally {
    await launched.close()
  }
})
