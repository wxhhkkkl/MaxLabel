import { useI18n } from '../i18n/useI18n'

export const SHARE_PAGE_SIZE = 200

export function hasNextSharePage(page: number, itemCount: number, total?: number): boolean {
  if (typeof total === 'number' && Number.isFinite(total) && total > 0) return page * SHARE_PAGE_SIZE < total
  return itemCount >= SHARE_PAGE_SIZE
}

export default function SpacePagination({ page, hasNext, busy, onPage }: {
  page: number
  hasNext: boolean
  busy: boolean
  onPage: (page: number) => void
}) {
  const { t } = useI18n()
  if (page === 1 && !hasNext) return null
  return (
    <nav className="share-pagination" aria-label={t('start.spacePages')}>
      <button type="button" className="start-link-button" data-testid="space-page-prev" disabled={busy || page <= 1} onClick={() => onPage(page - 1)}>
        {t('start.spacePreviousPage')}
      </button>
      <span aria-live="polite">{t('start.spacePage', { page })}</span>
      <button type="button" className="start-link-button" data-testid="space-page-next" disabled={busy || !hasNext} onClick={() => onPage(page + 1)}>
        {t('start.spaceNextPage')}
      </button>
    </nav>
  )
}
