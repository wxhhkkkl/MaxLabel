import { test, expect, type Page } from '@playwright/test'
import { launchApp } from './fixtures/electron-app'

async function createLabel(page: Page): Promise<void> {
  await page.locator('[data-testid="toolbar"] button[title="新建标签模版"]').click()
  await page.locator('[data-testid="new-label-dialog"]').waitFor({ timeout: 10_000 })
  await page.locator('[data-testid="new-label-select"]').click()
  await expect(page.locator('[data-testid="toolbar"]')).toBeVisible({ timeout: 10_000 })
}

type Box = { id: string; left: number; top: number; width: number; height: number }

async function readBoxes(page: Page): Promise<Box[]> {
  const raw = await page.locator('[data-active-fabric-selection]').first().getAttribute('data-active-fabric-selection')
  return (JSON.parse(raw ?? '{}').boxes ?? []) as Box[]
}

/**
 * 对齐必须按画布可见包围盒（文字字形宽度、条码实际绘制区域），
 * 而不是模型框——文字新建时模型框 40mm 宽，字只占中间一小块。
 */
test('align uses rendered bounds and the selection edge as reference', async () => {
  const launched = await launchApp()
  const w = launched.window
  try {
    await createLabel(w)
    const canvas = w.locator('canvas').first()
    await w.locator('[data-tool="text"]').click()
    await canvas.click({ position: { x: 300, y: 280 }, force: true })
    await w.waitForTimeout(300)
    await w.locator('[data-tool="barcode"]').click()
    await canvas.click({ position: { x: 600, y: 420 }, force: true })
    await w.waitForTimeout(500)

    // 框选两个对象，读可见包围盒。
    const box = await canvas.boundingBox()
    if (!box) throw new Error('canvas has no bounding box')
    await w.mouse.move(box.x + 8, box.y + 8)
    await w.mouse.down()
    await w.mouse.move(box.x + box.width - 8, box.y + box.height - 8, { steps: 12 })
    await w.mouse.up()
    await expect.poll(async () => (await readBoxes(w)).length).toBe(2)

    const before = await readBoxes(w)
    const beforeLefts = new Map(before.map((item) => [item.id, item.left]))
    await w.locator('[data-testid="align-bar"] button[title="左齐"]').click()

    // 左齐后所有可见左边界应等于并集最左；且至少一个对象确实移动过。
    await expect.poll(async () => {
      const boxes = await readBoxes(w)
      if (boxes.length !== 2) return false
      const min = Math.min(...boxes.map((item) => item.left))
      return boxes.every((item) => Math.abs(item.left - min) <= 1)
    }).toBe(true)
    const afterLeft = await readBoxes(w)
    expect(afterLeft.some((item) => Math.abs(item.left - (beforeLefts.get(item.id) ?? item.left)) > 5)).toBe(true)

    const beforeTops = new Map(afterLeft.map((item) => [item.id, item.top]))
    await w.locator('[data-testid="align-bar"] button[title="顶齐"]').click()

    // 顶齐 = 并集最高边（最高的元素），不是第一个选中对象。
    await expect.poll(async () => {
      const boxes = await readBoxes(w)
      if (boxes.length !== 2) return false
      const min = Math.min(...boxes.map((item) => item.top))
      return boxes.every((item) => Math.abs(item.top - min) <= 1)
    }).toBe(true)
    const afterTop = await readBoxes(w)
    expect(afterTop.some((item) => Math.abs(item.top - (beforeTops.get(item.id) ?? item.top)) > 5)).toBe(true)
  } finally {
    await launched.close()
  }
})
