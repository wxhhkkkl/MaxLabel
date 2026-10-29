import { test, expect } from '@playwright/test'
import { launchApp } from './fixtures/electron-app'

/**
 * 回归：拖拽新建对象时，蓝色虚线预览框必须跟鼠标拖出的矩形重合。
 * （fabric 7 的对象默认原点是 center，预览矩形漏写 origin 时整框会偏出半个尺寸，
 *  而最终创建的对象位置却是对的——看起来就是“拉取框不对”。）
 */
test('drag-create preview box tracks the pointer', async () => {
  test.setTimeout(120_000)
  const launched = await launchApp()
  const w = launched.window
  try {
    await w.locator('[data-testid="toolbar"] button[title="新建标签模版"]').click()
    await w.locator('[data-testid="new-label-dialog"]').waitFor({ timeout: 10_000 })
    await w.locator('[data-testid="new-label-select"]').click()
    await expect(w.locator('[data-testid="toolbar"]')).toBeVisible({ timeout: 10_000 })

    const zoomPct = Number(await w.locator('[data-testid="status-zoom"] input').inputValue())
    const box = await w.locator('canvas').first().boundingBox()
    if (!box) throw new Error('no canvas box')

    await w.locator('[data-tool="rect"]').click()
    const sx = Math.round(box.x + 100)
    const sy = Math.round(box.y + 80)
    const ex = sx + 200
    const ey = sy + 100
    await w.mouse.move(sx, sy)
    await w.mouse.down()
    await w.mouse.move(ex, ey, { steps: 10 })
    await w.waitForTimeout(250)

    // 预览框是 #1E90FF 的虚线描边：直接在下层 canvas 的像素里找它的包围盒。
    const preview = await w.evaluate(() => {
      const el = document.querySelectorAll('canvas')[0] as HTMLCanvasElement
      const rect = el.getBoundingClientRect()
      const ctx = el.getContext('2d')
      if (!ctx) return null
      const img = ctx.getImageData(0, 0, el.width, el.height)
      let minX = 1e9, minY = 1e9, maxX = -1, maxY = -1
      for (let y = 0; y < el.height; y++) {
        for (let x = 0; x < el.width; x++) {
          const i = (y * el.width + x) * 4
          const r = img.data[i], g = img.data[i + 1], b = img.data[i + 2], a = img.data[i + 3]
          if (a > 0 && b > 170 && b - r > 60 && g > r) {
            if (x < minX) minX = x
            if (y < minY) minY = y
            if (x > maxX) maxX = x
            if (y > maxY) maxY = y
          }
        }
      }
      if (maxX < 0) return null
      const scale = rect.width > 0 ? el.width / rect.width : 1
      return { left: rect.left + minX / scale, top: rect.top + minY / scale, right: rect.left + maxX / scale, bottom: rect.top + maxY / scale }
    })

    expect(preview).not.toBeNull()
    const tolerance = 4
    expect(Math.abs(preview!.left - sx)).toBeLessThanOrEqual(tolerance)
    expect(Math.abs(preview!.top - sy)).toBeLessThanOrEqual(tolerance)
    expect(Math.abs(preview!.right - ex)).toBeLessThanOrEqual(tolerance)
    expect(Math.abs(preview!.bottom - ey)).toBeLessThanOrEqual(tolerance)

    await w.mouse.up()
    await w.waitForTimeout(400)
    const info = (await w.locator('[data-testid="status-object-info"]').textContent()) ?? ''
    const nums = [...info.matchAll(/-?\d+(?:\.\d+)?/g)].map((m) => Number(m[0]))
    const zoom = zoomPct / 100
    expect(Math.abs(nums[2] - 200 / (10 * zoom))).toBeLessThan(1)
    expect(Math.abs(nums[3] - 100 / (10 * zoom))).toBeLessThan(1)
  } finally {
    await launched.close()
  }
})
