import { test, expect, type Page } from '@playwright/test'
import { launchApp } from './fixtures/electron-app'

/**
 * 015：数据工具点到一个**没有数据源**的对象时，ChangeDataDialog 会读 `source.kind`
 * 而崩在 `Cannot read properties of undefined (reading 'kind')`。
 * 这里直接把一个没有 source 的文本对象塞进文档来复现。
 */
test('data tool survives an object without a data source', async () => {
  const launched = await launchApp()
  const w = launched.window
  const errors: string[] = []
  w.on('pageerror', (e) => errors.push(String(e)))
  try {
    await w.locator('[data-testid="toolbar"] button[title="新建标签模版"]').click()
    await w.locator('[data-testid="new-label-dialog"]').waitFor({ timeout: 10_000 })
    await w.locator('[data-testid="new-label-select"]').click()
    await expect(w.locator('[data-testid="toolbar"]')).toBeVisible({ timeout: 10_000 })

    // 用一个没有数据源的矩形对象，然后用数据工具点它
    await w.locator('[data-tool="rect"]').click()
    const canvas = w.locator('canvas').first()
    // 拖出一个矩形（单击会建默认大小，也可以）
    await canvas.click({ position: { x: 420, y: 320 }, force: true })
    await w.waitForTimeout(500)

    const t = JSON.parse((await w.locator('[data-active-fabric-transform]').first().getAttribute('data-active-fabric-transform')) ?? '{}')
    const box = await canvas.boundingBox()
    if (!box) throw new Error('no box')
    const z = t.zoom ?? 1
    const wpx = t.width * (t.scaleX ?? 1)
    const hpx = t.height * (t.scaleY ?? 1)
    // 对象的 left/top 是**原点**的位置，原点可能是 left/center/right、top/middle/bottom
    const offX = t.originX === 'center' ? 0 : t.originX === 'right' ? -wpx / 2 : wpx / 2
    const offY = t.originY === 'center' || t.originY === 'middle' ? 0 : t.originY === 'bottom' ? -hpx / 2 : hpx / 2
    const cx = box.x + (t.left + offX) * z
    const cy = box.y + (t.top + offY) * z

    await w.locator('[data-tool="data"]').click()
    await w.mouse.click(cx, cy)
    await w.waitForTimeout(700)
    expect(errors.filter((e) => e.includes("reading 'kind'"))).toEqual([])
    // 不弹「修改数据」框，只在状态栏提示一句
    await expect(w.locator('[data-testid="change-data-dialog"]')).toHaveCount(0)
    await expect(w.locator('[data-testid="status-bar"]')).toHaveAttribute('title', /没有数据源/)
  } finally {
    await launched.close()
  }
})
