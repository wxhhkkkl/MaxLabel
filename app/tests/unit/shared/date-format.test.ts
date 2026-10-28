import { describe, expect, it } from 'vitest'
import { formatDateLike } from '@shared/domain/datasource'

// 2026-10-28 是星期三
const d = new Date(2026, 9, 28, 15, 4, 5)

/** 原版「日期格式」下拉里的每一档，显示的就是按当前日期格式化后的样子。 */
describe('日期格式', () => {
  it('中文月名 / 星期 / 第几天 / 周数', () => {
    expect(formatDateLike('yyyy年MM月dd日', d)).toBe('2026年10月28日')
    expect(formatDateLike('MMMM', d)).toBe('十月')
    expect(formatDateLike('MMM', d)).toBe('10月')
    expect(formatDateLike('dddd', d)).toBe('星期三')
    expect(formatDateLike('ddd', d)).toBe('周三')
    expect(formatDateLike('DDD', d)).toBe('301')
    expect(formatDateLike('ww', d)).toBe('44')
    expect(formatDateLike('e', d)).toBe('3')
    expect(formatDateLike('E', d)).toBe('3')
  })

  it('年月日的各种数字写法', () => {
    expect(formatDateLike('yyyy-MM-dd', d)).toBe('2026-10-28')
    expect(formatDateLike('MM-dd-yy', d)).toBe('10-28-26')
    expect(formatDateLike('yyMMdd', d)).toBe('261028')
    expect(formatDateLike('yyMM00', d)).toBe('261000')
    expect(formatDateLike('dd.MM.yyyy', d)).toBe('28.10.2026')
  })

  it('时间 token 不受影响', () => {
    expect(formatDateLike('HH:mm:ss', d)).toBe('15:04:05')
    expect(formatDateLike('hh:mm tt', d)).toBe('03:04 下午')
  })

  it('单字符的分钟/秒可以取 1-2 位', () => {
    const t = new Date(2026, 9, 28, 9, 4, 5)
    expect(formatDateLike('mm:ss', t)).toBe('04:05')
    expect(formatDateLike('m:s', t)).toBe('4:5')
    expect(formatDateLike('H:m:s', t)).toBe('9:4:5')
  })

  it('未知 token 原样保留', () => {
    expect(formatDateLike('yyyy!!', d)).toBe('2026!!')
  })
})
