import { test, expect, type Page } from '@playwright/test'
import { launchApp, pickShapeTool } from './fixtures/electron-app'

/** 下层 canvas 上蓝色预览（#1E90FF）的屏幕包围盒。 */
async function bluePreviewBounds(page: Page): Promise<{ left: number; top: number; right: number; bottom: number } | null> {
  return page.evaluate(() => {
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
}

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

    await pickShapeTool(w)
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

/**
 * 新建一维码：对象框必须等于实际渲染尺寸。
 * 默认 10 mil 窄条 × 90 个模块（含静区）= 22.86mm；旧行为固定 44mm，
 * 画布上选区与实际条码两套尺寸，打印时按框左边落点还会整体偏左。
 */
test('click-created 1D barcode frame matches the rendered barcode size', async () => {
  const launched = await launchApp()
  const w = launched.window
  try {
    await w.locator('[data-testid="toolbar"] button[title="新建标签模版"]').click()
    await w.locator('[data-testid="new-label-dialog"]').waitFor({ timeout: 10_000 })
    await w.locator('[data-testid="new-label-select"]').click()
    await expect(w.locator('[data-testid="toolbar"]')).toBeVisible({ timeout: 10_000 })

    await w.locator('[data-testid="toolbar"] button[title="选择工具：条码"]').click()
    const box = await w.locator('canvas').first().boundingBox()
    if (!box) throw new Error('no canvas box')
    await w.mouse.click(box.x + box.width / 2, box.y + box.height / 2)

    // 状态栏 [X, Y, W, H]：W 应为实际条宽（90 模块 × 0.254mm），而不是旧的 44mm 默认框
    await expect.poll(async () => {
      const info = (await w.locator('[data-testid="status-object-info"]').textContent()) ?? ''
      return Number([...info.matchAll(/-?\d+(?:\.\d+)?/g)][2]?.[0] ?? NaN)
    }).toBe(22.86)
    await expect(w.locator('[data-testid="object-out-of-bounds"]')).toHaveCount(0)
  } finally {
    await launched.close()
  }
})

/** 状态栏里当前选中对象的宽高（毫米）。 */
async function selectedSize(page: Page): Promise<{ width: number; height: number }> {
  const info = (await page.locator('[data-testid="status-object-info"]').textContent()) ?? ''
  const match = /W: ([\d.]+), H: ([\d.]+)/.exec(info)
  if (!match) throw new Error(`no geometry: ${info}`)
  return { width: Number(match[1]), height: Number(match[2]) }
}

/** 屏幕坐标附近（半径 radius px）是否存在蓝色预览像素。 */
async function blueAt(page: Page, x: number, y: number, radius = 8): Promise<boolean> {
  return page.evaluate(({ x, y, radius }) => {
    const el = document.querySelectorAll('canvas')[0] as HTMLCanvasElement
    const rect = el.getBoundingClientRect()
    const scale = rect.width > 0 ? el.width / rect.width : 1
    const ctx = el.getContext('2d')
    if (!ctx) return false
    const cx = Math.round((x - rect.left) * scale)
    const cy = Math.round((y - rect.top) * scale)
    const r = Math.round(radius * scale)
    const left = Math.max(0, cx - r)
    const top = Math.max(0, cy - r)
    const width = Math.min(el.width - left, r * 2 + 1)
    const height = Math.min(el.height - top, r * 2 + 1)
    if (width <= 0 || height <= 0) return false
    const img = ctx.getImageData(left, top, width, height)
    for (let i = 0; i < img.data.length; i += 4) {
      const rr = img.data[i], g = img.data[i + 1], b = img.data[i + 2], a = img.data[i + 3]
      if (a > 0 && b > 170 && b - rr > 60 && g > rr) return true
    }
    return false
  }, { x, y, radius })
}

/**
 * 线条工具：拖动时直接画出一条横线/竖线，不显示矩形拖拽框；
 * 带一点纵向偏移的拖动也按主方向吸附，松手后模型只有单向尺寸。
 */
test('line tool drags out a horizontal or vertical line without a drag frame', async () => {
  const launched = await launchApp()
  const w = launched.window
  try {
    await w.locator('[data-testid="toolbar"] button[title="新建标签模版"]').click()
    await w.locator('[data-testid="new-label-dialog"]').waitFor({ timeout: 10_000 })
    await w.locator('[data-testid="new-label-select"]').click()
    await expect(w.locator('[data-testid="toolbar"]')).toBeVisible({ timeout: 10_000 })

    const box = await w.locator('canvas').first().boundingBox()
    if (!box) throw new Error('no canvas box')

    // 横向：纵向也拖了 40px，但预览必须吸附成一条横线（高度远小于 40）。
    await w.locator('[data-tool="line"]').click()
    const sx = Math.round(box.x + 120)
    const sy = Math.round(box.y + 140)
    await w.mouse.move(sx, sy)
    await w.mouse.down()
    await w.mouse.move(sx + 220, sy + 40, { steps: 10 })
    await w.waitForTimeout(250)
    const horizontal = await bluePreviewBounds(w)
    expect(horizontal).not.toBeNull()
    expect(horizontal!.bottom - horizontal!.top).toBeLessThanOrEqual(8)
    expect(horizontal!.right - horizontal!.left).toBeGreaterThan(200)
    await w.mouse.up()
    await w.waitForTimeout(400)

    const hSize = await selectedSize(w)
    expect(hSize.width).toBeGreaterThan(5)
    expect(hSize.height).toBe(0)

    // 纵向：横向偏移 30px，同样吸附成一条竖线。
    await w.locator('[data-tool="line"]').click()
    const vx = Math.round(box.x + 520)
    const vy = Math.round(box.y + 120)
    await w.mouse.move(vx, vy)
    await w.mouse.down()
    await w.mouse.move(vx + 30, vy + 220, { steps: 10 })
    await w.waitForTimeout(250)
    const vertical = await bluePreviewBounds(w)
    expect(vertical).not.toBeNull()
    expect(vertical!.right - vertical!.left).toBeLessThanOrEqual(8)
    expect(vertical!.bottom - vertical!.top).toBeGreaterThan(200)
    await w.mouse.up()
    await w.waitForTimeout(400)

    await expect(w.locator('[data-testid="layer-object-row"]')).toHaveCount(2)
    const vSize = await selectedSize(w)
    expect(vSize.width).toBe(0)
    expect(vSize.height).toBeGreaterThan(5)
  } finally {
    await launched.close()
  }
})

/**
 * 斜线工具：拖动时直接画一条任意方向的线段，不显示矩形拖拽框。
 * 用像素探针区分：线段只经过对角线中点，矩形的上边/左边中点不会有蓝线。
 */
test('diagonal tool drags out a line segment without a drag frame', async () => {
  const launched = await launchApp()
  const w = launched.window
  try {
    await w.locator('[data-testid="toolbar"] button[title="新建标签模版"]').click()
    await w.locator('[data-testid="new-label-dialog"]').waitFor({ timeout: 10_000 })
    await w.locator('[data-testid="new-label-select"]').click()
    await expect(w.locator('[data-testid="toolbar"]')).toBeVisible({ timeout: 10_000 })

    const box = await w.locator('canvas').first().boundingBox()
    if (!box) throw new Error('no canvas box')

    await w.locator('[data-tool="diagonal"]').click()
    const sx = Math.round(box.x + 160)
    const sy = Math.round(box.y + 120)
    const side = 160
    await w.mouse.move(sx, sy)
    await w.mouse.down()
    await w.mouse.move(sx + side, sy + side, { steps: 12 })
    await w.waitForTimeout(250)

    expect(await blueAt(w, sx + side / 2, sy + side / 2, 12)).toBe(true)
    expect(await blueAt(w, sx + side / 2, sy)).toBe(false)
    expect(await blueAt(w, sx, sy + side / 2)).toBe(false)

    await w.mouse.up()
    await w.waitForTimeout(400)
    const size = await selectedSize(w)
    expect(size.width).toBeGreaterThan(5)
    expect(size.height).toBeGreaterThan(5)
    expect(Math.abs(size.width - size.height)).toBeLessThan(0.2)
  } finally {
    await launched.close()
  }
})
