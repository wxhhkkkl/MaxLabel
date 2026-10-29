import { test, expect, type Page } from '@playwright/test'
import { launchApp } from './fixtures/electron-app'

async function createLabel(page: Page): Promise<void> {
  await page.locator('[data-testid="toolbar"] button[title="新建标签模版"]').click()
  await page.locator('[data-testid="new-label-dialog"]').waitFor({ timeout: 10_000 })
  await page.locator('[data-testid="new-label-select"]').click()
  await expect(page.locator('[data-testid="toolbar"]')).toBeVisible({ timeout: 10_000 })
}

/**
 * 015 现场反馈：125% 缩放时纸张边缘清晰、126% 时发糊。
 *
 * 原因是纸张描边的缩放比用的是**原始 zoom**（`10 * zoom`，毫米坐标），
 * 而画布框/裁剪框用的是 `round(widthMm * 10 * zoom)`。两者最多差半个像素——
 * 边缘正好落在半像素上时，0.5px 的描边被摊到两个像素，看着就糊。
 * 修复后描边缩放比由取整后的尺寸反推，四条边永远与画布框重合。
 */
async function outlineAlignment(page: Page) {
  return page.evaluate(() => {
    const svg = document.querySelector('[data-testid="paper-outline"]') as SVGSVGElement | null
    const path = svg?.querySelector('path[stroke]') as SVGPathElement | null
    const area = document.querySelector('[data-testid="template-edit-area"]') as HTMLElement | null
    if (!svg || !path || !area) return null
    const viewW = Number(svg.getAttribute('width'))
    const viewH = Number(svg.getAttribute('height'))
    const widthMm = Number(area.dataset.widthMm)
    const heightMm = Number(area.dataset.heightMm)
    const nums = (path.getAttribute('transform') ?? '').replace(/[a-z()]/gi, '').trim().split(/[\s,]+/).map(Number)
    const [sx, sy] = nums
    return {
      widthMm, heightMm, viewW, viewH,
      edgeX: widthMm * sx,
      edgeY: heightMm * sy,
      offX: Math.abs(widthMm * sx - viewW),
      offY: Math.abs(heightMm * sy - viewH)
    }
  })
}

test('paper outline lands exactly on the canvas box at every zoom', async () => {
  const launched = await launchApp()
  const w = launched.window
  try {
    await createLabel(w)
    await w.waitForTimeout(300)

    for (const label of ['适应窗口（默认）', '150%', '200%', '300%']) {
      if (label !== '适应窗口（默认）') {
        await w.locator('[data-testid="zoom-control"] select').selectOption(label === '150%' ? '1.5' : label === '200%' ? '2' : '3')
        await w.waitForTimeout(250)
      }
      const info = await outlineAlignment(w)
      if (!info) throw new Error('paper outline not found')
      expect(info.offX, `${label} 横向偏移`).toBeLessThan(0.01)
      expect(info.offY, `${label} 纵向偏移`).toBeLessThan(0.01)
    }
  } finally {
    await launched.close()
  }
})
