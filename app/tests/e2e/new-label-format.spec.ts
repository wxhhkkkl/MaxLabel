import { test, expect } from '@playwright/test'
import { launchApp } from './fixtures/electron-app'

test('creates a label from the default sheet format and shows preview annotations', async () => {
  const launched = await launchApp()
  const w = launched.window
  try {
    await w.locator('[data-testid="toolbar"] button[title="新建标签模版"]').click()
    await w.locator('[data-testid="new-label-dialog"]').waitFor({ timeout: 10_000 })

    // 015：品牌方更名为「宸发」，只改展示名，格式库原文不动。
    await expect(w.locator('[data-testid="new-label-brand"]')).toContainText('宸发标签')
    await expect(w.locator('[data-testid="new-label-type"]')).toContainText('宸发优质打印纸标签')

    // Default sheet format, its grid and annotations.
    await expect(w.locator('[data-testid="new-label-format"]')).toHaveValue('608053')
    await expect(w.locator('[data-testid="new-label-preview-number"]')).toHaveCount(8)
    const previewText = (await w.locator('[data-testid="new-label-preview"] svg').textContent()) ?? ''
    expect(previewText).toContain('100mm')
    expect(previewText).toContain('70mm')
    await expect(w.locator('[data-testid="new-label-sheet-info"]')).toContainText('210')

    await w.locator('[data-testid="new-label-select"]').click()
    await expect(w.locator('[data-testid="toolbar"]')).toBeVisible({ timeout: 10_000 })
    const spec = w.locator('[data-testid="status-label-spec"]')
    await expect(spec).toContainText('100mm x 70mm')
    await expect(spec).toContainText('8枚/页')
    await expect(spec).toContainText('20页/盒')
  } finally {
    await launched.close()
  }
})
