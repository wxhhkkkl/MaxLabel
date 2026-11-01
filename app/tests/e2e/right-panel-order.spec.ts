import { test, expect } from '@playwright/test'
import { launchApp } from './fixtures/electron-app'

/**
 * 右侧栏顺序（020 现场）：打印面板固定在**上**，对象属性在**下**。
 *
 * 选中对象时属性面板出现/消失，打印面板的位置不应随之上下跳。
 */
test('打印面板在对象属性上方', async () => {
  const launched = await launchApp()
  const w = launched.window
  try {
    await w.locator('[data-testid="toolbar"] button[title="新建标签模版"]').click()
    await w.locator('[data-testid="new-label-dialog"]').waitFor({ timeout: 10_000 })
    await w.locator('[data-testid="new-label-select"]').click()
    await expect(w.locator('[data-testid="toolbar"]')).toBeVisible({ timeout: 10_000 })

    const dockTopBefore = (await w.locator('[data-testid="print-dock"]').boundingBox())?.y ?? 0

    await w.locator('[data-tool="text"]').click()
    await w.locator('canvas').first().click({ position: { x: 400, y: 300 }, force: true })
    await w.waitForTimeout(300)
    // 020：属性面板默认不显示，从「查看 → 常用属性」打开
    await expect(w.locator('[data-testid="property-panel"]')).toHaveCount(0)
    await w.locator('[data-menu-title="查看(V)"]').click()
    await w.locator('[data-menu-item="常用属性"]').click()
    await expect(w.locator('[data-testid="property-panel"]')).toBeVisible()

    const dock = await w.locator('[data-testid="print-dock"]').boundingBox()
    const panel = await w.locator('[data-testid="property-panel"]').boundingBox()
    expect(dock!.y).toBeLessThan(panel!.y)
    // 选中对象后打印面板仍从同一高度开始
    expect(Math.abs((dock!.y) - dockTopBefore)).toBeLessThan(2)
  } finally {
    await launched.close()
  }
})
