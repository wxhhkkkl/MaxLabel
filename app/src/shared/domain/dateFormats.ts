/**
 * 原版「日期格式 / 时间格式」下拉的选项表。
 *
 * 顺序就是原版下拉的顺序，**不能重排**：lsdx 的 `<variable type="date" datatimetype="N">`
 * 里 N 就是这个表的 0 基下标（实测 `datatimetype="3"` 对应日期 02-11-26、`"30"` 对应 26/11/02，
 * 正好是下面的 dd-MM-yy / yy/MM/dd）。导入时按它还原格式。
 */
export interface FormatOption {
  value: string
  label: string
}

export const DATE_FORMATS: FormatOption[] = [
  { value: 'yyyy年MM月dd日', label: '' },
  { value: 'yyyy-MM-dd', label: '年-月-日' },
  { value: 'MM-dd-yy', label: '月-日-年' },
  { value: 'dd-MM-yy', label: '日-月-年' },
  { value: 'MMMM dd, yyyy', label: '' },
  { value: 'dddd, dd MMMM, yyyy', label: '' },
  { value: 'dd MMMM, yyyy', label: '' },
  { value: 'dd-MMM-yy', label: '' },
  { value: 'MMMM, yy', label: '' },
  { value: 'MMM, yy', label: '' },
  { value: 'DDD', label: '一年中的第几天' },
  { value: 'yyMMdd', label: '年 月 日' },
  { value: 'yyMM00', label: '年 月 00' },
  { value: 'MM', label: '月：2 位数字' },
  { value: 'M', label: '月：1-2 位数字' },
  { value: 'MMMM', label: '月' },
  { value: 'MMM', label: '月：缩写' },
  { value: 'dd', label: '天：2 位数字' },
  { value: 'd', label: '天：1-2 位数字' },
  { value: 'y', label: '年：1 位数字' },
  { value: 'yy', label: '年：2 位数字' },
  { value: 'yyy', label: '年：1-2 位数字' },
  { value: 'yyyy', label: '年：3 位数字' },
  { value: 'YYYY', label: '年：4 位数字' },
  { value: 'e', label: '周中第几天:周日是 0' },
  { value: 'ww', label: '年周数:2位数字' },
  { value: 'w', label: '年周数:1-2位数字' },
  { value: 'dddd', label: '' },
  { value: 'dd.MM.yy', label: '日.月.两位年' },
  { value: 'yy-MM-dd', label: '年-月-日' },
  { value: 'yy/MM/dd', label: '年/月/日' },
  { value: 'dd.MM.yyyy', label: '日 月 四位年' },
  { value: 'MM/dd/yy', label: '月/日/年' },
  { value: 'dd/MM/yy', label: '日/月/年' },
  { value: 'WW', label: '周数:一周始于周一' },
  { value: 'E', label: '周中第几天:周日是7' },
  { value: 'ddd', label: '' }
]

export const TIME_FORMATS: FormatOption[] = [
  { value: 'HH:mm:ss', label: '24 小时制' },
  { value: 'hh:mm', label: '12 小时制' },
  { value: 'hh:mm:ss', label: '12 小时制' },
  { value: 'hh:mm:ss tt', label: '12 小时制' },
  { value: 'HH:mm tt', label: '24 小时制' },
  { value: 'HH:mm', label: '24 小时制' },
  { value: 'hh:mm tt', label: '12 小时制' },
  { value: 'HH:mm:ss tt', label: '24 小时制' },
  { value: 'hh', label: '12 小时制:2 位数字' },
  { value: 'h', label: '12 小时制:1-2 位数字' },
  { value: 'HH', label: '24 小时制:2 位数字' },
  { value: 'H', label: '24 小时制:1-2 位数字' },
  { value: 'mm', label: '分钟:2 位数字' },
  { value: 'm', label: '分钟:1-2 位数字' },
  { value: 'ss', label: '秒:2 位数字' },
  { value: 's', label: '秒:1-2 位数字' },
  { value: 'tt', label: '上午 / 下午' }
]
