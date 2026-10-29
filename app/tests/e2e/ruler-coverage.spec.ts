import { test, expect, type Page } from '@playwright/test'
import { launchApp } from './fixtures/electron-app'

async function createLabel(page: Page): Promise<void> {
  await page.locator('[data-testid="toolbar"] button[title="新建标签模版"]').click()
  await page.locator('[data-testid="new-label-dialog"]').waitFor({ timeout: 10_000 })
  await page.locator('[data-testid="new-label-select"]').click()
  await expect(page.locator('[data-testid="toolbar"]')).toBeVisible({ timeout: 10_000 })
}

async function measure(page: Page) {
  return page.evaluate(() => {
    const vp = document.querySelector('[data-testid="workspace-viewport"]') as HTMLElement
    const ry = document.querySelector('[data-testid="ruler-y"]') as HTMLElement
    const rx = document.querySelector('[data-testid="ruler-x"]') as HTMLElement
    return {
      vpW: vp.offsetWidth,
      vpH: vp.offsetHeight,
      rulerW: Math.round(rx.getBoundingClientRect().width),
      rulerH: Math.round(ry.getBoundingClientRect().height)
    }
  })
}

/**
 * 015 现场反馈：标尺铺不满画面。
 *
 * 标尺长度原来直接用 `contentW/H`，而它取自 `clientWidth/Height`——
 * 一旦另一方向出现滚动条，就少掉一条滚动条的厚度（约 15px）。
 */
test('rulers cover the whole viewport even when scrollbars appear', async () => {
  const launched = await launchApp()
  const w = launched.window
  try {
    await createLabel(w)
    await w.waitForTimeout(400)

    const initial = await measure(w)
    expect(initial.rulerH).toBeGreaterThanOrEqual(initial.vpH)
    expect(initial.rulerW).toBeGreaterThanOrEqual(initial.vpW)

    // 放大到纸张超出视口 → 出现滚动条
    for (let i = 0; i < 4; i++) {
      await w.getByText('查看(V)', { exact: true }).first().click()
      await w.locator('[data-menu-item="放大(I)"]').click()
      await w.waitForTimeout(200)
    }
    await w.waitForTimeout(400)

    const zoomed = await measure(w)
    expect(zoomed.rulerH).toBeGreaterThanOrEqual(zoomed.vpH)
    expect(zoomed.rulerW).toBeGreaterThanOrEqual(zoomed.vpW)
  } finally {
    await launched.close()
  }
})
