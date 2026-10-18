// DIFF-83：MFC 控件标题里的 `&` 是**加速键标记**，真机屏幕上不显示。
// 真机控件树 dump（如 `parity/reference/labelshop/probe-60-barcode-props-tree.txt`）读到的是
// `条码符号类型(码制)(&B):`，而真机实拍（`parity/reference/labelshop/verifier-20c-barcode-page.png`，
// 并排图 `parity/review/cmp-propsbarcode-1741523.png` 左半）显示的是 `条码符号类型(码制)(B):`。
import assert from 'node:assert'
import { acceleratorOf, displayMfcCaption, LITERAL_ACCELERATOR_PATTERN } from '../src/shared/mfcCaption'

function check(name: string, fn: () => void): void {
  try {
    fn()
  } catch (error) {
    console.error(`not ok - ${name}`)
    throw error
  }
  console.log(`ok - ${name}`)
}

check('单个 & 是加速键标记，不渲染', () => {
  assert.strictEqual(displayMfcCaption('条码符号类型(码制)(&B):'), '条码符号类型(码制)(B):')
  assert.strictEqual(displayMfcCaption('X 尺寸(&X):'), 'X 尺寸(X):')
  assert.strictEqual(displayMfcCaption('码  高(&H):'), '码  高(H):')
  assert.strictEqual(displayMfcCaption('GS1/EAN 128(&U)'), 'GS1/EAN 128(U)')
  assert.strictEqual(displayMfcCaption('字符集(&C):'), '字符集(C):')
})

check('真机实拍里出现的整页文案与转换结果逐字一致', () => {
  // 与 verifier-20c-barcode-page.png 实拍逐项对照（左真机 / 右复刻版）
  const page = [
    ['条码符号类型(码制)(&B):', '条码符号类型(码制)(B):'],
    ['X 尺寸(&X):', 'X 尺寸(X):'],
    ['码  高(&H):', '码  高(H):'],
    ['字符集(&C):', '字符集(C):'],
    ['位置(&P):', '位置(P):'],
    ['垂直偏移(&O):', '垂直偏移(O):'],
    ['对齐方式(&A):', '对齐方式(A):'],
    ['字符模板(&T)', '字符模板(T)']
  ] as const
  for (const [raw, shown] of page) {
    assert.strictEqual(displayMfcCaption(raw), shown)
    assert.ok(!displayMfcCaption(raw).includes('&'), `${shown} 不得含字面量 &`)
  }
})

check('&& 按 MFC 语义渲染成一个 &', () => {
  assert.strictEqual(displayMfcCaption('A&&B'), 'A&B')
  assert.strictEqual(displayMfcCaption('（&&）'), '（&）')
  assert.strictEqual(displayMfcCaption('R&D'), 'RD') // 单个 & 仍是加速键标记
})

check('末尾孤立的 & 不渲染', () => {
  assert.strictEqual(displayMfcCaption('宽度(&W)'), '宽度(W)')
  assert.strictEqual(displayMfcCaption('结尾&'), '结尾')
  assert.strictEqual(displayMfcCaption(''), '')
})

check('acceleratorOf 取回加速键字符（真机屏幕上不可见但按键可用）', () => {
  assert.strictEqual(acceleratorOf('条码符号类型(码制)(&B):'), 'B')
  assert.strictEqual(acceleratorOf('码  高(&H):'), 'H')
  assert.strictEqual(acceleratorOf('GS1/EAN 128(&U)'), 'U')
  assert.strictEqual(acceleratorOf('电子称'), null)
  assert.strictEqual(acceleratorOf('A&&B'), null)
})

check('静态校验用的字面量形态能命中 (&X) 且放过正常文本', () => {
  assert.ok(LITERAL_ACCELERATOR_PATTERN.test('X 尺寸(&X):'))
  assert.ok(!LITERAL_ACCELERATOR_PATTERN.test('X 尺寸(X):'))
  assert.ok(!LITERAL_ACCELERATOR_PATTERN.test('R&D 部门'))
})

console.log('6 MFC caption checks passed')
