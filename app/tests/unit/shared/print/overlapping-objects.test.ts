import { describe, expect, it } from 'vitest'
import { normalizeDocument } from '@shared/domain'
import { resolvePrintScene, isPrimitiveFullyWithinLabel, resolvePrintJob } from '@shared/print/scene'
import { printModeHint, sceneNeedsPageBitmap } from '@shared/print/capabilities'
import { buildExecutablePrintPlan } from '@shared/print/plan'
import type { LabelObject } from '@shared/domain/objects'
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

/** 多联版式：每枚标签重复同一份设计，所以“放”在标签格之外的对象不属于任何一枚。 */
function multiDoc(objects: LabelObject[]) {
  return normalizeDocument({
    version: 3,
    name: 'multi',
    widthMm: 40,
    heightMm: 30,
    layout: { rows: 1, cols: 2, rowGapMm: 2, colGapMm: 2, shape: 'rect', pageWidthMm: 82, pageHeightMm: 30 },
    objects
  })
}

function textAt(id: string, x: number, w: number, value: string): LabelObject {
  return {
    id, type: 'text', x, y: 4, w, h: 8, rotation: 0,
    fontFamily: '微软雅黑', fontSize: 4, bold: false, align: 'left', color: '#000000',
    source: { kind: 'constant', value }
  } as LabelObject
}

function pageScene(doc: ReturnType<typeof multiDoc>) {
  const plan = buildExecutablePrintPlan({ test: false, requestedCount: 2, recordStart: 0, cellsPerPage: 2, startSlot: 1, defaultCopies: 1 })
  return resolvePrintJob(doc, dataCtx(), doc.layout, plan).pages[0].scene
}

describe('多联版式里不在标签格内的对象', () => {
  it('放在两枚标签之间的文字/条码直接跳过并提示，不再把整页逼成位图', () => {
    // 标签格：[0–40]、[42–82]；x=41 落在 2mm 空隙里，任何一枚都放不下。
    const scene = pageScene(multiDoc([
      textAt('inside', 2, 10, 'INSIDE'),
      textAt('stray', 41, 10, 'STRAY')
    ]))
    expect(scene.primitives.some((primitive) => primitive.object.id === 'stray')).toBe(false)
    // 正常对象仍然在每枚标签上各出现一次。
    expect(scene.primitives.filter((primitive) => primitive.object.id === 'inside')).toHaveLength(2)
    expect(scene.warnings?.some((warning) => warning.includes('STRAY') && warning.includes('跳过'))).toBe(true)
    expect(sceneNeedsPageBitmap(scene, printer)).toBe(false)
  })

  it('打印方式提示也必须按整页场景算，不能再报“整页位图”', () => {
    const scene = pageScene(multiDoc([
      textAt('inside', 2, 10, 'INSIDE'),
      textAt('stray', 41, 10, 'STRAY')
    ]))
    // 提示与整页场景同源：不再是 raster（具体 native/mixed 由其它图元属性决定）。
    expect(printModeHint(scene, printer).mode).not.toBe('raster')
  })

  it('放在标签内、只是框越界的对象仍保留（整页位图兜底不变）', () => {
    const scene = pageScene(multiDoc([textAt('overhang', 16.62, 40, 'OVER')]))
    expect(scene.primitives.some((primitive) => primitive.object.id === 'overhang')).toBe(true)
    expect(sceneNeedsPageBitmap(scene, printer)).toBe(true)
  })

  it('单枚标签的版式不受影响：越界对象仍然保留', () => {
    const scene = resolvePrintScene(docWith(40) as never, dataCtx())
    expect(scene.primitives).toHaveLength(1)
    expect(scene.warnings).toBeUndefined()
  })
})
