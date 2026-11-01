/**
 * 打印面板「输入数据」的键盘输入字段（020）。
 *
 * 键盘输入的数据源原先只在打印时用弹窗收集；现在面板里也直接给输入框，
 * 两处共用这里的「要显示什么、还缺什么」判断，避免一边认为已填、另一边又弹窗。
 */
export interface KeyboardInputField {
  label: string
  value: string
}

/** 按标签顺序生成字段（顺序即 keyboardOrder 排好的顺序）。 */
export function keyboardInputFields(labels: string[], values: Record<string, string>): KeyboardInputField[] {
  return labels.map((label) => ({ label, value: values[label] ?? '' }))
}

/** 还没填的标签；纯空白算未填。全部填好时返回空数组。 */
export function missingKeyboardLabels(fields: KeyboardInputField[]): string[] {
  return fields.filter((field) => !field.value.trim()).map((field) => field.label)
}
