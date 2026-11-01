import { describe, expect, it } from 'vitest'
import { normalizeDocument } from '@shared/domain'
import { resolvePrintScene, isPrimitiveFullyWithinLabel } from '@shared/print/scene'
import { sceneNeedsPageBitmap } from '@shared/print/capabilities'
import { printerConfig, dataCtx } from '../../../helpers/factories'

/**
 * 对象超出标签范围时，原生指令会把它整条丢弃（固件无法裁剪）——
 * 结果是**打印机吐白纸且没有任何提示**（020 现场：40mm 标签上放了 44mm 宽的一维码）。
 *
 * 规则：这种情况下必须整页出图（BITMAP），与驱动打印按页裁剪的行为一致。
 */
function docWith(textWidth: number) {
  return normalizeDocument({
    version: 3,
    name: 't',
    widthMm: 40,
    heightMm: 30,
    layout: { rows: 1, cols: 2, rowGapMm: 2, colGapMm: 2, shape: 'rect', pageWidthMm: 82, pageHeightMm: 30 },
    objects: [{
      id: 't1', type: 'text', x: 16.62, y: 4, w: textWidth, h: 8, rotation: 0,
      fontFamily: '微软雅黑', fontSize: 4, bold: false, align: 'left', color: '#000000',
      source: { kind: 'constant', value: 'ABC' }
    }]
  })
}

const printer = printerConfig({ driver: 'tspl', port: { type: 'usb' } as never })

describe('超出标签范围的对象', () => {
  it('放得下时不强制整页位图', () => {
    const scene = resolvePrintScene(docWith(20) as never, dataCtx())
    expect(isPrimitiveFullyWithinLabel(scene, scene.primitives[0])).toBe(true)
    expect(sceneNeedsPageBitmap(scene, printer)).toBe(false)
  })

  it('超出标签右边界时必须整页出图，而不是被静默丢弃', () => {
    const scene = resolvePrintScene(docWith(40) as never, dataCtx())
    expect(isPrimitiveFullyWithinLabel(scene, scene.primitives[0])).toBe(false)
    expect(sceneNeedsPageBitmap(scene, printer)).toBe(true)
  })
})
