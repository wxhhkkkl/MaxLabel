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

test('文字缩放：角手柄等比、边手柄单向，松手后尺寸保留', async () => {
  const launched = await launchApp()
  const w = launched.window
  try {
    await w.locator('[data-testid="toolbar"] button[title="新建标签模版"]').click()
    await w.locator('[data-testid="new-label-dialog"]').waitFor({ timeout: 10_000 })
    await w.locator('[data-testid="new-label-select"]').click()
    await w.locator('[data-testid="toolbar"]').waitFor({ timeout: 10_000 })

    await w.locator('[data-tool="text"]').click()
    const canvas = w.locator('canvas').first()
    for (let attempt = 0; attempt < 3; attempt++) {
      await canvas.click({ position: { x: 300, y: 250 }, force: true })
      await w.waitForTimeout(500)
      if (await w.locator('[data-active-fabric-transform]').count()) break
    }
    const canvasBox = await canvas.boundingBox()
    if (!canvasBox) throw new Error('no canvas')

    // 角手柄：往右下拖，横纵必须同比例放大（此前纵向会反向缩小）
    const before = await readTransform(w)
    const b0 = boxOf(before, canvasBox)
    const hx = b0.cx + b0.wpx / 2
    const hy = b0.cy + b0.hpx / 2
    await w.mouse.move(hx, hy)
    await w.mouse.down()
    await w.mouse.move(hx + b0.wpx * 0.2, hy + b0.hpx * 0.2, { steps: 6 })
    await w.waitForTimeout(150)
    const mid = await readTransform(w)
    expect(Math.abs((mid.scaleX ?? 1) - (mid.scaleY ?? 1))).toBeLessThan(0.02)
    await w.mouse.up()
    await w.waitForTimeout(400)

    const afterCorner = boxOf(await readTransform(w), canvasBox)
    expect(afterCorner.wpx).toBeGreaterThan(b0.wpx * 1.1)
    expect(afterCorner.hpx).toBeGreaterThan(b0.hpx * 1.1)

    // 边手柄（右中）：只放大宽度，高度不改
    await w.locator('[data-tool="select"]').click()
    await w.mouse.click(afterCorner.cx, afterCorner.cy)
    await w.waitForTimeout(300)
    const c0 = boxOf(await readTransform(w), canvasBox)
    await w.mouse.move(c0.cx + c0.wpx / 2, c0.cy)
    await w.mouse.down()
    await w.mouse.move(c0.cx + c0.wpx / 2 + 20, c0.cy, { steps: 6 })
    await w.waitForTimeout(150)
    const edge = await readTransform(w)
    expect(Math.abs((edge.scaleY ?? 1) - 1)).toBeLessThan(0.02)
    expect(edge.scaleX ?? 1).toBeGreaterThan(1.05)
    await w.mouse.up()
    await w.waitForTimeout(400)

    // 松手后尺寸不能弹回原样
    const afterEdge = boxOf(await readTransform(w), canvasBox)
    expect(afterEdge.wpx).toBeGreaterThan(c0.wpx * 1.05)
    expect(afterEdge.hpx).toBeGreaterThan(c0.hpx * 0.95)

    // 左上角手柄：对面（右下角）必须钉住不动，不能带着整个对象平移
    await w.locator('[data-tool="select"]').click()
    await w.mouse.click(afterEdge.cx, afterEdge.cy)
    await w.waitForTimeout(300)
    const d0 = boxOf(await readTransform(w), canvasBox)
    const fixedBr = { x: d0.cx + d0.wpx / 2, y: d0.cy + d0.hpx / 2 }
    await w.mouse.move(d0.cx - d0.wpx / 2, d0.cy - d0.hpx / 2)
    await w.mouse.down()
    await w.mouse.move(d0.cx - d0.wpx / 2 - 20, d0.cy - d0.hpx / 2 - 20, { steps: 6 })
    await w.waitForTimeout(150)
    const tlMid = boxOf(await readTransform(w), canvasBox)
    expect(Math.abs(tlMid.cx + tlMid.wpx / 2 - fixedBr.x)).toBeLessThan(3)
    expect(Math.abs(tlMid.cy + tlMid.hpx / 2 - fixedBr.y)).toBeLessThan(3)
    await w.mouse.up()
    await w.waitForTimeout(400)
    const tlAfter = boxOf(await readTransform(w), canvasBox)
    expect(tlAfter.wpx).toBeGreaterThan(d0.wpx * 1.05)
    expect(Math.abs(tlAfter.cx + tlAfter.wpx / 2 - fixedBr.x)).toBeLessThan(3)
    expect(Math.abs(tlAfter.cy + tlAfter.hpx / 2 - fixedBr.y)).toBeLessThan(3)

    // 纵向拉伸后，再用角手柄缩放：不能先把纵向拉伸取消掉
    await w.locator('[data-tool="select"]').click()
    await w.mouse.click(tlAfter.cx, tlAfter.cy)
    await w.waitForTimeout(300)
    const e0 = boxOf(await readTransform(w), canvasBox)
    await w.mouse.move(e0.cx, e0.cy + e0.hpx / 2)
    await w.mouse.down()
    await w.mouse.move(e0.cx, e0.cy + e0.hpx / 2 + 30, { steps: 6 })
    await w.waitForTimeout(150)
    await w.mouse.up()
    await w.waitForTimeout(400)
    const stretched = boxOf(await readTransform(w), canvasBox)
    expect(stretched.hpx / stretched.wpx).toBeGreaterThan((e0.hpx / e0.wpx) * 1.15)

    await w.locator('[data-tool="select"]').click()
    await w.mouse.click(stretched.cx, stretched.cy)
    await w.waitForTimeout(300)
    const s0 = boxOf(await readTransform(w), canvasBox)
    const stretchedRatio = s0.hpx / s0.wpx
    await w.mouse.move(s0.cx + s0.wpx / 2, s0.cy + s0.hpx / 2)
    await w.mouse.down()
    await w.mouse.move(s0.cx + s0.wpx / 2 + 12, s0.cy + s0.hpx / 2 + 12, { steps: 6 })
    await w.waitForTimeout(150)
    const cornerMid = boxOf(await readTransform(w), canvasBox)
    expect(Math.abs(cornerMid.hpx / cornerMid.wpx - stretchedRatio) / stretchedRatio).toBeLessThan(0.08)
    await w.mouse.up()
    await w.waitForTimeout(400)
  } finally {
    await launched.close()
  }
})
