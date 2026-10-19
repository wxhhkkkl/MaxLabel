import type { Language } from '../../../../shared/i18n/types'

function locale(language: Language): string {
  return language === 'en-US' ? 'en-US' : 'zh-CN'
}

/** Display-only date/time formatting; stored values and print output stay unchanged. */
export function formatDateTime(
  value: string | number | Date | undefined,
  language: Language,
  options: Intl.DateTimeFormatOptions = { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' }
): string {
  if (value === undefined || value === '') return ''
  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return new Intl.DateTimeFormat(locale(language), options).format(date)
}

/** Display-only number formatting; callers must format before interpolation. */
export function formatNumber(value: number, language: Language, options?: Intl.NumberFormatOptions): string {
  return new Intl.NumberFormat(locale(language), options).format(value)
}
