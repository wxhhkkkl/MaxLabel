/**
 * 关闭未保存文档时的确认约定（帮助 menu_file.html「退出」）。
 *
 * 原版在关闭/退出前对脏文档弹出系统确认框，按钮依次为
 * 「保存 / 不保存 / 取消」，默认按钮是「保存」，Esc 与标题栏关闭按钮等价于「取消」。
 * 这里把按钮次序与响应码到动作的映射收敛成共享规则，主进程对话框与判定共用一套，
 * 避免两边各写一份而漂移。
 */

export type CloseChoice = 'save' | 'discard' | 'cancel'

/** 确认框按钮次序（原版为「保存」「不保存」「取消」）。 */
import { translate } from '../i18n/translate'
import type { Language } from '../i18n/types'

export const CLOSE_CONFIRM_BUTTONS = ['保存', '不保存', '取消'] as const

/** Localized button labels in the same order as CLOSE_CONFIRM_BUTTONS. */
export function closeConfirmButtons(language: Language = 'zh-CN'): string[] {
  return language === 'en-US'
    ? [translate(language, 'dialog.close.save'), translate(language, 'dialog.close.dontSave'), translate(language, 'common.cancel')]
    : [...CLOSE_CONFIRM_BUTTONS]
}

/** 默认按钮 = 保存。 */
export const CLOSE_CONFIRM_DEFAULT_ID = 0

/** 取消按钮 = 取消；Esc 与标题栏关闭等价于此项。 */
export const CLOSE_CONFIRM_CANCEL_ID = 2

/** 确认框标题与正文（原版口径）。 */
export function closeConfirmText(name: string, language: Language = 'zh-CN'): { title: string; message: string; detail: string } {
  if (language === 'en-US') {
    return {
      title: translate(language, 'dialog.close.title'),
      message: translate(language, 'dialog.close.message', { name: name || translate(language, 'common.untitledLabel') }),
      detail: translate(language, 'dialog.close.detail')
    }
  }
  return {
    title: '标签尚未保存',
    message: `是否保存对“${name || '未命名标签'}”所做的更改？`,
    detail: '选择“不保存”将丢弃本次编辑。'
  }
}

/** 系统确认框的按钮响应码 → 动作。未知响应一律按「取消」处理，绝不误丢用户编辑。 */
export function resolveCloseChoice(response: number): CloseChoice {
  if (response === 0) return 'save'
  if (response === 1) return 'discard'
  return 'cancel'
}

/** 「取消」必须终止退出流程；其余两种允许继续关闭。 */
export function shouldProceedClose(choice: CloseChoice): boolean {
  return choice !== 'cancel'
}
