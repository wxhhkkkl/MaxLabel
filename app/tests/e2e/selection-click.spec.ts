import { test, expect, type Page } from '@playwright/test'
import { launchApp } from './fixtures/electron-app'

async function createLabel(page: Page): Promise<void> {
  await page.locator('[data-testid="toolbar"] button[title="新建标签模版"]').click()
  await page.locator('[data-testid="new-label-dialog"]').waitFor({ timeout: 10_000 })
  // 两个对象要互不重叠：默认卷筒 40×30 上，300px 与 620px 两处点击会落在同一片区域。
  await page.locator('[data-testid="new-label-param-width"]').fill('100')
  await page.locator('[data-testid="new-label-param-height"]').fill('70')
  await page.locator('[data-testid="new-label-select"]').click()
  await expect(page.locator('[data-testid="toolbar"]')).toBeVisible({ timeout: 10_000 })
}

type Snapshot = { ids: string[]; zoom: number; boxes: Array<{ id: string; left: number; top: number; width: number; height: number }> }

async function snapshot(page: Page): Promise<Snapshot> {
  const raw = await page.locator('[data-active-fabric-selection]').first().getAttribute('data-active-fabric-selection')
  return JSON.parse(raw ?? '{}') as Snapshot
}

/** 多选后点其中一个成员，应该收敛成只选它（否则后续居中/对齐会作用到整组）。 */
test('clicking a member of a multi-selection selects only that object', async () => {
  const launched = await launchApp()
  const w = launched.window
  try {
    await createLabel(w)
    const canvas = w.locator('canvas').first()
    await w.locator('[data-tool="text"]').click()
    await canvas.click({ position: { x: 300, y: 280 }, force: true })
    await w.waitForTimeout(300)
    // 用两个文字对象：条码要走 bwip 异步实测，补丁触发的重建可能在 Ctrl+A 之后清掉多选。
    await w.locator('[data-tool="text"]').click()
    await canvas.click({ position: { x: 620, y: 380 }, force: true })
    await expect(w.locator('[data-testid="layer-object-row"]')).toHaveCount(2)

    await w.keyboard.press('Control+A')
    await expect.poll(async () => (await snapshot(w)).ids.length).toBe(2)
    const before = await snapshot(w)
    const target = before.boxes[0]
    const box = await canvas.boundingBox()
    if (!box) throw new Error('canvas has no bounding box')

    await w.mouse.click(
      box.x + (target.left + target.width / 2) * before.zoom,
      box.y + (target.top + target.height / 2) * before.zoom
    )
    await expect.poll(async () => (await snapshot(w)).ids.length).toBe(1)

    // 此时应只选中被点的那一个：垂直居中只移动它，另一个元素保持原位。
    const other = before.boxes.find((item) => item.id !== target.id)
    if (!other) throw new Error('missing second object')
    await w.locator('[data-testid="align-bar"] button[title="垂直居中"]').click()
    await w.keyboard.press('Control+A')
    await expect.poll(async () => (await snapshot(w)).ids.length).toBe(2)
    const afterCenter = await snapshot(w)
    const otherAfter = afterCenter.boxes.find((item) => item.id === other.id)
    if (!otherAfter) throw new Error('missing second object after centering')
    expect(Math.abs(otherAfter.left - other.left)).toBeLessThan(1)
    expect(Math.abs(otherAfter.top - other.top)).toBeLessThan(1)
    const movedAfter = afterCenter.boxes.find((item) => item.id === target.id)
    expect(movedAfter && Math.abs(movedAfter.top - target.top) > 1).toBe(true)
  } finally {
    await launched.close()
  }
})
