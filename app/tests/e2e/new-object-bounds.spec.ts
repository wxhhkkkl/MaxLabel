import { test, expect } from '@playwright/test'
import { launchApp, pickShapeTool } from './fixtures/electron-app'

/**
 * 新建对象的尺寸必须落在标签内（020 现场：一维码默认 44mm 宽，40mm 标签上一建就越界）。
 *
 * 这里把 40×30 的卷筒标签当基准，逐个工具新建、断言框完全在 0..40 × 0..30 内，
 * 并确认没有触发越界红框。
 */
test('各类型新建对象都收在 40×30 的标签内', async () => {
  const launched = await launchApp()
  const w = launched.window
  try {
    await w.locator('[data-testid="toolbar"] button[title="新建标签模版"]').click()
    await w.locator('[data-testid="new-label-dialog"]').waitFor({ timeout: 10_000 })
    await w.locator('[data-testid="new-label-media-roll"]').check()
    await w.locator('[data-testid="new-label-select"]').click()
    await expect(w.locator('[data-testid="toolbar"]')).toBeVisible({ timeout: 10_000 })

    // 工具栏里能一键新建的类型（图片要选文件，椭圆由矩形改形状，不在此列）
    for (const tool of ['text', 'barcode', 'rfid', 'table', 'rect', 'line', 'diagonal']) {
      if (tool === 'rect') await pickShapeTool(w)
      else await w.locator(`[data-tool="${tool}"]`).click()
      await w.locator('canvas').first().click({ position: { x: 420, y: 300 }, force: true })
      await w.waitForTimeout(200)
      const row = w.locator('[data-testid="layer-object-row"]').last()
      const box = {
        x: Number(await row.getAttribute('data-object-x')),
        y: Number(await row.getAttribute('data-object-y')),
        w: Number(await row.getAttribute('data-object-w')),
        h: Number(await row.getAttribute('data-object-h'))
      }
      expect(box.x, `${tool} 左边界`).toBeGreaterThanOrEqual(-0.01)
      expect(box.y, `${tool} 上边界`).toBeGreaterThanOrEqual(-0.01)
      expect(box.x + box.w, `${tool} 右边界`).toBeLessThanOrEqual(40.01)
      expect(box.y + box.h, `${tool} 下边界`).toBeLessThanOrEqual(30.01)
      // 删掉再建下一个，避免点击落在旧对象上（那样只会选中而不是新建）
      await w.keyboard.press('Delete')
      await w.waitForTimeout(150)
    }
    await expect(w.locator('[data-testid="object-out-of-bounds"]')).toHaveCount(0)
  } finally {
    await launched.close()
  }
})

/**
 * 文字内容比标签宽时，模型框会被收进标签，但画布上的字形仍然溢出。
 * 越界提示必须按**实际渲染包围盒**判断，否则看起来“出了画布却没有提示”。
 */
test('文字超出窄标签时按实际渲染范围显示越界红框', async () => {
  const launched = await launchApp()
  const w = launched.window
  try {
    await w.locator('[data-testid="toolbar"] button[title="新建标签模版"]').click()
    await w.locator('[data-testid="new-label-dialog"]').waitFor({ timeout: 10_000 })
    await w.locator('[data-testid="new-label-param-width"]').fill('10')
    await w.locator('[data-testid="new-label-param-height"]').fill('20')
    await w.locator('[data-testid="new-label-select"]').click()
    await expect(w.locator('[data-testid="toolbar"]')).toBeVisible({ timeout: 10_000 })

    await w.locator('[data-tool="text"]').click()
    await w.locator('canvas').first().click({ position: { x: 60, y: 60 }, force: true })

    const paperW = Number(await w.locator('[data-testid="paper-outline"]').getAttribute('width'))
    const outOfBounds = w.locator('[data-testid="object-out-of-bounds"]')
    await expect(outOfBounds).toHaveCount(1)
    // 红框宽度 = 实际文字宽（约 16.5mm），明显大于 10mm 的标签
    expect(Number(await outOfBounds.first().getAttribute('width'))).toBeGreaterThan(paperW)
  } finally {
    await launched.close()
  }
})
