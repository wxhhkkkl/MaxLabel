import { useI18n } from '../../features/i18n/useI18n'

/** 起始页右栏宣传 banner（产品内置素材，固定文案）。 */
export default function PromoBanner() {
  const { t } = useI18n()
  return (
    <section className="start-banner" data-testid="start-banner">
      <div>
        <h2>{t('start.bannerTitle')}</h2>
        <p>{t('start.bannerSubtitle')}</p>
      </div>
      <div className="start-banner-art" aria-hidden="true">▦</div>
    </section>
  )
}
