import { test, expect, type Page } from '@playwright/test'
import { launchApp } from './fixtures/electron-app'

async function createLabel(page: Page): Promise<void> {
  await page.locator('[data-testid="toolbar"] button[title="新建标签模版"]').click()
  await page.locator('[data-testid="new-label-dialog"]').waitFor({ timeout: 10_000 })
  await page.locator('[data-testid="new-label-param-width"]').fill('100')
  await page.locator('[data-testid="new-label-param-height"]').fill('70')
  await page.locator('[data-testid="new-label-select"]').click()
  await expect(page.locator('[data-testid="toolbar"]')).toBeVisible({ timeout: 10_000 })
}

async function toggleOutsideView(page: Page, enabled: boolean): Promise<void> {
  await page.getByText('选项(O)', { exact: true }).click()
  await page.getByText('系统选项(C)...', { exact: true }).click()
  await page.locator('[data-testid="options-dialog"]').waitFor({ timeout: 10_000 })
  const checkbox = page.locator('[data-testid="show-outside-label"]')
  if (enabled) await checkbox.check()
  else await checkbox.uncheck()
  await page.locator('[data-testid="options-save"]').click()
  await page.waitForTimeout(300)
}

/**
 * 视图选项「显示标签外内容」（默认关闭）：
 * 开启后画布四周加留白，超出标签的对象照常绘制；纸张形状/孔洞/中缝的裁切保持不变，
 * 打印、预览和文档模型不受影响。
 */
test('标签外内容可选显示：画布加留白，超出部分不再被裁掉', async () => {
  const launched = await launchApp()
  const w = launched.window
  try {
    await createLabel(w)
    await w.locator('[data-testid="zoom-level"]').selectOption('1')
    await w.waitForTimeout(200)

    const view = w.locator('[data-testid="label-editor-view"]')
    await expect(view).toHaveAttribute('data-show-outside', 'false')
    await expect(view).toHaveAttribute('data-outside-margin', '0')
    await expect(view).toHaveAttribute('data-canvas-width', '1000')
    await expect(w.locator('[data-testid="paper-clip-shape"]')).toHaveCount(1)
    await expect(w.locator('[data-testid="paper-clip-margin"]')).toHaveCount(0)

    // 文字移到右边界外（90mm + 文字宽 > 100mm）
    await w.locator('[data-tool="text"]').click()
    await w.locator('canvas').first().click({ position: { x: 60, y: 60 }, force: true })
    await w.waitForTimeout(200)
    await w.keyboard.press('Alt+Enter')
    await w.locator('[data-testid="object-props-tab-general"]').click()
    await w.locator('[data-testid="obj-x"]').fill('90')
    await w.locator('[data-testid="object-props-ok"]').click()
    await expect(w.locator('[data-testid="object-out-of-bounds"]')).toHaveCount(1)

    await toggleOutsideView(w, true)

    await expect(view).toHaveAttribute('data-show-outside', 'true')
    // 留白至少 15mm（150px），并继续放大到覆盖整块可见工作区
    const attrs = await view.evaluate((el) => ({
      marginX: Number((el as HTMLElement).dataset.outsideMargin),
      marginY: Number((el as HTMLElement).dataset.outsideMarginY),
      canvasW: Number((el as HTMLElement).dataset.canvasWidth),
      canvasH: Number((el as HTMLElement).dataset.canvasHeight)
    }))
    expect(attrs.marginX).toBeGreaterThanOrEqual(150)
    expect(attrs.marginY).toBeGreaterThanOrEqual(150)
    expect(attrs.canvasW).toBe(1000 + 2 * attrs.marginX)
    expect(attrs.canvasH).toBe(700 + 2 * attrs.marginY)
    const workspace = await w.locator('[data-testid="workspace-viewport"]').evaluate((el) => ({
      width: el.clientWidth,
      height: el.clientHeight
    }))
    expect(attrs.canvasW).toBeGreaterThanOrEqual(workspace.width - 2)
    expect(attrs.canvasH).toBeGreaterThanOrEqual(workspace.height - 2)
    // 外环显示留白，纸张自身的形状路径仍参与裁切
    await expect(w.locator('[data-testid="paper-clip-margin"]')).toHaveCount(1)
    await expect(w.locator('[data-testid="paper-clip-shape"]')).toHaveCount(1)

    // 位图右留白里出现文字像素：内容出了画布不再被裁掉
    const overflowPixels = await w.evaluate(() => {
      const canvas = document.querySelector('canvas.lower-canvas') as HTMLCanvasElement | null
      const ctx = canvas?.getContext('2d')
      if (!canvas || !ctx) return -1
      const rect = canvas.getBoundingClientRect()
      if (rect.width <= 0) return -1
      const ratio = canvas.width / rect.width
      const margin = (rect.width - 1000) / 2
      if (margin <= 1) return -1
      const startX = Math.round((margin + 1000 + 1) * ratio)
      const endX = canvas.width
      if (endX - startX <= 0) return -1
      const data = ctx.getImageData(startX, 0, endX - startX, canvas.height).data
      let count = 0
      for (let i = 3; i < data.length; i += 4) if (data[i] > 0) count++
      return count
    })
    expect(overflowPixels).toBeGreaterThan(0)

    // 关闭后恢复原样：画布回到纸张大小，只剩纸张裁切
    await toggleOutsideView(w, false)
    await expect(view).toHaveAttribute('data-show-outside', 'false')
    await expect(view).toHaveAttribute('data-outside-margin', '0')
    await expect(view).toHaveAttribute('data-canvas-width', '1000')
    await expect(w.locator('[data-testid="paper-clip-margin"]')).toHaveCount(0)
    await expect(w.locator('[data-testid="paper-clip-shape"]')).toHaveCount(1)
  } finally {
    await launched.close()
  }
})
