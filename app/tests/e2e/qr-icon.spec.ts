import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test, expect } from '@playwright/test'
import { launchApp, openFixture } from './fixtures/electron-app'

/** 8×8 纯黑 PNG（已内嵌，避免测试依赖图片解码器）。 */
const BLACK_ICON = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAgAAAAICAYAAADED76LAAAABmJLR0QA/wD/AP+gvaeTAAAAFUlEQVQYlWNkYGD4z4AHMOGTHD4KAAxTAQ+OWA1IAAAAAElFTkSuQmCC'

/**
 * 二维码中心图标：图标要叠在码中央、下面的留白块要够大，且整体只有黑白两色。
 * 图标 20% 码宽 + 「图标区域」8 个模块 → 图标半宽 40 scene px、白块半宽约 64。
 */
test('QR center icon is composited in monochrome onto the symbol', async () => {
  test.setTimeout(120_000)
  const dir = await mkdtemp(join(tmpdir(), 'maxlabel-qricon-'))
  const path = join(dir, 'qr-icon.msdx')
  const doc = {
    version: 2,
    name: 'QR 图标',
    widthMm: 60,
    heightMm: 60,
    objects: [{
      id: 'qr',
      type: 'barcode',
      x: 10,
      y: 10,
      w: 40,
      h: 40,
      rotation: 0,
      symbology: 'qrcode',
      showText: false,
      source: { kind: 'constant', value: 'https://example.com/qr-icon-test' },
      barcodeOptions: { qrIconImage: BLACK_ICON, qrIconSizePct: 20, qrIconAreaSize: 8 }
    }]
  }
  await writeFile(path, JSON.stringify({ format: 'maxlabel-msdx', version: 2, app: 'MaxLabel', doc }), 'utf8')

  const launched = await launchApp({ MAXLABEL_OPEN_PATH: path })
  const w = launched.window
  try {
    await openFixture(w)
    const zoom = Number(await w.locator('[data-testid="status-zoom"] input').inputValue()) / 100

    const pixel = async (sceneX: number, sceneY: number): Promise<number[]> => w.evaluate(({ sceneX, sceneY, zoom }) => {
      const el = document.querySelectorAll('canvas')[0] as HTMLCanvasElement
      const ctx = el.getContext('2d')
      if (!ctx) return [-1, -1, -1, -1]
      const d = ctx.getImageData(Math.round(sceneX * zoom), Math.round(sceneY * zoom), 1, 1).data
      return [d[0], d[1], d[2], d[3]]
    }, { sceneX, sceneY, zoom })

    // 码区：对象 x/y=10mm、40×40mm，scale=10px/mm → 中心 scene (300,300)。
    const luma = (c: number[]) => 0.299 * c[0] + 0.587 * c[1] + 0.114 * c[2]

    // 图标半宽 40 scene px：内部 7×7 网格应整片是黑（没叠图标时这里是码的明暗模块）。
    let dark = 0
    for (let dx = -30; dx <= 30; dx += 10) {
      for (let dy = -30; dy <= 30; dy += 10) {
        if (luma(await pixel(300 + dx, 300 + dy)) < 60) dark++
      }
    }
    expect(dark).toBe(49)

    // 图标外、留白块内的一圈应该是白的。
    for (const [dx, dy] of [[50, 0], [-50, 0], [0, 50], [0, -50]]) {
      expect(luma(await pixel(300 + dx, 300 + dy))).toBeGreaterThan(220)
    }

    // 单色：图标像素三通道相等（没有彩色残留）。
    const center = await pixel(300, 300)
    expect(center[0]).toBe(center[1])
    expect(center[1]).toBe(center[2])
  } finally {
    await launched.close()
    await rm(dir, { recursive: true, force: true }).catch(() => undefined)
  }
})
