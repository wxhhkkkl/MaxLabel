import { test, expect } from '@playwright/test'
import { launchApp } from './fixtures/electron-app'

/**
 * 条幅 / 飘带（020 现场）：作为**第三种介质**（卷筒 / 平张 / 条幅·飘带）。
 *
 * - 类型只有默认的一种
 * - 排列方式单独选：水平排列（多条并排）/ 垂直排列（多条堆叠）
 * - 条数为 2 时画布上能看到第二条（拼版邻居），打印是 2 枚/页
 */
test('条幅/飘带介质：单一类型 + 水平/垂直排列，双条按两格建版', async () => {
  const launched = await launchApp()
  const w = launched.window
  try {
    await w.locator('[data-testid="toolbar"] button[title="新建标签模版"]').click()
    await w.locator('[data-testid="new-label-dialog"]').waitFor({ timeout: 10_000 })

    await w.locator('[data-testid="new-label-media-banner"]').check()
    // 类型只有默认一种
    const types = await w.locator('[data-testid="new-label-type"] option').allTextContents()
    expect(types).toEqual(['条幅/飘带'])
    // 默认 100×1000、单条、水平排列
    await expect(w.locator('[data-testid="new-label-param-width"]')).toHaveValue('100')
    await expect(w.locator('[data-testid="new-label-param-height"]')).toHaveValue('1000')
    await expect(w.locator('[data-testid="new-label-banner-horizontal"]')).toBeChecked()

    // 两条水平排列
    await w.locator('[data-testid="new-label-param-copies"]').fill('2')
    await expect(w.locator('[data-testid="new-label-preview-number"]')).toHaveCount(2)

    await w.locator('[data-testid="new-label-select"]').click()
    await expect(w.locator('[data-testid="toolbar"]')).toBeVisible({ timeout: 10_000 })
    const spec = w.locator('[data-testid="status-label-spec"]')
    await expect(spec).toContainText('100mm x 1000mm')
    await expect(spec).toContainText('2枚/页')
    // 画布只显示一格（020 现场：卷筒/条幅都回到单标签编辑视图）
    await expect(w.locator('[data-testid="paper-outline-neighbor"]')).toHaveCount(0)
  } finally {
    await launched.close()
  }
})

test('垂直排列：条数沿行方向堆叠', async () => {
  const launched = await launchApp()
  const w = launched.window
  try {
    await w.locator('[data-testid="toolbar"] button[title="新建标签模版"]').click()
    await w.locator('[data-testid="new-label-dialog"]').waitFor({ timeout: 10_000 })
    await w.locator('[data-testid="new-label-media-banner"]').check()
    await w.locator('[data-testid="new-label-param-copies"]').fill('2')
    await w.locator('[data-testid="new-label-banner-vertical"]').check()
    // 切换排列不丢条数
    await expect(w.locator('[data-testid="new-label-param-copies"]')).toHaveValue('2')
    await expect(w.locator('[data-testid="new-label-preview-number"]')).toHaveCount(2)
  } finally {
    await launched.close()
  }
})
