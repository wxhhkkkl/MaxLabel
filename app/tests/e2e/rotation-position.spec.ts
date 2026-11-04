import { test, expect, type Page } from '@playwright/test'
import { launchApp, pickShapeTool } from './fixtures/electron-app'

/**
 * 现场反馈：表格左旋 90° 后位置夸张偏移。
 *
 * 模型约定 x/y 是「未旋转框的左上角」、旋转绕对象框中心；Fabric 以 origin（左上角）
 * 为旋转支点。渲染时未补偿会把对象甩出去，拖动回写时又把补偿后的 left/top 当成 x/y。
 * 这里同时盯住旋转后的模型坐标和「旋转后还能在原中心拖动」。
 */

async function createLabel(page: Page): Promise<void> {
  await page.locator('[data-testid="toolbar"] button[title="新建标签模版"]').click()
  await page.locator('[data-testid="new-label-dialog"]').waitFor({ timeout: 10_000 })
  await page.locator('[data-testid="new-label-select"]').click()
  await expect(page.locator('[data-testid="toolbar"]')).toBeVisible({ timeout: 10_000 })
}

type Row = { x: number; y: number; w: number; h: number; rotation: number }

async function objectRow(page: Page): Promise<Row> {
  const row = page.locator('[data-testid="layer-object-row"]').last()
  return {
    x: Number(await row.getAttribute('data-object-x')),
    y: Number(await row.getAttribute('data-object-y')),
    w: Number(await row.getAttribute('data-object-w')),
    h: Number(await row.getAttribute('data-object-h')),
    rotation: Number(await row.getAttribute('data-object-rotation'))
  }
}

for (const kind of ['table', 'rect', 'barcode'] as const) {
  test(`${kind} 左旋 90° 后位置不偏移，且仍可从中心拖动`, async () => {
    const launched = await launchApp()
    const w = launched.window
    try {
      await createLabel(w)
      if (kind === 'rect') await pickShapeTool(w)
      else await w.locator(`[data-tool="${kind}"]`).click()
      const canvas = w.locator('canvas').first()
      const at = kind === 'barcode' ? { x: 400, y: 260 } : { x: 300, y: 300 }
      await canvas.click({ position: at, force: true })
      if (kind === 'barcode') {
        // 一维码异步实测条宽，等它收正后再记录基准。
        await expect.poll(async () => {
          const row = w.locator('[data-testid="layer-object-row"]').last()
          return Number(await row.getAttribute('data-object-w'))
        }).toBeLessThan(30)
      }
      await w.waitForTimeout(500)
      const before = await objectRow(w)

      await w.locator('[data-testid="align-bar"] button[title="左旋90度"]').click()
      await w.waitForTimeout(500)
      const rotated = await objectRow(w)
      expect(rotated).toEqual({ ...before, rotation: 270 })

      const zoom = Number(await w.locator('[data-testid="status-zoom"] input').inputValue()) / 100
      const box = await canvas.boundingBox()
      if (!box) throw new Error('canvas has no bounding box')
      const cx = box.x + (before.x + before.w / 2) * 10 * zoom
      const cy = box.y + (before.y + before.h / 2) * 10 * zoom
      await w.mouse.move(cx, cy)
      await w.mouse.down()
      await w.mouse.move(cx + 50, cy + 35, { steps: 8 })
      await w.mouse.up()
      await w.waitForTimeout(500)

      const dragged = await objectRow(w)
      expect(dragged.w).toBe(before.w)
      expect(dragged.h).toBe(before.h)
      expect(dragged.rotation).toBe(270)
      expect(Math.abs(dragged.x - (before.x + 50 / (10 * zoom)))).toBeLessThan(0.4)
      expect(Math.abs(dragged.y - (before.y + 35 / (10 * zoom)))).toBeLessThan(0.4)
    } finally {
      await launched.close()
    }
  })
}
