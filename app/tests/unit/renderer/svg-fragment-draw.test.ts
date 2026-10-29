import { describe, expect, it } from 'vitest'
import { buildFragmentOps, multiplyMatrix, parseTransform } from '@/rendering/svgFragmentDraw'

/**
 * 编辑画布与位图打印的条码改成矢量的基础设施：把 `barcodeToSvgFragment`
 * 生成的片段解析成 Path2D 绘制指令。片段来自 bwip-js + 本仓库的人读文字，
 * 标签集合受控，所以按固定文法解析即可。
 */

// 一维码：bwip-js 输出单条 stroke 型 path（与真实输出同形）
const ONE_D = '<svg viewBox="0 0 1864 341" xmlns="http://www.w3.org/2000/svg">'
  + '<path stroke="#000000" stroke-width="16" d="M8 341L8 0M144 341L144 0"/></svg>'

// 二维码：fill 型 path + fill-rule
const TWO_D = '<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">'
  + '<path fill-rule="evenodd" d="M0 0h10v10H0z"/></svg>'

// 带背景与人读文字的完整片段（vectorBarcode.ts 的拼装形状）
const WITH_TEXT = '<svg xmlns="http://www.w3.org/2000/svg" width="120" height="140" viewBox="0 0 120 140">'
  + '<rect x="0" y="0" width="120" height="140" fill="#ffffff"/>'
  + '<svg x="10" y="0" width="100" height="100" viewBox="0 0 100 100">'
  + '<path stroke="#000000" stroke-width="4" d="M4 100L4 0"/></svg>'
  + '<g transform="translate(0 100) scale(1.5 1)">'
  + '<text x="0" y="1.2" font-family="Arial" font-size="8" font-weight="bold" fill="#000000" dominant-baseline="text-before-edge">ABC</text>'
  + '<line x1="0" y1="9" x2="40" y2="9" stroke="#000000" stroke-width="0.5"/>'
  + '</g></svg>'

describe('SVG 片段 → 绘制指令', () => {
  it('一维条码解析成描边路径', () => {
    const [op] = buildFragmentOps(ONE_D)
    expect(op.kind).toBe('path')
    if (op.kind !== 'path') return
    expect(op.stroke).toBe('#000000')
    expect(op.strokeWidth).toBe(16)
    expect(op.fill).toBeNull()
    expect(op.d).toContain('M8 341L8 0')
  })

  it('二维码解析成填充路径并保留 evenodd', () => {
    const [op] = buildFragmentOps(TWO_D)
    expect(op.kind).toBe('path')
    if (op.kind !== 'path') return
    expect(op.stroke).toBeNull()
    expect(op.fill).toBe('#000000')
    expect(op.fillRule).toBe('evenodd')
  })

  it('背景矩形、嵌套 svg 的位移与人读文字都按顺序产出', () => {
    const ops = buildFragmentOps(WITH_TEXT)
    expect(ops.map((op) => op.kind)).toEqual(['rect', 'path', 'text', 'line'])

    const [rect, path, text, line] = ops
    expect(rect.matrix).toEqual([1, 0, 0, 1, 0, 0])
    // 嵌套 svg x=10 → 平移 10
    expect(path.matrix[4]).toBe(10)
    // <g translate(0 100) scale(1.5 1)> → 文字位置 =(0*1.5+0, 1.2*1+100)
    expect(text.matrix).toEqual([1.5, 0, 0, 1, 0, 100])
    if (text.kind === 'text') {
      expect(text.text).toBe('ABC')
      expect(text.font).toBe('bold 8px Arial')
      expect(text.x).toBe(0)
      expect(text.y).toBeCloseTo(1.2)
    }
    if (line.kind === 'line') {
      expect(line.strokeWidth).toBe(0.5)
      expect(line.x2).toBe(40)
    }
  })

  it('嵌套 svg 的 viewBox 会缩放到 width/height', () => {
    const ops = buildFragmentOps(
      '<svg viewBox="0 0 50 50"><svg x="5" y="6" width="100" height="200" viewBox="0 0 50 50">'
      + '<path stroke="#000" stroke-width="1" d="M0 0L1 1"/></svg></svg>'
    )
    expect(ops[0].matrix).toEqual([2, 0, 0, 4, 5, 6])
  })

  it('空片段不产生指令', () => {
    expect(buildFragmentOps('')).toEqual([])
  })
})

describe('变换矩阵', () => {
  it('translate / scale 依次相乘', () => {
    expect(parseTransform('translate(10 20) scale(2 3)')).toEqual([2, 0, 0, 3, 10, 20])
    expect(parseTransform('scale(2)')).toEqual([2, 0, 0, 2, 0, 0])
    expect(parseTransform(undefined)).toEqual([1, 0, 0, 1, 0, 0])
  })

  it('matrix(a b c d e f) 直接取用', () => {
    expect(parseTransform('matrix(1 2 3 4 5 6)')).toEqual([1, 2, 3, 4, 5, 6])
  })

  it('矩阵相乘把后者的位移叠到前者上', () => {
    const translate = parseTransform('translate(10 0)')
    const scale = parseTransform('scale(2 2)')
    expect(multiplyMatrix(translate, scale)).toEqual([2, 0, 0, 2, 10, 0])
  })
})
