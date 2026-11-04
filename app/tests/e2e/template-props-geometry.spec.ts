import { test, expect, type Page } from '@playwright/test'
import { launchApp } from './fixtures/electron-app'

async function createDefaultSheetLabel(page: Page): Promise<void> {
  await page.locator('[data-testid="toolbar"] button[title="新建标签模版"]').click()
  await page.locator('[data-testid="new-label-dialog"]').waitFor({ timeout: 10_000 })
  // 系统「默认标签尺寸」会覆盖目录默认值；这里显式从清单挑一条 preset，验证 preset 的只读语义。
  await page.locator('[data-testid="new-label-format-picker"]').click()
  await page.locator('[data-testid^="format-picker-row-"]').first().click()
  await page.locator('[data-testid="new-label-select"]').click()
  await expect(page.locator('[data-testid="toolbar"]')).toBeVisible({ timeout: 10_000 })
}

/** 状态栏「▤40mm x 30mm …」里的当前标签宽高：新建默认规格会随产品调整，用例不写死。 */
async function currentLabelSize(page: Page): Promise<{ width: string; height: string }> {
  const spec = (await page.locator('[data-testid="status-label-spec"]').textContent()) ?? ''
  const match = /([\d.]+)mm x ([\d.]+)mm/.exec(spec)
  if (!match) throw new Error(`无法从状态栏读取标签尺寸：${spec}`)
  return { width: match[1], height: match[2] }
}

async function openTemplateProps(page: Page): Promise<void> {
  // 文件菜单已去掉「模板属性设置」；仍可从画布右键菜单进入。
  const canvas = page.locator('canvas').first()
  const box = await canvas.boundingBox()
  if (!box) throw new Error('canvas has no bounding box')
  await canvas.click({ button: 'right', position: { x: Math.round(box.width / 2), y: Math.round(box.height / 2) }, force: true })
  await page.locator('[data-menu-item="模板属性设置(M)..."]').click()
  await page.locator('[data-testid="template-props-dialog"]').waitFor({ timeout: 10_000 })
}

test('preset formats keep page and label geometry read-only', async () => {
  const launched = await launchApp()
  const w = launched.window
  try {
    await createDefaultSheetLabel(w)
    await openTemplateProps(w)

    const readOnly = async (testId: string) =>
      w.locator(`[data-testid="${testId}"]`).evaluate((element) => (element as HTMLInputElement).readOnly)

    expect(await readOnly('template-page-width')).toBe(true)
    expect(await readOnly('template-label-width')).toBe(true)
    expect(await readOnly('template-label-height')).toBe(true)
    expect(await readOnly('template-label-cols')).toBe(true)
    await expect(w.locator('[data-testid="template-label-shape"]')).toBeDisabled()
    await expect(w.locator('[data-testid="template-label-hole"]')).toBeDisabled()

    await w.locator('[data-testid="template-props-dialog"]').getByText('取消', { exact: true }).click()
    await expect(w.locator('[data-testid="template-props-dialog"]')).toHaveCount(0)
  } finally {
    await launched.close()
  }
})

test('标签格式设置修改当前标签，而不是新建一个标签', async () => {
  const launched = await launchApp()
  const w = launched.window
  try {
    await createDefaultSheetLabel(w)
    // 先放一个对象，确认改格式后对象仍在
    await w.locator('[data-tool="text"]').click()
    await w.locator('canvas').first().click({ position: { x: 220, y: 200 }, force: true })
    await expect(w.locator('[data-testid="layer-object-row"]')).toHaveCount(1)
    const tabs = w.locator('[data-testid="document-tab"]')
    const tabCount = await tabs.count()

    const current = await currentLabelSize(w)
    await w.getByText('文件(F)', { exact: true }).first().click()
    await w.getByText('标签格式设置(L)...', { exact: true }).first().click()
    await w.locator('[data-testid="new-label-dialog"]').waitFor({ timeout: 10_000 })
    // edit 模式的初值来自当前标签
    await expect(w.locator('[data-testid="new-label-param-width"]')).toHaveValue(current.width)
    await expect(w.locator('[data-testid="new-label-param-height"]')).toHaveValue(current.height)

    await w.locator('[data-testid="new-label-param-width"]').fill('60')
    await w.locator('[data-testid="new-label-param-height"]').fill('40')
    await w.locator('[data-testid="new-label-select"]').click()

    await expect(w.locator('[data-testid="new-label-dialog"]')).toHaveCount(0)
    await expect(w.locator('[data-testid="status-label-spec"]')).toContainText('60mm x 40mm')
    // 没有生成新标签页，原对象也保留
    await expect(tabs).toHaveCount(tabCount)
    await expect(w.locator('[data-testid="layer-object-row"]')).toHaveCount(1)
  } finally {
    await launched.close()
  }
})

test('点击状态栏标签尺寸打开标签格式设置并作用于当前标签', async () => {
  const launched = await launchApp()
  const w = launched.window
  try {
    await createDefaultSheetLabel(w)
    const tabs = w.locator('[data-testid="document-tab"]')
    const tabCount = await tabs.count()
    const current = await currentLabelSize(w)

    await w.locator('[data-testid="status-label-spec"]').click()
    await w.locator('[data-testid="new-label-dialog"]').waitFor({ timeout: 10_000 })
    await expect(w.locator('[data-testid="new-label-param-width"]')).toHaveValue(current.width)

    await w.locator('[data-testid="new-label-param-width"]').fill('50')
    await w.locator('[data-testid="new-label-select"]').click()

    await expect(w.locator('[data-testid="new-label-dialog"]')).toHaveCount(0)
    await expect(w.locator('[data-testid="status-label-spec"]')).toContainText(`50mm x ${current.height}mm`)
    await expect(tabs).toHaveCount(tabCount)
  } finally {
    await launched.close()
  }
})
