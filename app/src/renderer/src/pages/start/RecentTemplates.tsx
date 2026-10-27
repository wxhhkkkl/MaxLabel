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
        <ul className="start-recent-grid" data-testid="start-recent-list">
          {items.map((item, index) => (
            <li key={`${item.path ?? item.name}-${index}`}>
              <button
                type="button"
                className="start-recent-card"
                data-testid="start-recent-item"
                data-has-path={item.path ? 'true' : 'false'}
                title={item.path ?? t('start.recentLocate')}
                onClick={() => onOpen(item)}
              >
                <span className="start-recent-icon" aria-hidden="true">
                  <svg viewBox="0 0 24 24" width="28" height="28">
                    <path d="M6 2h8l4 4v16H6z" fill="#EAF3FB" stroke="#2E6E93" strokeWidth="1.4" strokeLinejoin="round" />
                    <path d="M14 2v5h5" fill="none" stroke="#2E6E93" strokeWidth="1.4" strokeLinejoin="round" />
                    <path d="M9 12h6M9 15h6M9 18h4" stroke="#9DC3E0" strokeWidth="1.2" strokeLinecap="round" />
                  </svg>
                </span>
                <span className="start-recent-name">{item.name}</span>
                <span className="start-recent-path">{item.path || t('start.recentLocate')}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
