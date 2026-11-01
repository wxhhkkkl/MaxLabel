import { describe, expect, it } from 'vitest'
import { verticalText } from '@shared/domain/objects'
import { normalizeDocument } from '@shared/domain'
import { resolvePrintScene } from '@shared/print/scene'
import { dataCtx } from '../../../helpers/factories'

/**
 * 竖排文字（020 现场需求）：单行 / 多行文字可选择「竖排」，字符从上到下排布。
 *
 * 实现上把字符逐行拆开，画布与打印共用同一份结果 —— 这样原生指令打印会像
 * 其它含换行的文本一样自动退回位图，不会出现"画布竖排、打印横排"。
 */
describe('竖排文字', () => {
  it('逐字符换行', () => {
    expect(verticalText('ABC')).toBe('A\nB\nC')
  })

  it('中文同样逐字一行', () => {
    expect(verticalText('批号')).toBe('批\n号')
  })

  it('多行竖排：每一行自成一列（转置后仍在同一块里，可继续用换行撰写）', () => {
    expect(verticalText('AB\nCD')).toBe('AC\nBD')
    expect(verticalText('AB\r\nCD')).toBe('AC\nBD')
  })

  it('单独的 CR 也算换行（常量里的 <CR> 就解成 \\r）', () => {
    expect(verticalText('AB\rCD')).toBe('AC\nBD')
  })

  it('结尾的空行不产生空列（<LF> 结尾很常见）', () => {
    expect(verticalText('AB\nCD\n')).toBe('AC\nBD')
  })

  it('列长短不齐时用全角空格补齐，短列底部留白而不是错位', () => {
    expect(verticalText('ABC\nD')).toBe('AD\nB\u3000\nC\u3000')
  })

  it('码点安全：emoji 不会被拆成两个半字符', () => {
    expect(verticalText('A😀')).toBe('A\n😀')
  })

  it('空串保持空串', () => {
    expect(verticalText('')).toBe('')
  })
})

describe('竖排文字 —— 打印场景', () => {
  function doc(vertical: boolean) {
    return normalizeDocument({
      version: 3,
      name: 't',
      widthMm: 100,
      heightMm: 100,
      objects: [{
        id: 't1', type: 'text', x: 0, y: 0, w: 40, h: 40, rotation: 0,
        fontFamily: '微软雅黑', fontSize: 4, bold: false, align: 'left', color: '#000000',
        fontWidthScale: 1, charSpacing: 0, textType: 'single', backgroundTransparent: true,
        ...(vertical ? { vertical: true } : {}),
        source: { kind: 'constant', value: '批号' }
      }]
    })
  }

  it('竖排对象在打印场景里逐字符换行（与画布同一份结果）', () => {
    const scene = resolvePrintScene(doc(true), dataCtx())
    const text = scene.primitives.find((primitive) => primitive.kind === 'text')
    expect(text?.kind === 'text' ? text.value : '').toBe('批\n号')
  })

  it('未开启竖排时保持原样', () => {
    const scene = resolvePrintScene(doc(false), dataCtx())
    const text = scene.primitives.find((primitive) => primitive.kind === 'text')
    expect(text?.kind === 'text' ? text.value : '').toBe('批号')
  })
})
