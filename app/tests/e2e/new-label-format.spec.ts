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
    // 启动预取缓存后，默认会选中本机第一台可用打印机；本机若有标签机会直接落到卷筒。
    // 这条用例专门验证平张目录，显式选平张，避免依赖本机打印机顺序。
    await w.locator('[data-testid="new-label-media-sheet"]').check()
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

    // 2026-11-02 收敛：图例改「设置参数」，去掉打印机提示 / 底部提示 / 帮助按钮；
    // 纸宽与标签数值移到示意图右侧（不再是图下方居中）
    // 「设置参数」外框已去掉，只保留 标签 / 行列 / 间距 三栏
    await expect(w.locator('[data-testid="new-label-choose-group"] > legend')).toHaveCount(0)
    // 「标签类型」下拉已隐藏
    await expect(w.locator('[data-testid="new-label-type"]')).toHaveCount(0)
    // 参数按「标签 / 行列 / 间距」三栏分组（行列在间距左边）
    await expect(w.locator('[data-testid="new-label-params"] legend')).toHaveText(['标签', '行列', '间距'])
    // 底部只保留高亮的「选择」，自定义/取消按钮已去掉
    await expect(w.locator('[data-testid="new-label-custom"]')).toHaveCount(0)
    await expect(w.locator('[data-testid="new-label-cancel"]')).toHaveCount(0)
    const selectButton = w.locator('[data-testid="new-label-select"]')
    await expect(selectButton).toHaveCSS('background-color', 'rgb(46, 110, 147)')
    const pickerButton = w.locator('[data-testid="new-label-format-picker"]')
    await expect(pickerButton).toHaveCSS('border-top-color', 'rgb(46, 110, 147)')
    // 下方新增 形状 / 孔洞 与页面属性（尺寸 / 左空 / 上空 / 纸张颜色）
    await expect(w.locator('[data-testid="new-label-shape"]')).toBeVisible()
    await expect(w.locator('[data-testid="new-label-hole"]')).toBeVisible()
    // 页面设置默认收起，点击「页面设置」标题后才展开
    await expect(w.locator('[data-testid="new-label-page-toggle"]')).toContainText('页面设置')
    await expect(w.locator('[data-testid="new-label-page-toggle"]')).toHaveAttribute('aria-expanded', 'false')
    await expect(w.locator('[data-testid="new-label-page-width"]')).toHaveCount(0)
    await w.locator('[data-testid="new-label-page-toggle"]').click()
    await expect(w.locator('[data-testid="new-label-page-toggle"]')).toHaveAttribute('aria-expanded', 'true')
    await expect(w.locator('[data-testid="new-label-page-width"]')).toHaveValue('210')
    await expect(w.locator('[data-testid="new-label-page-height"]')).toHaveValue('297')
    await expect(w.locator('[data-testid="new-label-page-left"]')).toHaveValue('4')
    await expect(w.locator('[data-testid="new-label-page-top"]')).toHaveValue('5.5')
    await expect(w.locator('[data-testid="new-label-page-color"]')).toBeVisible()
    await expect(w.locator('[data-testid="new-label-printer-impact"]')).toHaveCount(0)
    await expect(w.locator('[data-testid="new-label-hint"]')).toHaveCount(0)
    await expect(w.locator('[data-testid="new-label-help"]')).toHaveCount(0)
    const previewBox = await w.locator('[data-testid="new-label-preview"]').boundingBox()
    const sheetInfoBox = await w.locator('[data-testid="new-label-sheet-info"]').boundingBox()
    const labelInfoBox = await w.locator('[data-testid="new-label-label-info"]').boundingBox()
    expect(sheetInfoBox!.x).toBeGreaterThanOrEqual(previewBox!.x + previewBox!.width)
    expect(labelInfoBox!.x).toBeGreaterThanOrEqual(previewBox!.x + previewBox!.width)

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

test('新建标签页的打印机列表可以手动刷新', async () => {
  const launched = await launchApp()
  const w = launched.window
  try {
    await w.locator('[data-testid="toolbar"] button[title="新建标签模版"]').click()
    await w.locator('[data-testid="new-label-dialog"]').waitFor({ timeout: 10_000 })
    const refresh = w.locator('[data-testid="new-label-printer-refresh"]')
    await expect(refresh).toBeVisible()
    await expect(refresh).toBeEnabled()
    await refresh.click()
    // 刷新只是重新枚举，不阻塞对话框；刷新后仍能正常选择
    await expect(w.locator('[data-testid="new-label-printer"]')).toBeEnabled()
    await w.locator('[data-testid="new-label-select"]').click()
    await expect(w.locator('[data-testid="toolbar"]')).toBeVisible({ timeout: 10_000 })
  } finally {
    await launched.close()
  }
})

test('安装按钮在打印机设置前面；软件安装的打印机打开应用设置且不再选择打印机', async () => {
  const launched = await launchApp()
  const w = launched.window
  try {
    await w.locator('[data-testid="toolbar"] button[title="新建标签模版"]').click()
    await w.locator('[data-testid="new-label-dialog"]').waitFor({ timeout: 10_000 })

    const installButton = w.locator('[data-testid="new-label-install"]')
    const settingsButton = w.locator('[data-testid="new-label-printer-settings"]')
    await expect(installButton).toHaveText('安装')
    await expect(settingsButton).toHaveText('打印机设置')
    const installBox = await installButton.boundingBox()
    const settingsBox = await settingsButton.boundingBox()
    expect(installBox!.x).toBeLessThan(settingsBox!.x)

    // 安装一台 MaxLabel 内置驱动打印机，安装后回到新建标签并选中它
    await installButton.click()
    await w.locator('[data-testid="printer-install-dialog"]').waitFor({ timeout: 10_000 })
    await w.locator('[data-testid="printer-install-row"]').first().click()
    await w.locator('[data-testid="printer-install-submit"]').click()
    // 安装会异步写默认打印机偏好；等状态写回再返回
    await expect(w.locator('[data-testid="printer-install-row-status"]').first()).toContainText('已安装', { timeout: 10_000 })
    await w.waitForTimeout(300)
    await w.locator('[data-testid="printer-install-back"]').click()
    await w.locator('[data-testid="new-label-dialog"]').waitFor({ timeout: 10_000 })

    // 选中的是软件安装的打印机 → 打开应用内设置，且设置页不再提供打印机选择
    await settingsButton.click()
    await w.locator('[data-testid="printer-settings-dialog"]').waitFor({ timeout: 10_000 })
    await expect(w.locator('[data-testid="printer-pref-name"]')).toHaveCount(0)
    await expect(w.locator('[data-testid="printer-pref-current"]')).toBeVisible()
    await w.locator('[data-testid="printer-settings-cancel"]').click()
    await w.locator('[data-testid="new-label-dialog"]').waitFor({ timeout: 10_000 })
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
    // 类型下拉隐藏后，默认仍落在「高级热敏纸标签」的第一条（见「当前规格」）
    await expect(w.locator('[data-testid="new-label-current-format"]')).toContainText('高级热敏纸标签')
    await expect(w.locator('[data-testid="new-label-param-width"]')).toHaveValue('40')
    await expect(w.locator('[data-testid="new-label-param-height"]')).toHaveValue('30')
    await expect(w.locator('[data-testid="new-label-param-cols"]')).toHaveValue('2')
    // 标签间距默认 3mm（列距 / 行距）
    await expect(w.locator('[data-testid="new-label-param-col-gap"]')).toHaveValue('3')
    await expect(w.locator('[data-testid="new-label-param-row-gap"]')).toHaveValue('3')
    // 纸宽 = 40×2 + 3mm 间距 + 2×左空(1mm) = 85
    await expect(w.locator('[data-testid="new-label-sheet-info"]')).toContainText('85')
    // 页面设置展开后：左空默认 1mm
    await w.locator('[data-testid="new-label-page-toggle"]').click()
    await expect(w.locator('[data-testid="new-label-page-left"]')).toHaveValue('1')
  } finally {
    await launched.close()
  }
})
