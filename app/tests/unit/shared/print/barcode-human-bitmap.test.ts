import { describe, expect, it } from 'vitest'
import type { MonoBitmap } from '@shared/domain/units'
import { attachSceneHumanTextBitmaps, resolvePrintScene } from '@shared/print/scene'
import { buildTSPL } from '@shared/print/tspl'
import { buildResolvedCommands } from '@shared/print/engine'
import { dataCtx, printerConfig, sampleDoc } from '../../../helpers/factories'

const printer = printerConfig({ driver: 'tspl', port: { type: 'file', encoding: 'utf8' } })

function preparedScene() {
  const scene = resolvePrintScene(sampleDoc(), dataCtx())
  const bitmap: MonoBitmap = {
    width: 16,
    height: 2,
    bytesPerRow: 2,
    bytes: new Uint8Array([0xff, 0xff, 0x00, 0x00]),
    originXMm: 20,
    originYMm: 14
  }
  return attachSceneHumanTextBitmaps(scene, new Map([['1:3', { bitmap }]]))
}

describe('TSPL 条码人读文字位图', () => {
  it('keeps native bars, disables firmware text and overlays the rendered text bitmap', () => {
    const text = buildTSPL(preparedScene(), printer, [])
    // 柱体仍走原生 BARCODE，起始位置保持对象框左缘（8mm = 64 dots）。
    expect(text).toMatch(/BARCODE 64,\d+,"128",\d+,0,0,/)
    // 不再输出人读文字 TEXT（字宽由画布字体决定，不依赖固件估算）。
    expect(text.split('\n').some((line) => line.startsWith('TEXT ') && line.includes('"SN-1001"'))).toBe(false)
    // 文字位图按画布落点叠加（20mm,14mm → 160,112 dots）。
    expect(text).toContain('BITMAP 160,112,2,2,1,@@RAW:1:3-humantext@@')
  })

  it('transmits the human text bitmap bytes with the rest of the job', () => {
    const result = buildResolvedCommands(printer, {
      resolvedPages: [preparedScene()],
      count: 1,
      copy: 1,
      title: '测试',
      datasets: {}
    })
    expect(result.segments.some((segment) => segment.type === 'bin' && segment.data.length === 4)).toBe(true)
  })
})
