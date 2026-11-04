import { test, expect, type Page } from '@playwright/test'
import { launchApp } from './fixtures/electron-app'

/**
 * 现场反馈：文字属性里选「打印机自建」能看到 Font0-Font8，但示例区永远是同一套系统字体，
 * 看不出选的是哪个内建字库。程序没有打印机 ROM 字库，示例按点阵规格做近似预览。
 */

async function createLabel(page: Page): Promise<void> {
  await page.locator('[data-testid="toolbar"] button[title="新建标签模版"]').click()
  await page.locator('[data-testid="new-label-dialog"]').waitFor({ timeout: 10_000 })
  await page.locator('[data-testid="new-label-select"]').click()
  await expect(page.locator('[data-testid="toolbar"]')).toBeVisible({ timeout: 10_000 })
}

async function openTextFontTab(page: Page): Promise<void> {
  await page.locator('[data-tool="text"]').click()
  await page.locator('canvas').first().click({ position: { x: 300, y: 300 }, force: true })
  await page.keyboard.press('Alt+Enter')
  await expect(page.locator('[data-testid="object-props-dialog"]')).toBeVisible({ timeout: 10_000 })
  await page.locator('[data-testid="object-props-tab-font"]').click()
}

test('打印机内建字体在示例区给出可区分的近似预览', async () => {
  const launched = await launchApp()
  const w = launched.window
  try {
    await createLabel(w)
    await openTextFontTab(w)

    await w.locator('[data-testid="text-font-category"]').selectOption('printer')
    const family = w.locator('[data-testid="object-props-font-family"]')
    test.skip((await family.locator('option[value="Font1"]').count()) === 0, '当前驱动不是 TSPL，无 Font1-8')

    // 下拉里带点阵规格，至少能区分各字库
    await expect(family.locator('option[value="Font1"]')).toHaveText(/8×12/)
    await expect(family.locator('option[value="Font5"]')).toHaveText(/32×48/)

    // 新建文字的默认内容是中文：内建字库打不出来，必须提示且示例照实回到屏幕字体
    await family.selectOption('Font1')
    await expect(w.locator('[data-testid="text-font-printer-fallback"]')).toBeVisible()
    await expect(w.locator('[data-testid="text-font-preview"] [data-printer-font-preview="true"]')).toHaveCount(0)

    // 换成 ASCII 内容后，内建字库才会真正生效，示例给出可区分的近似预览
    await w.locator('[data-testid="object-props-tab-datasource"]').click()
    await w.locator('[data-testid="constant-source-value"]').fill('ABC123')
    await w.locator('[data-testid="object-props-tab-font"]').click()
    await expect(w.locator('[data-testid="text-font-printer-fallback"]')).toHaveCount(0)

    const preview = w.locator('[data-testid="text-font-preview"] [data-printer-font-preview="true"]')
    const fontPx = () => preview.evaluate((element) => Number.parseFloat(getComputedStyle(element).fontSize))

    await family.selectOption('Font1')
    await expect(preview).toBeVisible()
    const small = await fontPx()

    await family.selectOption('Font5')
    await expect(preview).toBeVisible()
    const large = await fontPx()
    expect(large).toBeGreaterThan(small)

    // Font0 是 TrueType（按字号）：不做点阵近似，示例回到对象自身字体
    await family.selectOption('Font0')
    await expect(w.locator('[data-testid="text-font-preview"] [data-printer-font-preview="true"]')).toHaveCount(0)
  } finally {
    await launched.close()
  }
})
