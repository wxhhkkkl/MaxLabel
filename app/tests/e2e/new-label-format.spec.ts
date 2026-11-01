import { test, expect } from '@playwright/test'
import { launchApp } from './fixtures/electron-app'

test('creates a label from the default sheet format and shows preview annotations', async () => {
  const launched = await launchApp()
  const w = launched.window
  try {
    await w.locator('[data-testid="toolbar"] button[title="新建标签模版"]').click()
    await w.locator('[data-testid="new-label-dialog"]').waitFor({ timeout: 10_000 })

    // 020：品牌 / 标签名称下拉已去掉，改为「介质单选 + 参数区」
    await expect(w.locator('[data-testid="new-label-brand"]')).toHaveCount(0)
    await expect(w.locator('[data-testid="new-label-format"]')).toHaveCount(0)
    await expect(w.locator('[data-testid="new-label-media-sheet"]')).toBeChecked()
    await expect(w.locator('[data-testid="new-label-param-width"]')).toHaveValue('100')
    await expect(w.locator('[data-testid="new-label-param-height"]')).toHaveValue('70')
    await expect(w.locator('[data-testid="new-label-param-pages"]')).toBeVisible()

    // 默认平张格式的预览与标注
    await expect(w.locator('[data-testid="new-label-preview-number"]')).toHaveCount(8)
    const previewText = (await w.locator('[data-testid="new-label-preview"] svg').textContent()) ?? ''
    expect(previewText).toContain('100mm')
    expect(previewText).toContain('70mm')
    await expect(w.locator('[data-testid="new-label-sheet-info"]')).toContainText('210')

    await w.locator('[data-testid="new-label-select"]').click()
    await expect(w.locator('[data-testid="toolbar"]')).toBeVisible({ timeout: 10_000 })
    // 平张（盒装）仍是单标签编辑视图：不铺同页的其它格
    await expect(w.locator('[data-testid="paper-outline-neighbor"]')).toHaveCount(0)
    const spec = w.locator('[data-testid="status-label-spec"]')
    await expect(spec).toContainText('100mm x 70mm')
    await expect(spec).toContainText('8枚/页')
    await expect(spec).toContainText('20页/盒')
  } finally {
    await launched.close()
  }
})

test('卷筒双列格式：查询清单里挑中后预览画出两格', async () => {
  const launched = await launchApp()
  const w = launched.window
  try {
    await w.locator('[data-testid="toolbar"] button[title="新建标签模版"]').click()
    await w.locator('[data-testid="new-label-dialog"]').waitFor({ timeout: 10_000 })

    await w.locator('[data-testid="new-label-media-roll"]').check()
    await w.locator('[data-testid="new-label-format-picker"]').click()
    await w.locator('[data-testid="format-picker-dialog"]').waitFor({ timeout: 5_000 })
    await w.locator('[data-testid="format-picker-search"]').fill('604003')
    await w.locator('[data-testid="format-picker-row-604003"]').click()

    await expect(w.locator('[data-testid="new-label-param-width"]')).toHaveValue('40')
    await expect(w.locator('[data-testid="new-label-param-cols"]')).toHaveValue('2')
    await expect(w.locator('[data-testid="new-label-preview-number"]')).toHaveCount(2)
  } finally {
    await launched.close()
  }
})

test('卷筒默认规格：高级热敏纸标签 40×30 双列', async () => {
  const launched = await launchApp()
  const w = launched.window
  try {
    await w.locator('[data-testid="toolbar"] button[title="新建标签模版"]').click()
    await w.locator('[data-testid="new-label-dialog"]').waitFor({ timeout: 10_000 })

    await w.locator('[data-testid="new-label-media-roll"]').check()
    await expect(w.locator('[data-testid="new-label-type"] option:checked')).toHaveText('高级热敏纸标签', { timeout: 10_000 })
    await expect(w.locator('[data-testid="new-label-param-width"]')).toHaveValue('40')
    await expect(w.locator('[data-testid="new-label-param-height"]')).toHaveValue('30')
    await expect(w.locator('[data-testid="new-label-param-cols"]')).toHaveValue('2')
    // 纸宽按 2 列算：40×2 + 2mm 间距
    await expect(w.locator('[data-testid="new-label-sheet-info"]')).toContainText('82')
  } finally {
    await launched.close()
  }
})
