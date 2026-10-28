import { test, expect, type Page } from '@playwright/test'
import { launchApp } from './fixtures/electron-app'

async function createLabel(page: Page): Promise<void> {
  await page.locator('[data-testid="toolbar"] button[title="新建标签模版"]').click()
  await page.locator('[data-testid="new-label-dialog"]').waitFor({ timeout: 10_000 })
  await page.locator('[data-testid="new-label-select"]').click()
  await expect(page.locator('[data-testid="toolbar"]')).toBeVisible({ timeout: 10_000 })
}

/** 015 现场反馈：画布上 Ctrl+拖动对象应该复制出一个副本。 */
test('ctrl-drag on the canvas duplicates the object', async () => {
  const launched = await launchApp()
  const w = launched.window
  try {
    await createLabel(w)
    // 放一个文本对象（创建后工具自动回到选择工具，且新对象处于选中态）。
    await w.locator('[data-tool="text"]').click()
    const canvas = w.locator('canvas').first()
    await canvas.click({ position: { x: 300, y: 300 }, force: true })

    const box = await canvas.boundingBox()
    if (!box) throw new Error('canvas has no bounding box')
    await w.mouse.move(box.x + 500, box.y + 320)
    await w.keyboard.down('Control')
    await w.mouse.down()
    await w.mouse.move(box.x + 600, box.y + 420, { steps: 12 })

    // 拖动过程中原位要留着影子：观感上「拖走的是副本，原件没动」。
    await expect(w.locator('[data-ctrl-ghosts="1"]')).toHaveCount(1)

    await w.mouse.up()
    await w.keyboard.up('Control')

    // 松手后影子撤掉，副本由文档层落到同一坐标。
    await expect(w.locator('[data-ctrl-ghosts]')).toHaveCount(0)
    await expect(w.locator('[data-testid="status-bar"]')).toHaveAttribute('title', /已复制/)

    // 副本确实进了文档：全选复制时应该数到 2 个对象。
    // 副本由 reconcile 异步补进画布，等它到位再全选，避免和重绘抢时序。
    await expect(w.locator('[data-rendered-object-types]').first()).toHaveAttribute('data-rendered-object-types', /,/)
    await w.keyboard.press('Control+A')
    await w.keyboard.press('Control+C')
    await expect(w.locator('[data-testid="status-bar"]')).toHaveAttribute('title', /已复制 2 个对象/)
  } finally {
    await launched.close()
  }
})

/** 不按 Ctrl 时仍然是普通拖动：整张标签上只会有一个对象。 */
test('plain drag does not duplicate', async () => {
  const launched = await launchApp()
  const w = launched.window
  try {
    await createLabel(w)
    await w.locator('[data-tool="text"]').click()
    const canvas = w.locator('canvas').first()
    await canvas.click({ position: { x: 300, y: 300 }, force: true })

    const box = await canvas.boundingBox()
    if (!box) throw new Error('canvas has no bounding box')
    await w.mouse.move(box.x + 500, box.y + 320)
    await w.mouse.down()
    await w.mouse.move(box.x + 600, box.y + 420, { steps: 12 })
    // 不按 Ctrl 时不该出现影子。
    await expect(w.locator('[data-ctrl-ghosts]')).toHaveCount(0)
    await w.mouse.up()

    await w.keyboard.press('Control+A')
    await w.keyboard.press('Control+C')
    await expect(w.locator('[data-testid="status-bar"]')).toHaveAttribute('title', /已复制对象/)
  } finally {
    await launched.close()
  }
})

/**
 * 条码是自定义的 SvgFragmentObject。fabric 默认的 clone 走 classRegistry 认不出它，
 * 会退化成「什么都不画」的普通对象——影子和副本都会看不见。
 */
test('ctrl-drag duplicates a barcode (custom vector object)', async () => {
  const launched = await launchApp()
  const w = launched.window
  try {
    await createLabel(w)
    await w.locator('[data-tool="barcode"]').click()
    const canvas = w.locator('canvas').first()
    await canvas.click({ position: { x: 420, y: 320 }, force: true })
    await w.waitForTimeout(500)

    const transform = JSON.parse(
      (await w.locator('[data-active-fabric-transform]').first().getAttribute('data-active-fabric-transform')) ?? '{}'
    )
    const box = await canvas.boundingBox()
    if (!box) throw new Error('canvas has no bounding box')
    const zoom = transform.zoom ?? 1
    const startX = box.x + (transform.left + (transform.width * (transform.scaleX ?? 1)) / 2) * zoom
    const startY = box.y + transform.top * zoom

    await w.mouse.move(startX, startY)
    await w.keyboard.down('Control')
    await w.mouse.down()
    await w.mouse.move(startX + 320, startY + 150, { steps: 14 })

    await expect(w.locator('[data-ctrl-ghosts="1"]')).toHaveCount(1)

    // 影子必须真的画出来：原件已经被拖走，原位上还能读到黑色竖条才算数。
    const originRect = {
      x: Math.round(transform.left * zoom),
      y: Math.round((transform.top - (transform.height * (transform.scaleY ?? 1)) / 2) * zoom),
      w: Math.round(transform.width * (transform.scaleX ?? 1) * zoom),
      h: Math.round(transform.height * (transform.scaleY ?? 1) * zoom)
    }
    const darkAtOrigin = await w.evaluate((r) => {
      const el = document.querySelector('.lower-canvas') as HTMLCanvasElement | null
      const ctx = el?.getContext('2d')
      if (!el || !ctx) return -1
      const { data } = ctx.getImageData(r.x, r.y, r.w, r.h)
      let count = 0
      for (let i = 0; i < data.length; i += 4) {
        if (data[i] < 100 && data[i + 1] < 100 && data[i + 2] < 100) count += 1
      }
      return count
    }, originRect)
    expect(darkAtOrigin).toBeGreaterThan(100)

    await w.mouse.up()
    await w.keyboard.up('Control')

    await expect(w.locator('[data-testid="status-bar"]')).toHaveAttribute('title', /已复制/)
    // 副本由 reconcile 异步补进画布，等它到位再全选，避免和重绘抢时序。
    await expect(w.locator('[data-rendered-object-types]').first()).toHaveAttribute('data-rendered-object-types', /,/)
    await w.keyboard.press('Control+A')
    await w.keyboard.press('Control+C')
    await expect(w.locator('[data-testid="status-bar"]')).toHaveAttribute('title', /已复制 2 个对象/)
  } finally {
    await launched.close()
  }
})
