import assert from 'node:assert'
import type { DataCtx } from '../src/shared/domain/datasource'
import {
  COLOR_CHANGE_MODES,
  DEFAULT_COLOR_INDEX_TABLE,
  colorGranularityOptions,
  colorIndexForChar,
  imageSupportsVariableColor,
  parseColorValues,
  resolveColorChangePlan,
  resolveObjectColor
} from '../src/shared/domain/objects'

function check(name: string, fn: () => void): void {
  fn()
  console.log(`ok - ${name}`)
}

const ctx = (over: Partial<DataCtx> = {}): DataCtx => ({
  labelIndex: 1,
  recordIndex: 0,
  copy: 1,
  count: 1,
  totalLabels: 1,
  title: 'color',
  printerName: 'test',
  datasets: {},
  sharedVars: {},
  keyboardValues: {},
  ...over
})

const cc = (over: Record<string, unknown> = {}) => ({
  mode: 'fixed' as const,
  tableSource: 'private' as const,
  privateTable: [] as string[],
  changeMode: 'solid' as const,
  blockRows: 1,
  blockCols: 1,
  variableName: '',
  inputValue: '',
  ...over
})

// ① 帮助 color_main.html：颜色变化模式共六种（DIFF-27 ①）
check('六种颜色变化模式可选且含随机/内容索引/索引变量/颜色值变量', () => {
  const values = COLOR_CHANGE_MODES.map((item) => item.value)
  assert.deepStrictEqual(values, ['fixed', 'random', 'indexByContent', 'indexVar', 'valueVar', 'index', 'rgb'])
  const labels = COLOR_CHANGE_MODES.map((item) => item.label)
  for (const label of ['随机颜色', '以数据源内容为索引', '颜色索引变量', '颜色值变量', '颜色索引', 'RGB颜色值']) {
    assert.ok(labels.includes(label), `缺少模式标签 ${label}`)
  }
})

// ② 帮助：颜色索引表包括十个预先定义的颜色，分别对应索引 0 到 9（DIFF-27 ②）
check('索引表默认注入十个预定义颜色（索引 0–9）', () => {
  assert.strictEqual(DEFAULT_COLOR_INDEX_TABLE.length, 10)
  assert.strictEqual(DEFAULT_COLOR_INDEX_TABLE[0], '#000000')
  assert.strictEqual(DEFAULT_COLOR_INDEX_TABLE[1], '#FF0000')
  for (const color of DEFAULT_COLOR_INDEX_TABLE) assert.match(color, /^#[0-9A-F]{6}$/)
  const plan = resolveColorChangePlan({ type: 'rect', colorChange: cc({ mode: 'index', inputValue: '1' }) }, ctx(), '#123456')
  assert.strictEqual(plan.colors[0], '#FF0000')
})

// ③ 帮助：多个颜色数值需要使用“,”或者“|”分隔开（DIFF-27 ③）
check('颜色值同时支持逗号与竖线分隔', () => {
  assert.deepStrictEqual(parseColorValues('#FF0000,#00FF00'), ['#FF0000', '#00FF00'])
  assert.deepStrictEqual(parseColorValues('#FF0000 | #00FF00'), ['#FF0000', '#00FF00'])
  assert.deepStrictEqual(parseColorValues(' #FF0000 ,#00FF00| #0000FF '), ['#FF0000', '#00FF00', '#0000FF'])
  assert.deepStrictEqual(parseColorValues(''), [])
  const comma = resolveColorChangePlan({ type: 'text', colorChange: cc({ mode: 'rgb', inputValue: '#FF0000,#00FF00', changeMode: 'char' }) }, ctx(), '#000000', undefined, 'AB')
  const pipe = resolveColorChangePlan({ type: 'text', colorChange: cc({ mode: 'rgb', inputValue: '#FF0000 | #00FF00', changeMode: 'char' }) }, ctx(), '#000000', undefined, 'AB')
  assert.deepStrictEqual(comma.colors, ['#FF0000', '#00FF00'])
  assert.deepStrictEqual(pipe.colors, ['#FF0000', '#00FF00'])
})

// ④ 帮助：直线/矩形/图片仅整体；文字整体/逐字符；条码整体/区块/渐变（DIFF-27 ④）
check('变色粒度按对象类型收敛', () => {
  assert.deepStrictEqual(colorGranularityOptions('line'), ['solid'])
  assert.deepStrictEqual(colorGranularityOptions('rect'), ['solid'])
  assert.deepStrictEqual(colorGranularityOptions('ellipse'), ['solid'])
  assert.deepStrictEqual(colorGranularityOptions('image'), ['solid'])
  assert.deepStrictEqual(colorGranularityOptions('text'), ['solid', 'char'])
  assert.deepStrictEqual(colorGranularityOptions('barcode'), ['solid', 'block', 'gradient'])
  assert.deepStrictEqual(colorGranularityOptions('table'), [])
  const forced = resolveColorChangePlan({ type: 'rect', colorChange: cc({ mode: 'index', inputValue: '12', changeMode: 'block', blockRows: 2, blockCols: 2 }) }, ctx(), '#000000')
  assert.strictEqual(forced.kind, 'solid')
})

// ⑤ 帮助：图片只有单色的黑白图片支持可变颜色（DIFF-27 ⑤）
check('图片可变颜色仅对单色黑白图启用', () => {
  assert.strictEqual(imageSupportsVariableColor({ imgType: 'datasource' }), true)
  assert.strictEqual(imageSupportsVariableColor({ imgType: 'embed', src: 'file:///a.png' }), false)
  assert.strictEqual(imageSupportsVariableColor({ imgType: 'link', src: 'file:///a.png' }), false)
  assert.strictEqual(imageSupportsVariableColor({ src: 'mono-1' }, ctx({ images: { 'mono-1': { width: 1, height: 1, data: [] } as never } })), true)
})

// 帮助：颜色索引值的计算方法
check('颜色索引字符计算方法与帮助一致', () => {
  assert.strictEqual(colorIndexForChar('0'), 0)
  assert.strictEqual(colorIndexForChar('7'), 7)
  assert.strictEqual(colorIndexForChar('A'), 0)
  assert.strictEqual(colorIndexForChar('K'), 0)
  assert.strictEqual(colorIndexForChar('a'), 2)
  assert.strictEqual(colorIndexForChar('Z'), 5)
  assert.strictEqual(colorIndexForChar('#'), 35 % 10)
})

// 帮助：以数据源内容为索引——文字/条码按内容，其它对象用索引 0
check('以数据源内容为索引按字符取色，其它对象取索引 0 的颜色', () => {
  const textPlan = resolveColorChangePlan({ type: 'text', colorChange: cc({ mode: 'indexByContent', changeMode: 'char' }) }, ctx(), '#000000', undefined, '1A')
  assert.strictEqual(textPlan.kind, 'chars')
  assert.deepStrictEqual(textPlan.colors, ['#FF0000', '#000000'])
  const rectPlan = resolveColorChangePlan({ type: 'rect', colorChange: cc({ mode: 'indexByContent' }) }, ctx(), '#000000', undefined, '')
  assert.deepStrictEqual(rectPlan.colors, ['#000000'])
})

// 帮助：颜色索引变量 / 颜色值变量取命名变量
check('颜色索引变量与颜色值变量分别按索引与 RGB 取值', () => {
  const indexPlan = resolveColorChangePlan(
    { type: 'text', colorChange: cc({ mode: 'indexVar', variableName: 'clr', changeMode: 'char' }) },
    ctx({ keyboardValues: { clr: '12' } }),
    '#000000',
    undefined,
    'AB'
  )
  assert.deepStrictEqual(indexPlan.colors, ['#FF0000', '#00FF00'])
  const valuePlan = resolveColorChangePlan(
    { type: 'text', colorChange: cc({ mode: 'valueVar', variableName: 'clr', changeMode: 'char' }) },
    ctx({ keyboardValues: { clr: '#123456|#654321' } }),
    '#000000',
    undefined,
    'AB'
  )
  assert.deepStrictEqual(valuePlan.colors, ['#123456', '#654321'])
})

// 帮助：条码可按行列（区块）变色与渐变变色
check('条码区块与渐变变色产出对应颜色数量', () => {
  const block = resolveColorChangePlan(
    { type: 'barcode', colorChange: cc({ mode: 'index', inputValue: '0123', changeMode: 'block', blockRows: 2, blockCols: 2 }) },
    ctx(),
    '#000000'
  )
  assert.strictEqual(block.kind, 'block')
  assert.strictEqual(block.colors.length, 4)
  assert.deepStrictEqual(block.colors, ['#000000', '#FF0000', '#00FF00', '#0000FF'])
  const gradient = resolveColorChangePlan(
    { type: 'barcode', colorChange: cc({ mode: 'rgb', inputValue: '#000000|#FFFFFF', changeMode: 'gradient', blockRows: 1, blockCols: 3 }) },
    ctx(),
    '#000000'
  )
  assert.strictEqual(gradient.kind, 'gradient')
  assert.deepStrictEqual(gradient.colors, ['#000000', '#808080', '#FFFFFF'])
})

// 帮助：随机颜色模式下每个对象的颜色在打印时随机设置（同一次打印结果稳定）
check('随机颜色模式稳定且取自索引表', () => {
  const plan = resolveColorChangePlan({ type: 'text', colorChange: cc({ mode: 'random', changeMode: 'char' }) }, ctx({ labelIndex: 3 }), '#000000', undefined, 'ABCD')
  assert.strictEqual(plan.kind, 'chars')
  assert.strictEqual(plan.colors.length, 4)
  for (const color of plan.colors) assert.ok(DEFAULT_COLOR_INDEX_TABLE.includes(color))
  const again = resolveColorChangePlan({ type: 'text', colorChange: cc({ mode: 'random', changeMode: 'char' }) }, ctx({ labelIndex: 3 }), '#000000', undefined, 'ABCD')
  assert.deepStrictEqual(again.colors, plan.colors)
})

// 向后兼容入口
check('resolveObjectColor 返回整体变色代表色', () => {
  assert.strictEqual(resolveObjectColor({ type: 'text', colorChange: cc({ mode: 'rgb', inputValue: '#FF0000|#00FF00' }) }, ctx(), '#000000'), '#FF0000')
  assert.strictEqual(resolveObjectColor({ type: 'text' }, ctx(), '#123456'), '#123456')
})

console.log('color change checks passed')
