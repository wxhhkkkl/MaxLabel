import { useI18n } from '../../features/i18n/useI18n'

export interface RecentTemplateView {
  name: string
  path?: string
}

interface Props {
  items: RecentTemplateView[]
  onOpen: (item: RecentTemplateView) => void
}

/** 起始页右栏：最近打开的模板（沿用本机最近文件记录，最多 10 条）。 */
export default function RecentTemplates({ items, onOpen }: Props) {
  const { t } = useI18n()
  return (
    <section className="start-recent" data-testid="start-recent">
      <h3>{t('start.recent')}</h3>
      {items.length === 0 ? (
        <div className="start-empty" data-testid="start-recent-empty">{t('start.recentEmpty')}</div>
      ) : (
        <ul className="start-recent-list" data-testid="start-recent-list">
          {items.map((item, index) => (
            <li key={`${item.path ?? item.name}-${index}`}>
              <button type="button" title={item.path ?? item.name} onClick={() => onOpen(item)}>
                {item.name}
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
