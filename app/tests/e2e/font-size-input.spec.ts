import { test, expect } from '@playwright/test'
import { launchApp } from './fixtures/electron-app'

test('字号可输入任意磅值：13 不再因为下拉没有这一项而显示空白', async () => {
  const launched = await launchApp()
  const w = launched.window
  try {
    await w.locator('[data-testid="toolbar"] button[title="新建标签模版"]').click()
    await w.locator('[data-testid="new-label-dialog"]').waitFor({ timeout: 10_000 })
    await w.locator('[data-testid="new-label-select"]').click()
    await w.locator('[data-testid="toolbar"]').waitFor({ timeout: 10_000 })

    await w.locator('[data-tool="text"]').click()
    const canvas = w.locator('canvas').first()
    for (let attempt = 0; attempt < 3; attempt++) {
      await canvas.click({ position: { x: 300, y: 250 }, force: true })
      await w.waitForTimeout(400)
      if (await w.locator('[data-testid="format-font-size"]').count()) break
    }

    const size = w.locator('[data-testid="format-font-size"]')
    await expect(size).toBeVisible()
    // 真机档位里没有 13（8,9,10,11,12,14…），lsdx 导入却是任意磅值；输入框必须收下。
    await size.fill('13')
    await size.blur()
    await expect(size).toHaveValue('13')

    await w.locator('[data-testid="format-props"]').click()
    await w.locator('[data-testid="object-props-dialog"]').waitFor({ timeout: 10_000 })
    await w.locator('[data-testid="object-props-tab-font"]').click()
    const dialogSize = w.locator('[data-testid="object-props-font-size"]')
    await expect(dialogSize).toHaveValue('13')

    // 两位小数同样保留（旧下拉按 0.1 取整会把 7.88 抹成 7.9）
    await dialogSize.fill('7.88')
    await dialogSize.blur()
    await expect(dialogSize).toHaveValue('7.88')
    await w.locator('[data-testid="object-props-ok"]').click()
    await expect(dialogSize).toHaveCount(0)
    await expect(size).toHaveValue('7.88')
  } finally {
    await launched.close()
  }
})
