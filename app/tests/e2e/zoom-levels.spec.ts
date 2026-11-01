import { test, expect } from '@playwright/test'
import { launchApp } from './fixtures/electron-app'

/**
 * 缩放等级（020 现场）：长条标签要能缩到 5%，所以等级表覆盖 5%~400%，
 * 状态栏滑块的下限必须与之一致（原来写死 50%，导致下拉里只有「当前值」和 50% 可选）。
 */
test('缩放等级覆盖 5%~400%，状态栏滑块下限一致', async () => {
  const launched = await launchApp()
  const w = launched.window
  try {
    await w.locator('[data-testid="toolbar"] button[title="新建标签模版"]').click()
    await w.locator('[data-testid="new-label-dialog"]').waitFor({ timeout: 10_000 })
    await w.locator('[data-testid="new-label-select"]').click()
    await expect(w.locator('[data-testid="toolbar"]')).toBeVisible({ timeout: 10_000 })

    const options = await w.locator('[data-testid="zoom-level"] option').allTextContents()
    for (const level of ['5%', '10%', '20%', '25%', '33%', '50%', '75%', '100%', '200%', '400%']) {
      expect(options).toContain(level)
    }

    const slider = w.locator('[data-testid="status-zoom"] input')
    await expect(slider).toHaveAttribute('min', '5')
    await expect(slider).toHaveAttribute('max', '400')

    // − 按钮沿等级表走（不是每次固定 25%）
    const before = (await w.locator('[data-testid="status-zoom"] span').textContent()) ?? ''
    await w.locator('[title="缩小"]').first().click()
    const after = (await w.locator('[data-testid="status-zoom"] span').textContent()) ?? ''
    expect(before).not.toBe(after)
  } finally {
    await launched.close()
  }
})
