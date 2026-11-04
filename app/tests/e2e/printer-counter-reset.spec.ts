import { test, expect, type Page } from '@playwright/test'
import { launchApp, openPrinterSettingsFromPrintDialog } from './fixtures/electron-app'

/**
 * 设备计数器复位（020 现场：换打印头后重新计数，用来估算下次更换）
 *
 * 无真机时读数走「本软件累计」，值可能是 —，但**流程**必须可用：
 * 没读过不给复位、读过才能复位、确认后出现「自复位以来」。
 * 真机上的数值核对属于现场验收。
 */

async function createLabel(page: Page): Promise<void> {
  await page.locator('[data-testid="toolbar"] button[title="新建标签模版"]').click()
  await page.locator('[data-testid="new-label-dialog"]').waitFor({ timeout: 10_000 })
  await page.locator('[data-testid="new-label-select"]').click()
  await expect(page.locator('[data-testid="toolbar"]')).toBeVisible({ timeout: 10_000 })
}

test('设备计数器复位：读数前不可点，确认后出现「自复位以来」', async () => {
  const launched = await launchApp()
  const w = launched.window
  try {
    await createLabel(w)
    await openPrinterSettingsFromPrintDialog(w)
    await expect(w.locator('[data-testid="printer-counters"]')).toBeVisible({ timeout: 10_000 })

    const reset = w.locator('[data-testid="printer-counter-reset"]')
    // 还没有读数 → 没有"起点"，不许复位
    await expect(reset).toBeDisabled()

    await w.locator('[data-testid="printer-counter-read"]').click()
    await expect(w.locator('[data-testid="printer-counter-labels"]')).toBeVisible({ timeout: 20_000 })
    await expect(reset).toBeEnabled()

    w.on('dialog', (dialog) => { void dialog.accept() })
    await reset.click()
    await expect(w.locator('[data-testid="printer-counter-since"]')).toBeVisible({ timeout: 10_000 })
    await expect(w.locator('[data-testid="printer-counter-since"]')).toContainText('复位')
  } finally {
    await launched.close()
  }
})
