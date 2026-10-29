import { test, expect, type Page } from '@playwright/test'
import { launchApp } from './fixtures/electron-app'

interface Transform { left: number; top: number; width: number; height: number; scaleX: number; scaleY: number; zoom?: number; originX?: string; originY?: string }

async function readTransform(w: Page): Promise<Transform> {
  const locator = w.locator('[data-active-fabric-transform]').first()
  await locator.waitFor({ state: 'attached', timeout: 10_000 })
  return JSON.parse((await locator.getAttribute('data-active-fabric-transform')) ?? '{}')
}

function boxOf(t: Transform, canvasBox: { x: number; y: number }) {
  const z = t.zoom ?? 1
  const wpx = t.width * (t.scaleX ?? 1)
  const hpx = t.height * (t.scaleY ?? 1)
  const offX = t.originX === 'center' ? 0 : t.originX === 'right' ? -wpx / 2 : wpx / 2
  const offY = t.originY === 'center' || t.originY === 'middle' ? 0 : t.originY === 'bottom' ? -hpx / 2 : hpx / 2
  return { cx: canvasBox.x + (t.left + offX) * z, cy: canvasBox.y + (t.top + offY) * z, wpx: wpx * z, hpx: hpx * z }
}

test('条码拖小高度后，全量重建不会弹回原高度', async () => {
  const launched = await launchApp()
  const w = launched.window
  const errors: string[] = []
  w.on('pageerror', (e) => errors.push(String(e)))
  try {
    await w.locator('[data-testid="toolbar"] button[title="新建标签模版"]').click()
    await w.locator('[data-testid="new-label-dialog"]').waitFor({ timeout: 10_000 })
    await w.locator('[data-testid="new-label-select"]').click()
    await expect(w.locator('[data-testid="toolbar"]')).toBeVisible({ timeout: 10_000 })

    await w.locator('[data-tool="barcode"]').click()
    const canvas = w.locator('canvas').first()
    // 首次点击偶尔会被残留弹窗吞掉，重试到条码真的被选中为止
    for (let attempt = 0; attempt < 3; attempt++) {
      await canvas.click({ position: { x: 220, y: 200 }, force: true })
      await w.waitForTimeout(600)
      if (await w.locator('[data-active-fabric-transform]').count()) break
    }

    const canvasBox = await canvas.boundingBox()
    if (!canvasBox) throw new Error('no canvas')

    const before = await readTransform(w)
    const b0 = boxOf(before, canvasBox)
    // 拖底边中点上移，把高度压到约 60%
    const handleX = b0.cx
    const handleY = b0.cy + b0.hpx / 2
    await w.mouse.move(handleX, handleY)
    await w.mouse.down()
    await w.mouse.move(handleX, handleY - b0.hpx * 0.4, { steps: 8 })
    await w.mouse.up()
    await w.waitForTimeout(400)

    const resized = await readTransform(w)
    const b1 = boxOf(resized, canvasBox)
    expect(b1.hpx).toBeLessThan(b0.hpx * 0.8)

    // 松手后条码必须已经重画过：x/y 缩放一致（不再是把整张图拉伸），
    // 且素材高度换成了新长度 —— 否则供人识读字符会一直停在拉伸态。
    expect(Math.abs((resized.scaleY ?? 0) - (resized.scaleX ?? 0))).toBeLessThan(5e-3)
    expect(resized.height).not.toBe(before.height)

    // 触发一次全量重建（与切换数据记录走同一条路径）
    await w.locator('[data-tool="rect"]').click()
    await canvas.click({ position: { x: 460, y: 300 }, force: true })
    await w.waitForTimeout(600)

    // 重新选中条码读一次
    await w.locator('[data-tool="select"]').click()
    await w.mouse.click(b1.cx, b1.cy)
    await w.waitForTimeout(300)
    const after = await readTransform(w)
    const b2 = boxOf(after, canvasBox)
    expect(Math.abs(b2.hpx - b1.hpx)).toBeLessThan(b0.hpx * 0.08)
    expect(errors).toEqual([])
  } finally {
    await launched.close()
  }
})
