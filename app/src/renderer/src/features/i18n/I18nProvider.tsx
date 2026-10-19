import { createContext, useMemo, type ReactNode } from 'react'
import { translate } from '../../../../shared/i18n/translate'
import type { Language, MessageParams } from '../../../../shared/i18n/types'

export interface I18nValue {
  language: Language
  t: (key: string, params?: MessageParams) => string
}

export const I18nContext = createContext<I18nValue>({
  language: 'zh-CN',
  t: (key, params) => translate('zh-CN', key, params)
})

export function I18nProvider({ language, children }: { language: Language; children: ReactNode }) {
  const value = useMemo<I18nValue>(() => ({
    language,
    t: (key, params) => translate(language, key, params)
  }), [language])
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>
}
