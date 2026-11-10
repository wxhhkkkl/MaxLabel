import { test, expect } from '@playwright/test'
import { launchApp } from './fixtures/electron-app'

/**
 * 越界高亮（020 现场）：对象框超出标签时，画布边界会把超出部分静默裁掉，
 * 用户容易误判成"比例不对"。这里改成画一圈红虚线框，让溢出可见。
 */
test('对象框超出标签时画红虚线框，收进标签后消失', async () => {
  const launched = await launchApp()
  const w = launched.window
  try {
    await w.locator('[data-testid="toolbar"] button[title="新建标签模版"]').click()
    await w.locator('[data-testid="new-label-dialog"]').waitFor({ timeout: 10_000 })
    await w.locator('[data-testid="new-label-select"]').click()
    await expect(w.locator('[data-testid="toolbar"]')).toBeVisible({ timeout: 10_000 })

    await w.locator('[data-tool="text"]').click()
    await w.locator('canvas').first().click({ position: { x: 300, y: 300 }, force: true })
    await w.waitForTimeout(300)
    // 新建的文本框贴合文字（约 16.5mm），100×70 的标签放得下
    await expect(w.locator('[data-testid="object-out-of-bounds"]')).toHaveCount(0)

    // 把文字移到右边界外（90 + 文本框宽度 > 100）
    await w.keyboard.press('Alt+Enter')
    await w.locator('[data-testid="object-props-tab-general"]').click()
    await w.locator('[data-testid="obj-x"]').fill('90')
    await w.locator('[data-testid="object-props-ok"]').click()
    await expect(w.locator('[data-testid="object-out-of-bounds"]')).toHaveCount(1)

    // 开始打印前必须提醒越界；取消后不进入打印流程
    await w.locator('[data-testid="print-submit"]').click()
    await expect(w.locator('[data-testid="print-out-of-bounds-notice"]')).toBeVisible()
    await w.locator('[data-testid="print-out-of-bounds-cancel"]').click()
    await expect(w.locator('[data-testid="print-out-of-bounds-notice"]')).toHaveCount(0)

    // 收回来 → 高亮消失
    await w.keyboard.press('Alt+Enter')
    await w.locator('[data-testid="object-props-tab-general"]').click()
    await w.locator('[data-testid="obj-x"]').fill('10')
    await w.locator('[data-testid="object-props-ok"]').click()
    await expect(w.locator('[data-testid="object-out-of-bounds"]')).toHaveCount(0)
  } finally {
    await launched.close()
  }
})

test('新建文本框贴合文字，不再固定 40mm', async () => {
  const launched = await launchApp()
  const w = launched.window
  try {
    await w.locator('[data-testid="toolbar"] button[title="新建标签模版"]').click()
    await w.locator('[data-testid="new-label-dialog"]').waitFor({ timeout: 10_000 })
    await w.locator('[data-testid="new-label-media-roll"]').check()
    await w.locator('[data-testid="new-label-select"]').click()
    await expect(w.locator('[data-testid="toolbar"]')).toBeVisible({ timeout: 10_000 })

    await w.locator('[data-tool="text"]').click()
    await w.locator('canvas').first().click({ position: { x: 420, y: 300 }, force: true })
    await w.waitForTimeout(300)

    const width = Number(await w.locator('[data-testid="layer-object-row"]').first().getAttribute('data-object-w'))
    // 「文字内容」4 个字 @4mm ≈ 16.5mm；旧实现固定 40mm（40mm 标签上必然越界）
    expect(width).toBeGreaterThan(8)
    expect(width).toBeLessThan(25)
    await expect(w.locator('[data-testid="object-out-of-bounds"]')).toHaveCount(0)
  } finally {
    await launched.close()
  }
})
