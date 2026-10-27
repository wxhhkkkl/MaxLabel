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
