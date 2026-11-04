import { test, expect, type Page } from '@playwright/test'
import { launchApp, pickShapeTool } from './fixtures/electron-app'

/**
 * 原「矩形」工具改为「图形」工具：点击展开图形库，选中形状后拖拽创建。
 * 形状以 `RectObj.shape` 保存，画布/预览/打印共用 shared/domain/shapes 的路径。
 */

async function createLabel(page: Page): Promise<void> {
  await page.locator('[data-testid="toolbar"] button[title="新建标签模版"]').click()
  await page.locator('[data-testid="new-label-dialog"]').waitFor({ timeout: 10_000 })
  await page.locator('[data-testid="new-label-select"]').click()
  await expect(page.locator('[data-testid="toolbar"]')).toBeVisible({ timeout: 10_000 })
}

async function dragOnCanvas(w: Page, dx: number, dy: number, at = { x: 120, y: 120 }): Promise<void> {
  const canvas = w.locator('canvas').first()
  const box = await canvas.boundingBox()
  if (!box) throw new Error('canvas has no bounding box')
  const sx = Math.round(box.x + at.x)
  const sy = Math.round(box.y + at.y)
  await w.mouse.move(sx, sy)
  await w.mouse.down()
  await w.mouse.move(sx + dx, sy + dy, { steps: 8 })
  await w.mouse.up()
  await w.waitForTimeout(400)
}

type LayerRow = { id: string; x: number; y: number; w: number; h: number }

async function layerRows(w: Page): Promise<LayerRow[]> {
  return w.locator('[data-testid="layer-object-row"]').evaluateAll((els) => els.map((el) => ({
    id: String(el.getAttribute('data-object-id')),
    x: Number(el.getAttribute('data-object-x')),
    y: Number(el.getAttribute('data-object-y')),
    w: Number(el.getAttribute('data-object-w')),
    h: Number(el.getAttribute('data-object-h'))
  })))
}

test('图形面板按分类展示，选择后拖拽创建对应形状', async () => {
  const launched = await launchApp()
  const w = launched.window
  try {
    await createLabel(w)
    await w.locator('[data-tool="rect"]').click()
    const picker = w.locator('[data-testid="shape-picker"]')
    await expect(picker).toBeVisible({ timeout: 10_000 })
    for (const label of ['基本图形', '四边形', '多边形', '圆弧', '星型', '箭头']) {
      await expect(picker.getByText(label, { exact: true })).toBeVisible()
    }
    await w.locator('[data-testid="shape-pick-triangle"]').click()
    await expect(picker).toHaveCount(0)

    await dragOnCanvas(w, 140, 100)
    const triangle = w.locator('[data-testid="layer-object-row"][data-object-shape="triangle"]')
    await expect(triangle).toHaveCount(1)
    expect(Number(await triangle.getAttribute('data-object-w'))).toBeGreaterThan(4)
    expect(Number(await triangle.getAttribute('data-object-h'))).toBeGreaterThan(2.5)

    // 属性窗口的「图形」页签能读写同一形状
    await w.keyboard.press('Alt+Enter')
    await w.locator('[data-testid="object-props-dialog"]').waitFor({ timeout: 10_000 })
    await w.locator('[data-testid="object-props-tab-shape"]').click()
    await expect(w.locator('[data-testid="shape-kind"]')).toHaveValue('triangle')
    // 「填充方框内部」重复选项已移除，填充由「填充色」的纯色/无控制。
    await expect(w.locator('[data-testid="shape-fill-enabled"]')).toHaveCount(0)
    await expect(w.locator('[data-testid="shape-fill-mode"]')).toBeVisible()
  } finally {
    await launched.close()
  }
})

test('星型与箭头也能从面板选择并创建', async () => {
  const launched = await launchApp()
  const w = launched.window
  try {
    await createLabel(w)
    await pickShapeTool(w, 'star5')
    await dragOnCanvas(w, 140, 140)
    await expect(w.locator('[data-testid="layer-object-row"][data-object-shape="star5"]')).toHaveCount(1)

    await pickShapeTool(w, 'arrowRight')
    await dragOnCanvas(w, 160, 90, { x: 420, y: 120 })
    await expect(w.locator('[data-testid="layer-object-row"][data-object-shape="arrowRight"]')).toHaveCount(1)
  } finally {
    await launched.close()
  }
})

test('移动一个图形不会改变其它图形的坐标和尺寸', async () => {
  const launched = await launchApp()
  const w = launched.window
  try {
    await createLabel(w)
    await pickShapeTool(w, 'triangle')
    await dragOnCanvas(w, 120, 90, { x: 80, y: 80 })
    await pickShapeTool(w, 'star5')
    await dragOnCanvas(w, 120, 120, { x: 420, y: 80 })

    const before = await layerRows(w)
    expect(before).toHaveLength(2)
    const target = before[0]
    const other = before[1]

    await w.locator('[data-tool="select"]').click()
    const zoom = Number(await w.locator('[data-testid="status-zoom"] input').inputValue()) / 100
    const canvas = w.locator('canvas').first()
    const box = await canvas.boundingBox()
    if (!box) throw new Error('canvas has no bounding box')
    const dragObject = async (row: LayerRow) => {
      const cx = box.x + (row.x + row.w / 2) * 10 * zoom
      const cy = box.y + (row.y + row.h / 2) * 10 * zoom
      await w.mouse.move(cx, cy)
      await w.mouse.down()
      await w.mouse.move(cx + 50, cy + 35, { steps: 8 })
      await w.mouse.up()
      await w.waitForTimeout(600)
    }

    await dragObject(target)
    const afterFirst = await layerRows(w)
    const firstMoved = afterFirst.find((row) => row.id === target.id)
    const secondUntouched = afterFirst.find((row) => row.id === other.id)
    if (!firstMoved || !secondUntouched) throw new Error('missing objects after first move')
    expect(firstMoved.x).toBeGreaterThan(target.x + 0.5)
    expect(secondUntouched).toEqual(other)

    // 再移动第二个：第一个（已移动后的坐标）必须原样保留。
    await dragObject(secondUntouched)
    const afterSecond = await layerRows(w)
    const firstAfterSecond = afterSecond.find((row) => row.id === target.id)
    const secondMoved = afterSecond.find((row) => row.id === other.id)
    if (!firstAfterSecond || !secondMoved) throw new Error('missing objects after second move')
    expect(firstAfterSecond).toEqual(firstMoved)
    expect(secondMoved.x).toBeGreaterThan(secondUntouched.x + 0.5)
  } finally {
    await launched.close()
  }
})
