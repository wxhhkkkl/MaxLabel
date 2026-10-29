import { expect, test, type Page } from '@playwright/test'
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

async function info(w: Page): Promise<string> {
  return (await w.locator('[data-testid="status-object-info"]').textContent()) ?? ''
}

test('二维码带人读文字时始终等比、且重画后尺寸稳定', async () => {
  const launched = await launchApp()
  const w = launched.window
  try {
    await w.locator('[data-testid="toolbar"] button[title="新建标签模版"]').click()
    await w.locator('[data-testid="new-label-dialog"]').waitFor({ timeout: 10_000 })
    await w.locator('[data-testid="new-label-select"]').click()
    await w.locator('[data-testid="toolbar"]').waitFor({ timeout: 10_000 })
    await w.locator('[data-tool="barcode"]').click()
    const canvas = w.locator('canvas').first()
    for (let attempt = 0; attempt < 3; attempt++) {
      await canvas.click({ position: { x: 300, y: 240 }, force: true })
      await w.waitForTimeout(500)
      if (await w.locator('[data-active-fabric-transform]').count()) break
    }
    await w.keyboard.press('Alt+Enter')
    await w.locator('[data-testid="object-props-dialog"]').waitFor({ timeout: 10_000 })
    await w.locator('[data-testid="object-props-tab-barcode"]').click()
    await w.locator('[data-testid="barcode-symbology"]').selectOption('qrcode')
    const showText = w.locator('[data-testid="barcode-show-text"]')
    await showText.scrollIntoViewIfNeeded()
    await showText.check()
    await w.locator('[data-testid="object-props-ok"]').click()
    await w.waitForTimeout(600)

    const canvasBox = await canvas.boundingBox()
    if (!canvasBox) throw new Error('no canvas')
    let t = await readTransform(w)
    let b = boxOf(t, canvasBox)
    await w.mouse.move(b.cx + b.wpx / 2, b.cy + b.hpx / 2)
    await w.mouse.down()
    await w.mouse.move(b.cx + b.wpx / 2 + 40, b.cy + b.hpx / 2 + 40, { steps: 6 })
    await w.waitForTimeout(150)
    const mid = await readTransform(w)
    expect(Math.abs(mid.scaleX - mid.scaleY)).toBeLessThan(0.02)
    const midBox = boxOf(mid, canvasBox)
    await w.mouse.up()
    await w.waitForTimeout(700)
    if (!/[WH]: /.test(await info(w))) {
      await w.mouse.click(midBox.cx, midBox.cy)
      await w.waitForTimeout(500)
    }
    const afterInfo = await info(w)
    const size = /W: ([\d.]+), H: ([\d.]+)/.exec(afterInfo)
    if (!size) throw new Error('no geometry after resize')
    expect(Number(size[1])).toBe(Number(size[2]))
    expect(Number(size[1])).toBeGreaterThan(10.5)
    const tl = { x: b.cx - b.wpx / 2, y: b.cy - b.hpx / 2 }
    const sidePx = Number(size[1]) * (t.zoom ?? 1) * 10
    // 触发一次全量重建（加一个矩形），再点回 QR
    await w.locator('[data-tool="rect"]').click()
    await canvas.click({ position: { x: 520, y: 360 }, force: true })
    await w.waitForTimeout(600)
    await w.locator('[data-tool="select"]').click()
    await w.mouse.click(tl.x + sidePx / 2, tl.y + sidePx / 2)
    await w.waitForTimeout(500)
    expect(await info(w)).toBe(afterInfo)
  } finally {
    await launched.close()
  }
})

test('二维码横向拖边手柄也只等比缩放，不会把码拉宽', async () => {
  const launched = await launchApp()
  const w = launched.window
  try {
    await w.locator('[data-testid="toolbar"] button[title="新建标签模版"]').click()
    await w.locator('[data-testid="new-label-dialog"]').waitFor({ timeout: 10_000 })
    await w.locator('[data-testid="new-label-select"]').click()
    await w.locator('[data-testid="toolbar"]').waitFor({ timeout: 10_000 })
    await w.locator('[data-tool="barcode"]').click()
    const canvas = w.locator('canvas').first()
    for (let attempt = 0; attempt < 3; attempt++) {
      await canvas.click({ position: { x: 300, y: 240 }, force: true })
      await w.waitForTimeout(500)
      if (await w.locator('[data-active-fabric-transform]').count()) break
    }
    await w.keyboard.press('Alt+Enter')
    await w.locator('[data-testid="object-props-dialog"]').waitFor({ timeout: 10_000 })
    await w.locator('[data-testid="object-props-tab-barcode"]').click()
    await w.locator('[data-testid="barcode-symbology"]').selectOption('qrcode')
    const showText = w.locator('[data-testid="barcode-show-text"]')
    await showText.scrollIntoViewIfNeeded()
    await showText.check()
    await w.locator('[data-testid="object-props-ok"]').click()
    await w.waitForTimeout(600)

    const canvasBox = await canvas.boundingBox()
    if (!canvasBox) throw new Error('no canvas')
    const before = await readTransform(w)
    const b = boxOf(before, canvasBox)
    await w.mouse.move(b.cx + b.wpx / 2, b.cy)
    await w.mouse.down()
    await w.mouse.move(b.cx + b.wpx / 2 + 50, b.cy, { steps: 6 })
    await w.waitForTimeout(150)
    const mid = await readTransform(w)
    expect(Math.abs(mid.scaleX - mid.scaleY) / mid.scaleY).toBeLessThan(0.02)
    const midBox = boxOf(mid, canvasBox)
    await w.mouse.up()
    await w.waitForTimeout(600)

    // 松手后对象可能被重建并丢选：点回二维码再读尺寸。
    if (!/[WH]: /.test(await info(w))) {
      await w.mouse.click(midBox.cx, midBox.cy)
      await w.waitForTimeout(500)
    }
    const size = /W: ([\d.]+), H: ([\d.]+)/.exec(await info(w))
    if (!size) throw new Error('no geometry after resize')
    expect(Number(size[1])).toBe(Number(size[2]))
    expect(Number(size[1])).toBeGreaterThan(10.5)
  } finally {
    await launched.close()
  }
})
