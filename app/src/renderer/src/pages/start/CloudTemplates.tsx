import { useCallback, useEffect, useMemo, useState } from 'react'
import { useI18n } from '../../features/i18n/useI18n'
import type { MallMember } from '../../../../shared/ipcContract'
import type { AppOptions } from '../../dialogs/OptionsDialog'
import { cloudScope, cloudSectionState, cloudThumb } from './profile'

interface Item {
  id: number
  name: string
  widthMm?: number
  heightMm?: number
  category?: string
  publisherNickname?: string
  /** 商城后端生成的 SVG 示意图。 */
  thumb?: string
}

interface Props {
  options: AppOptions
  member: MallMember | null
  onLoad: (content: string) => void
  onLogin: () => void
}

/** 起始页右栏：未登录看公共云模板库，登录后看账号的“云模板”。 */
export default function CloudTemplates({ options, member, onLoad, onLogin }: Props) {
  const { t } = useI18n()
  const scope = cloudScope(member)
  const context = useMemo(
    () => ({ baseUrl: options.mallBaseUrl, tenantId: options.mallTenantId }),
    [options.mallBaseUrl, options.mallTenantId]
  )
  const [items, setItems] = useState<Item[]>([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  /** 未登录点击需登录的模板后，登录成功再续开。 */
  const [pending, setPending] = useState<{ item: Item; scope: 'mine' | 'public' } | null>(null)

  const loadList = useCallback(async () => {
    setBusy(true)
    setError('')
    try {
      const result = scope === 'mine'
        ? await window.maxlabel.mall.templates.list(context)
        : await window.maxlabel.mall.shared.list(context)
      if (!result.ok) {
        setItems([])
        setError(result.error || t('start.cloudError'))
        return
      }
      const source = (result.items ?? []) as Array<Item & { publisherNickname?: string }>
      setItems(source.map((item) => {
        const thumb = cloudThumb(item.thumb)
        return {
          id: Number(item.id),
          name: String(item.name ?? ''),
          ...(typeof item.widthMm === 'number' ? { widthMm: item.widthMm } : {}),
          ...(typeof item.heightMm === 'number' ? { heightMm: item.heightMm } : {}),
          ...(item.category ? { category: item.category } : {}),
          ...(item.publisherNickname ? { publisherNickname: item.publisherNickname } : {}),
          ...(thumb ? { thumb } : {})
        }
      }))
    } catch (reason) {
      setItems([])
      setError((reason as { message?: string })?.message || t('start.cloudError'))
    } finally {
      setBusy(false)
    }
  }, [context, scope, t])

  useEffect(() => { void loadList() }, [loadList])

  const openItem = useCallback(async (item: Item, sourceScope: 'mine' | 'public') => {
    setBusy(true)
    setError('')
    try {
      const result = sourceScope === 'mine'
        ? await window.maxlabel.mall.templates.load(context, item.id)
        : await window.maxlabel.mall.shared.load(context, item.id)
      if (result.ok && result.item?.content) {
        onLoad(result.item.content)
        return
      }
      if (!member && sourceScope === 'public') {
        setPending({ item, scope: sourceScope })
        onLogin()
        return
      }
      setError(result.error || t('start.cloudError'))
    } catch (reason) {
      if (!member && sourceScope === 'public') {
        setPending({ item, scope: sourceScope })
        onLogin()
        return
      }
      setError((reason as { message?: string })?.message || t('start.cloudError'))
    } finally {
      setBusy(false)
    }
  }, [context, member, onLoad, onLogin, t])

  useEffect(() => {
    if (!member || !pending) return
    const next = pending
    setPending(null)
    void openItem(next.item, next.scope)
  }, [member, pending, openItem])

  const open = (item: Item) => { void openItem(item, scope) }

  const section = cloudSectionState(busy, error, items.length)

  return (
    <section className="start-cloud" data-testid="start-cloud" data-scope={scope}>
      <div className="start-cloud-heading">
        <h3>{scope === 'mine' ? t('start.cloudMine') : t('start.cloudPublic')}</h3>
        <button type="button" className="start-link-button" onClick={() => void loadList()} disabled={busy}>
          {t('start.cloudRetry')}
        </button>
      </div>
      {section === 'loading' && <div className="start-empty" data-testid="start-cloud-loading">{t('start.cloudLoading')}</div>}
      {section === 'error' && (
        <div className="start-empty" data-testid="start-cloud-error">
          <div>{t('start.cloudError')}</div>
          <div className="start-cloud-error-actions">
            {!member && <button type="button" className="start-link-button" onClick={onLogin}>{t('entitlement.login')}</button>}
            <button type="button" className="start-link-button" onClick={() => void loadList()}>{t('start.cloudRetry')}</button>
          </div>
        </div>
      )}
      {section === 'empty' && (
        <div className="start-empty" data-testid="start-cloud-empty">
          {scope === 'mine' ? t('start.cloudMineEmpty') : t('start.cloudEmpty')}
        </div>
      )}
      {section === 'list' && (
        <ul className="start-cloud-list" data-testid="start-cloud-list">
          {items.map((item) => (
            <li key={item.id}>
              <button type="button" className="start-cloud-card" data-testid="start-cloud-item" onClick={() => void open(item)}>
                <span className="start-cloud-thumb">
                  {item.thumb
                    ? <img src={item.thumb} alt={item.name} loading="lazy" />
                    : <span className="start-cloud-thumb-empty" aria-hidden="true" />}
                </span>
                <span className="start-cloud-info">
                  <span className="start-cloud-name">{item.name}</span>
                  {typeof item.widthMm === 'number' && typeof item.heightMm === 'number' && (
                    <span className="start-cloud-meta">{item.widthMm} × {item.heightMm} mm</span>
                  )}
                  {item.category && <span className="start-cloud-meta">{item.category}</span>}
                  {item.publisherNickname && <span className="start-cloud-meta">{item.publisherNickname}</span>}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
