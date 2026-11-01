import { describe, expect, it } from 'vitest'
import { keyboardInputFields, missingKeyboardLabels } from '@/features/printing/keyboardInputs'

/**
 * 打印面板「输入数据」里的键盘输入框（020）。
 *
 * 原版是在面板里直接给出「输入项目1…」，而不是每次打印弹一个对话框；
 * 这里把「要显示哪些框、还有哪些没填」抽成纯函数，App 与面板共用同一份判断。
 */
describe('键盘输入字段', () => {
  it('按标签顺序生成字段，并带上已填的值', () => {
    expect(keyboardInputFields(['批次号', '操作员'], { 操作员: '张三' })).toEqual([
      { label: '批次号', value: '' },
      { label: '操作员', value: '张三' }
    ])
  })

  it('没有键盘输入源时返回空列表', () => {
    expect(keyboardInputFields([], { 批次号: 'x' })).toEqual([])
  })

  it('空值或纯空白算未填', () => {
    expect(missingKeyboardLabels([
      { label: '批次号', value: '   ' },
      { label: '操作员', value: '张三' },
      { label: '客户', value: '' }
    ])).toEqual(['批次号', '客户'])
  })

  it('全部填好时没有缺项（打印就不再弹窗）', () => {
    expect(missingKeyboardLabels(keyboardInputFields(['批次号'], { 批次号: '20261101' }))).toEqual([])
  })
})
