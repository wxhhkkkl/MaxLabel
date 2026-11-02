import { test, expect, type Page } from '@playwright/test'
import { launchApp } from './fixtures/electron-app'

/**
 * 打印面板的「输入数据」里直接显示键盘输入框（020 现场需求）
 *
 * 原版就是这样：模板里有键盘输入的文本时，右侧面板给出对应输入框，
 * 操作员先填好再点打印 —— 而不是每次打印都弹一个对话框。
 */

async function createLabel(page: Page): Promise<void> {
  await page.locator('[data-testid="toolbar"] button[title="新建标签模版"]').click()
  await page.locator('[data-testid="new-label-dialog"]').waitFor({ timeout: 10_000 })
  await page.locator('[data-testid="new-label-select"]').click()
  await expect(page.locator('[data-testid="toolbar"]')).toBeVisible({ timeout: 10_000 })
}

/** 把当前模板的端口类型固定成指定值（新建标签会选中本机第一台打印机，端口取决于机器环境）。 */
async function setPortType(page: Page, type: 'driver' | 'tcp'): Promise<void> {
  await page.locator('[data-testid="print-printer-settings"]').click()
  await page.locator('[data-testid="printer-settings-port-tab"]').click()
  await page.locator('[data-testid="printer-port-type"]').selectOption(type)
  if (type === 'tcp') {
    for (const [i, part] of ['192', '168', '1', '50'].entries()) {
      await page.locator(`[data-testid="printer-port-ip-${i + 1}"]`).fill(part)
    }
  }
  await page.locator('[data-testid="printer-settings-save"]').click()
}

test('模板有键盘输入时，打印面板出现对应输入框且可填写', async () => {
  const launched = await launchApp()
  const w = launched.window
  try {
    await createLabel(w)

    // 面板里还没有键盘输入项
    await expect(w.locator('[data-testid="print-keyboard-inputs"]')).toHaveCount(0)

    // 把一个文本对象的数据源改成键盘输入
    await w.locator('[data-tool="text"]').click()
    await w.locator('canvas').first().click({ position: { x: 300, y: 300 }, force: true })
    await w.keyboard.press('Alt+Enter')
    await expect(w.locator('[data-testid="object-props-dialog"]')).toBeVisible({ timeout: 10_000 })
    await w.locator('[data-testid="object-props-tab-datasource"]').click()
    await w.locator('[data-testid="source-kind-select"]').selectOption('keyboard')
    await w.locator('[data-testid="keyboard-label"]').fill('批次号')
    await w.locator('[data-testid="object-props-ok"]').click()

    // 面板出现「批次号」输入框，填写后保留
    const input = w.locator('[data-testid="print-keyboard-input-0"]')
    await expect(input).toBeVisible({ timeout: 10_000 })
    await expect(w.locator('[data-testid="print-keyboard-inputs"]')).toContainText('批次号')
    await input.fill('A001')
    await expect(input).toHaveValue('A001')
  } finally {
    await launched.close()
  }
})

test('打印机下拉在默认（驱动）模式下可展开', async () => {
  const launched = await launchApp()
  const w = launched.window
  try {
    await createLabel(w)
    await setPortType(w, 'driver')
    const select = w.locator('[data-testid="print-printer"]')
    await expect(select).toBeEnabled()
    // 打印机清单是异步拉取的：至少要有「系统默认打印机」以外的一个选项，才谈得上"能下拉"
    await expect.poll(async () => select.locator('option').count(), { timeout: 15_000 }).toBeGreaterThan(1)
  } finally {
    await launched.close()
  }
})

test('两个键盘输入元素各自一个输入框（不再是同一个）', async () => {
  const launched = await launchApp()
  const w = launched.window
  try {
    await createLabel(w)

    // 造两个文本对象，都改成键盘输入
    for (const y of [260, 340]) {
      await w.locator('[data-tool="text"]').click()
      await w.locator('canvas').first().click({ position: { x: 300, y }, force: true })
      await w.keyboard.press('Alt+Enter')
      await expect(w.locator('[data-testid="object-props-dialog"]')).toBeVisible({ timeout: 10_000 })
      await w.locator('[data-testid="object-props-tab-datasource"]').click()
      await w.locator('[data-testid="source-kind-select"]').selectOption('keyboard')
      await w.locator('[data-testid="object-props-ok"]').click()
      await w.waitForTimeout(150)
    }

    const inputs = w.locator('[data-testid^="print-keyboard-input-"]')
    await expect(inputs).toHaveCount(2, { timeout: 10_000 })
    // 各自的默认名不同，分别填写互不影响
    await inputs.nth(0).fill('A')
    await inputs.nth(1).fill('B')
    await expect(inputs.nth(0)).toHaveValue('A')
    await expect(inputs.nth(1)).toHaveValue('B')
  } finally {
    await launched.close()
  }
})

test('端口不是 Windows 驱动时，打印机下拉给出可读的原因而不是静默禁用', async () => {
  const launched = await launchApp()
  const w = launched.window
  try {
    await createLabel(w)
    await setPortType(w, 'driver')
    const select = w.locator('[data-testid="print-printer"]')
    await expect(select).toBeEnabled()

    await expect(w.locator('[data-testid="print-printer-refresh"]')).toBeVisible()

    // 把当前模板改成 TCP 直连：打印机名不参与，下拉应禁用并说明原因
    await setPortType(w, 'tcp')

    await expect(select).toBeDisabled()
    // 提示行已去掉，原因放在悬停 title 里
    await expect(select).toHaveAttribute('title', /tcp/)
  } finally {
    await launched.close()
  }
})
