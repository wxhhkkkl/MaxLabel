import { test, expect, type Page } from '@playwright/test'
import { launchApp, pickShapeTool } from './fixtures/electron-app'
import { mkdtemp, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'

/**
 * 双击对象 = 打开「对象属性」（020 现场反馈）
 *
 * 多行文字用的是 fabric 的 Textbox（继承 IText），**自带双击就地编辑**：双击后
 * 光标进到文字里能直接打字，属性框反而不出来。复刻版要的是双击一律开属性，
 * 所以关掉了 fabric 的 `editable`，并补了一条 fabric 侧的双击兜底。
 */

const PNG_1X1 = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64'
)

type Snapshot = { ids: string[]; zoom: number; boxes: Array<{ id: string; left: number; top: number; width: number; height: number }> }

async function snapshot(page: Page): Promise<Snapshot> {
  const raw = await page.locator('[data-active-fabric-selection]').first().getAttribute('data-active-fabric-selection')
  return JSON.parse(raw ?? '{}') as Snapshot
}

async function createLabel(page: Page): Promise<void> {
  await page.locator('[data-testid="toolbar"] button[title="新建标签模版"]').click()
  await page.locator('[data-testid="new-label-dialog"]').waitFor({ timeout: 10_000 })
  await page.locator('[data-testid="new-label-select"]').click()
  await expect(page.locator('[data-testid="toolbar"]')).toBeVisible({ timeout: 10_000 })
}

test('双击普通对象打开属性', async () => {
  const launched = await launchApp()
  const w = launched.window
  try {
    await createLabel(w)
    await pickShapeTool(w)
    const canvas = w.locator('canvas.upper-canvas')
    const box = await canvas.boundingBox()
    if (!box) throw new Error('canvas has no bounding box')
    const x = box.x + box.width / 3
    const y = box.y + box.height / 3
    await w.mouse.click(x, y)
    await expect(w.locator('[data-active-fabric-selection]')).toBeVisible()
    await w.mouse.dblclick(x + 1, y + 1)
    await expect(w.locator('[data-testid="object-props-dialog"]')).toBeVisible({ timeout: 10_000 })
  } finally {
    await launched.close()
  }
})

test('双击多行文字打开属性，且不会进入就地编辑', async () => {
  const launched = await launchApp()
  const w = launched.window
  try {
    await createLabel(w)
    await w.locator('[data-tool="text"]').click()
    await w.locator('canvas').first().click({ position: { x: 300, y: 300 }, force: true })
    await w.keyboard.press('Alt+Enter')
    await expect(w.locator('[data-testid="object-props-dialog"]')).toBeVisible({ timeout: 10_000 })
    await w.locator('[data-testid="object-props-tab-text"]').click()
    await w.locator('[data-testid="text-type-multi"]').check()
    await w.locator('[data-testid="object-props-ok"]').click()
    await w.waitForTimeout(200)

    await w.locator('canvas').first().dblclick({ position: { x: 320, y: 320 }, force: true })
    await expect(w.locator('[data-testid="object-props-dialog"]')).toBeVisible({ timeout: 10_000 })
    // fabric 的就地编辑会在画布容器里插入隐藏 textarea；关掉 editable 后不应出现。
    // ⚠️ 只数画布容器内的，别把属性对话框里「常量内容」的文本框算进来。
    const editorTextareas = await w.evaluate(() => {
      const root = document.querySelector('[data-testid="paper-outline"]')?.parentElement ?? null
      return root?.querySelectorAll('textarea').length ?? 0
    })
    expect(editorTextareas).toBe(0)
  } finally {
    await launched.close()
  }
})

test('双击图片模型框内、实际绘制区域外，仍打开对象属性', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'maxlabel-img-dblclick-'))
  const file = join(dir, 'dot.png')
  await writeFile(file, PNG_1X1)
  const launched = await launchApp()
  const w = launched.window
  try {
    await createLabel(w)
    await w.locator('input[type="file"][accept="image/*"]').setInputFiles(file)
    await expect(w.locator('[data-testid="layer-object-row"]')).toHaveCount(1, { timeout: 10_000 })
    await w.waitForTimeout(300)

    // 新插入的图片是 40×30mm 框 + 1×1 源图：保持比例后实际绘制 30×30mm，
    // 左右各留 5mm。这里点进模型框的左侧留白（距框左边 3mm），仍在图片对象上。
    const before = await snapshot(w)
    const target = before.boxes[0]
    const canvas = w.locator('canvas.upper-canvas').first()
    const box = await canvas.boundingBox()
    if (!box) throw new Error('canvas has no bounding box')
    const sceneX = target.left - 30 // 3mm × PX_PER_MM
    const sceneY = target.top + target.height / 2
    await w.mouse.dblclick(box.x + sceneX * before.zoom, box.y + sceneY * before.zoom)

    await expect(w.locator('[data-testid="object-props-dialog"]')).toBeVisible({ timeout: 10_000 })
    await expect(w.locator('[data-testid="new-label-dialog"]')).toHaveCount(0)
  } finally {
    await launched.close()
  }
})

test('双击无法绘制的图片（缺图/云图未下载）打开对象属性，而不是标签格式', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'maxlabel-missing-img-'))
  const path = join(dir, 'missing-image.msdx')
  await writeFile(path, JSON.stringify({
    format: 'maxlabel-msdx',
    version: 3,
    app: 'MaxLabel',
    doc: {
      version: 3,
      name: '缺图',
      widthMm: 60,
      heightMm: 40,
      objects: [
        { id: 'rect-1', type: 'rect', x: 5, y: 5, w: 10, h: 10, rotation: 0, fill: '#ffffff', stroke: '#000000', strokeWidth: 0.3 },
        {
          id: 'missing-image', type: 'image', x: 10, y: 10, w: 40, h: 30, rotation: 0,
          src: '', imgType: 'link', linkPath: 'C:/no/such/image.png', missingImage: 'skip'
        }
      ]
    }
  }, null, 2), 'utf8')

  const launched = await launchApp({ MAXLABEL_OPEN_PATH: path })
  const w = launched.window
  try {
    await w.getByText('文件(F)', { exact: true }).first().click()
    await w.locator('[data-menu-item="打开(Q)..."]').click()
    await expect(w.locator('[data-object-id="missing-image"]')).toBeVisible({ timeout: 10_000 })

    // 用一个能绘制的矩形取当前缩放；缺图对象没有 Fabric 对象可读包围盒。
    await w.locator('[data-object-id="rect-1"]').click()
    const before = await snapshot(w)
    const canvas = w.locator('canvas.upper-canvas').first()
    const box = await canvas.boundingBox()
    if (!box) throw new Error('canvas has no bounding box')
    const sceneX = (10 + 40 / 2) * 10
    const sceneY = (10 + 30 / 2) * 10
    await w.mouse.dblclick(box.x + sceneX * before.zoom, box.y + sceneY * before.zoom)

    await expect(w.locator('[data-testid="object-props-dialog"]')).toBeVisible({ timeout: 10_000 })
    await expect(w.locator('[data-testid="new-label-dialog"]')).toHaveCount(0)
  } finally {
    await launched.close()
  }
})

test('双击画布空白处打开标签格式设置（默认开启，系统设置可关闭）', async () => {
  const launched = await launchApp()
  const w = launched.window
  try {
    await createLabel(w)
    await w.locator('canvas').first().dblclick({ position: { x: 500, y: 300 }, force: true })
    await expect(w.locator('[data-testid="new-label-dialog"]')).toBeVisible({ timeout: 10_000 })
    await expect(w.locator('[data-testid="new-label-dialog"]')).toHaveAttribute('aria-label', '标签格式设置')
    await w.locator('[data-testid="new-label-dialog"] button[aria-label="关闭"]').click()
    await expect(w.locator('[data-testid="new-label-dialog"]')).toHaveCount(0)
  } finally {
    await launched.close()
  }
})
