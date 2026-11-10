import { test, expect } from '@playwright/test'
import { launchApp } from './fixtures/electron-app'

/**
 * 条幅 / 飘带（020 现场）：第三种介质。
 *
 * - 不再选择排列方式；按单条宽高自动决定竖条/横条
 * - 条数改为单联/双联；双联是一张画布，中间中缝不可打印
 * - 竖条双联左右并排，横条双联上下堆叠
 */
test('条幅/飘带：单联/双联，双联中间中缝不可打印', async () => {
  const launched = await launchApp()
  const w = launched.window
  try {
    await w.locator('[data-testid="toolbar"] button[title="新建标签模版"]').click()
    await w.locator('[data-testid="new-label-dialog"]').waitFor({ timeout: 10_000 })

    await w.locator('[data-testid="new-label-media-banner"]').check()
    await expect(w.locator('[data-testid="new-label-type"]')).toHaveCount(0)
    // 排列方式已移除，条数改为单联/双联
    await expect(w.locator('[data-testid="new-label-banner-axis"]')).toHaveCount(0)
    await expect(w.locator('[data-testid="new-label-param-copies"]')).toHaveCount(0)
    await expect(w.locator('[data-testid="new-label-banner-joint"]')).toHaveValue('single')
    await expect(w.locator('[data-testid="new-label-param-width"]')).toHaveValue('100')
    await expect(w.locator('[data-testid="new-label-param-height"]')).toHaveValue('1000')
    await expect(w.locator('[data-testid="new-label-preview-joint"]')).toHaveCount(0)
    // 条幅没有纸张选择，也没有形状/孔洞设置
    await expect(w.locator('[data-testid="new-label-page-group"]')).toHaveCount(0)
    await expect(w.locator('[data-testid="new-label-shape"]')).toHaveCount(0)
    await expect(w.locator('[data-testid="new-label-hole"]')).toHaveCount(0)

    // 双联：宽/高仍是单条尺寸，成品自动变为 202×1000
    await w.locator('[data-testid="new-label-banner-joint"]').selectOption('double')
    await expect(w.locator('[data-testid="new-label-preview-joint"]')).toHaveCount(1)
    await expect(w.locator('[data-testid="new-label-current-format"]')).toContainText('双联')

    await w.locator('[data-testid="new-label-select"]').click()
    await expect(w.locator('[data-testid="toolbar"]')).toBeVisible({ timeout: 10_000 })
    const spec = w.locator('[data-testid="status-label-spec"]')
    await expect(spec).toContainText('202mm x 1000mm')
    // 编辑器纸面轮廓带竖向中缝
    await expect(w.locator('[data-testid="paper-outline"] > path').first())
      .toHaveAttribute('d', /M 100 0 H 102 V 1000 H 100 Z/)
    await expect(w.locator('[data-testid="paper-joint"]')).toHaveCount(1)
    await expect(w.locator('[data-testid="paper-outline-neighbor"]')).toHaveCount(0)
  } finally {
    await launched.close()
  }
})

test('横条双联按单条宽高自动上下堆叠', async () => {
  const launched = await launchApp()
  const w = launched.window
  try {
    await w.locator('[data-testid="toolbar"] button[title="新建标签模版"]').click()
    await w.locator('[data-testid="new-label-dialog"]').waitFor({ timeout: 10_000 })
    await w.locator('[data-testid="new-label-media-banner"]').check()

    await w.locator('[data-testid="new-label-param-width"]').fill('1000')
    await w.locator('[data-testid="new-label-param-height"]').fill('100')
    await w.locator('[data-testid="new-label-banner-joint"]').selectOption('double')
    await expect(w.locator('[data-testid="new-label-preview-joint"]')).toHaveCount(1)

    await w.locator('[data-testid="new-label-select"]').click()
    await expect(w.locator('[data-testid="toolbar"]')).toBeVisible({ timeout: 10_000 })
    await expect(w.locator('[data-testid="status-label-spec"]')).toContainText('1000mm x 202mm')
    await expect(w.locator('[data-testid="paper-outline"] > path').first())
      .toHaveAttribute('d', /M 0 100 H 1000 V 102 H 0 Z/)
  } finally {
    await launched.close()
  }
})
