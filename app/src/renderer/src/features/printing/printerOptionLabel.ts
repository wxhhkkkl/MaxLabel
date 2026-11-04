import type { MessageParams } from '../../../../shared/i18n/types'

export interface PrinterOptionLike {
  name: string
  displayName?: string
  isDefault?: boolean
}

/**
 * 打印机下拉里空取值那项（「跟随系统默认打印」）的文案。
 *
 * 不能直接写成打印机名：模板未指定打印机时生效值就是系统默认队列，
 * 空取值项与真实队列项会显示成两行一模一样的名字（015/020 现场反馈）。
 */
export function systemDefaultOptionLabel(
  printers: readonly PrinterOptionLike[],
  t: (key: string, params?: MessageParams) => string
): string {
  const fallback = printers.find((item) => item.isDefault)
  const name = (fallback?.displayName || fallback?.name || '').trim()
  return name ? t('print.systemDefaultWithName', { name }) : t('print.systemDefault')
}
