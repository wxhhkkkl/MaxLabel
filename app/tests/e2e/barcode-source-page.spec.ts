import { test, expect, type Page } from '@playwright/test'
import { launchApp } from './fixtures/electron-app'

async function createLabel(page: Page): Promise<void> {
  await page.locator('[data-testid="toolbar"] button[title="新建标签模版"]').click()
  await page.locator('[data-testid="new-label-dialog"]').waitFor({ timeout: 10_000 })
  await page.locator('[data-testid="new-label-select"]').click()
  await expect(page.locator('[data-testid="toolbar"]')).toBeVisible({ timeout: 10_000 })
}

async function openBarcodeProps(page: Page): Promise<void> {
  await createLabel(page)
  await page.locator('[data-tool="barcode"]').click()
  await page.locator('canvas').first().click({ position: { x: 420, y: 320 }, force: true })
  await page.waitForTimeout(400)
  await page.keyboard.press('Alt+Enter')
  await page.locator('[data-testid="object-props-dialog"]').waitFor({ timeout: 10_000 })
}

/** 015：条码属性 → 数据源页按原版布局重排（左子串列表 / 右子串选项 / 底部示例）。 */
test('barcode data-source page follows the original layout', async () => {
  const launched = await launchApp()
  const w = launched.window
  try {
    await openBarcodeProps(w)

    // 左：子串列表；右：子串选项；下：示例
    const page = w.locator('[data-testid="barcode-source-page"]')
    await expect(page).toBeVisible()
    await expect(w.locator('[data-testid="source-substring-list"]')).toBeVisible()
    await expect(w.locator('[data-testid="source-kind-select"]')).toBeVisible()
    await expect(w.locator('[data-testid="source-shared-name"]')).toBeVisible()
    await expect(w.locator('[data-testid="source-advanced"]')).toBeVisible()
    await expect(w.locator('[data-testid="source-example"]')).toBeVisible()

    // 主数据源在第 0 项，且默认高亮
    await expect(w.locator('[data-testid="source-entry-0"]')).toHaveAttribute('aria-selected', 'true')
    // 列表每项左侧有类型徽标
    await expect(w.locator('[data-testid="source-entry-icon-0"]')).toBeVisible()

    // 添加子串 → 列表变 2 项，示例跟着变
    await w.locator('[data-testid="source-substring-add"]').click()
    // 新子串是空常量，元素尺寸为 0，只能用数量断言
    await expect(w.locator('[data-testid="source-entry-1"]')).toHaveCount(1)
    await expect(w.locator('[data-testid="source-example-part-1"]')).toHaveCount(1)

    // 高级选项对话框：两个页签
    await w.locator('[data-testid="source-advanced"]').click()
    await expect(w.locator('[data-testid="source-advanced-dialog"]')).toBeVisible()
    await expect(w.locator('[data-testid="source-limit-min"]')).toBeVisible()
    await w.locator('[data-testid="source-advanced-tab-cut"]').click()
    await expect(w.locator('[data-testid="cut-trim-left"]')).toBeVisible()
    await w.locator('[data-testid="source-advanced-cancel"]').click()
    await expect(w.locator('[data-testid="source-advanced-dialog"]')).toHaveCount(0)

    // 双击条码直接落在「数据源」页
    await expect(w.locator('[data-testid="barcode-source-page"]')).toBeVisible()

    // 序列号设置：原版单列排版 + 增量/减量互斥
    await w.locator('[data-testid="source-kind-select"]').selectOption('serial')
    await expect(w.locator('[data-testid="serial-settings"]')).toBeVisible()
    await expect(w.locator('[data-testid="serial-step-increase"]')).toBeChecked()
    await expect(w.locator('[data-testid="serial-sequence"]')).toHaveCount(1)
    await w.locator('[data-testid="serial-step-decrease"]').check()
    await expect(w.locator('[data-testid="serial-step-decrease"]')).toBeChecked()
    await expect(w.locator('[data-testid="serial-step-increase"]')).not.toBeChecked()

    // 初始值来源只剩「默认 / 键盘输入」；起始值与「复刻版扩展」不再出现在界面上
    const initialOptions = await w.locator('[data-testid="serial-initial-source"] option').allTextContents()
    expect(initialOptions).toEqual(['默认', '键盘输入'])
    await expect(w.locator('[data-testid="serial-settings"]')).not.toContainText('序列起始值')
    // 额外设置（显示数据 / 前缀 / 位数）不再出现在面板里
    await expect(w.locator('[data-testid="serial-current"]')).toHaveCount(0)
    await expect(w.locator('[data-testid="serial-settings"]')).not.toContainText('位数')
    // 重置按钮与「按标签变化复位」勾选也一并移除
    await expect(w.locator('[data-testid="serial-reset"]')).toHaveCount(0)
    await expect(w.locator('[data-testid="barcode-source-page"]')).not.toContainText('按标签变化')
    await expect(w.locator('[data-testid="barcode-source-page"]')).not.toContainText('复刻版扩展')

    // 子串列表与「示例」都显示解析后的结果（不是原始格式串）
    await w.locator('[data-testid="source-entry-0"]').click()
    await w.locator('[data-testid="source-kind-select"]').selectOption('date')
    await w.locator('[data-testid="date-format"]').selectOption('dddd, dd MMMM, yyyy')
    await expect(w.locator('[data-testid="source-entry-0"]')).not.toContainText('yyyy')
    await expect(w.locator('[data-testid="source-example-part-0"]')).toContainText('星期')
    await w.locator('[data-testid="source-kind-select"]').selectOption('serial')

    // 序列示例挪到下方「示例」区
    await expect(w.locator('[data-testid="source-example-serial"]')).toContainText('序列示例')

    // 类型可以选「自定义」，并且能真的输入自己的字符集
    await w.locator('[data-testid="serial-charset"]').selectOption('__custom__')
    await expect(w.locator('[data-testid="serial-charset"]')).toHaveValue('__custom__')
    await expect(w.locator('[data-testid="serial-custom-charset"]')).toBeVisible()
    await w.locator('[data-testid="serial-custom-charset"]').fill('ABCDEFGH')
    await expect(w.locator('[data-testid="serial-sequence"]')).toHaveValue('ABCDEFGH')
    // 选回预设后自定义输入框收起
    await w.locator('[data-testid="serial-charset"]').selectOption('')
    await expect(w.locator('[data-testid="serial-custom-charset"]')).toHaveCount(0)

    // 数据库类型不再显示「单标签记录」
    await w.locator('[data-testid="source-kind-select"]').selectOption('database')
    await expect(w.locator('[data-testid="database-record-offset"]')).toHaveCount(0)
    await expect(w.locator('[data-testid="barcode-source-page"]')).not.toContainText('单标签记录')
    await w.locator('[data-testid="source-kind-select"]').selectOption('serial')

    // 初始值来源选「键盘输入」→ 出现「提示(P)」，内容就是打印时弹框里显示的那句话
    await w.locator('[data-testid="serial-initial-source"]').selectOption('keyboard')
    await expect(w.locator('[data-testid="serial-initial-prompt"]')).toBeVisible()
    await w.locator('[data-testid="serial-initial-prompt"]').fill('起始编号')
    await expect(w.locator('[data-testid="serial-initial-prompt"]')).toHaveValue('起始编号')
  } finally {
    await launched.close()
  }
})
