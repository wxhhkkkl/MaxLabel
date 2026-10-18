/** A-44 退出/关闭未保存文档的确认约定（帮助 menu_file.html）。 */
import {
  CLOSE_CONFIRM_BUTTONS,
  CLOSE_CONFIRM_CANCEL_ID,
  CLOSE_CONFIRM_DEFAULT_ID,
  closeConfirmText,
  resolveCloseChoice,
  shouldProceedClose
} from '../src/shared/domain/closeGuard'

let passed = 0
const failures: string[] = []
function check(name: string, condition: boolean): void {
  if (condition) { passed += 1; console.log('  ✓ ' + name) } else { failures.push(name); console.log('  ✗ ' + name) }
}

// 按钮次序与默认/取消按钮：原版为「保存」「不保存」「取消」，默认「保存」，Esc/关窗等价「取消」。
check('确认框三个按钮依次为 保存 / 不保存 / 取消', JSON.stringify(CLOSE_CONFIRM_BUTTONS) === JSON.stringify(['保存', '不保存', '取消']))
check('默认按钮是「保存」（响应码 0）', CLOSE_CONFIRM_DEFAULT_ID === 0)
check('取消按钮是「取消」（响应码 2）', CLOSE_CONFIRM_CANCEL_ID === 2)

const text = closeConfirmText('标签模板1')
check('确认框标题为「标签尚未保存」', text.title === '标签尚未保存')
check('确认框正文含文档名并询问是否保存更改', text.message === '是否保存对“标签模板1”所做的更改？')
check('确认框提示「不保存」将丢弃编辑', text.detail === '选择“不保存”将丢弃本次编辑。')
check('未命名文档回退为「未命名标签」', closeConfirmText('').message.includes('未命名标签'))

// 三个分支的动作映射。
check('响应 0 → 保存', resolveCloseChoice(0) === 'save')
check('响应 1 → 不保存', resolveCloseChoice(1) === 'discard')
check('响应 2 → 取消', resolveCloseChoice(2) === 'cancel')
check('未知响应码一律按「取消」处理（不误丢编辑）', resolveCloseChoice(7) === 'cancel' && resolveCloseChoice(-1) === 'cancel')

// 「取消」必须终止退出流程。
check('取消终止关闭流程', shouldProceedClose('cancel') === false)
check('保存后允许关闭', shouldProceedClose('save') === true)
check('不保存后允许关闭', shouldProceedClose('discard') === true)

console.log(`\n${passed} close guard checks passed`)
if (failures.length) {
  console.error(`${failures.length} failed:\n - ${failures.join('\n - ')}`)
  process.exit(1)
}
