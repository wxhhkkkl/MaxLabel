import { useI18n } from '../../features/i18n/useI18n'
import type { EntitlementState } from '../../../../shared/domain/entitlement'
import type { MallMember } from '../../../../shared/ipcContract'
import { profileFields } from './profile'

interface Props {
  member: MallMember | null
  entitlement: EntitlementState
  onLogin: () => void
  onBuy: () => void
  onMall: () => void
  onRefreshSubscription: () => void
  refreshingSubscription: boolean
}

const button = (primary = false) => ({
  padding: '6px 10px',
  border: primary ? '1px solid #2E6E93' : '1px solid #D5D4CD',
  borderRadius: 6,
  background: primary ? '#2E6E93' : '#fff',
  color: primary ? '#fff' : '#1A1B1C',
  fontSize: 12.5,
  fontFamily: 'inherit',
  cursor: 'pointer'
}) as const

function formatDate(value: string): string {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

/** 起始页左栏：头像、手机号、公司名称、会员版本、有效期、购买与商城入口。 */
export default function ProfileCard({ member, entitlement, onLogin, onBuy, onMall, onRefreshSubscription, refreshingSubscription }: Props) {
  const { t } = useI18n()
  const profile = profileFields(member, entitlement)
  const expiry = (() => {
    if (!profile.loggedIn) {
      return entitlement.source.includes('dongle') ? t('start.active') : t('start.unsubscribed')
    }
    if (profile.subscriptionActive) {
      return profile.expiresAt ? t('start.validUntil', { date: formatDate(profile.expiresAt) }) : t('start.active')
    }
    return profile.expiresAt ? `${t('start.expired')} · ${formatDate(profile.expiresAt)}` : t('start.unsubscribed')
  })()

  return (
    <section className="start-profile-card" data-testid="start-profile">
      <div className="start-profile-avatar" data-testid="start-avatar">
        {profile.avatarUrl
          ? <img src={profile.avatarUrl} alt={t('start.loggedOut')} />
          : <span aria-hidden="true">👤</span>}
      </div>
      <div className="start-profile-name" data-testid="start-mobile">
        {profile.loggedIn ? profile.mobile : t('start.loggedOut')}
      </div>
      <div className="start-profile-edition" data-testid="start-edition">{profile.editionLabel}</div>
      {profile.enterpriseSource && (
        <div className="start-profile-source" data-testid="start-enterprise-source">{profile.enterpriseSource}</div>
      )}
      <div className="start-profile-expiry-row">
        <div className="start-profile-expiry" data-testid="start-expiry">{expiry}</div>
        {profile.loggedIn && (
          <button
            type="button"
            className={`start-refresh-button${refreshingSubscription ? ' is-refreshing' : ''}`}
            data-testid="start-refresh-subscription"
            title={t('start.refreshSubscription')}
            aria-label={t('start.refreshSubscription')}
            disabled={refreshingSubscription}
            onClick={onRefreshSubscription}
          >
            <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true">
              <path d="M20 11a8 8 0 1 0-2.34 5.66" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              <path d="M20 4v7h-7" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        )}
      </div>
      <div className="start-profile-actions">
        {!profile.loggedIn && (
          <button type="button" style={button(true)} data-testid="start-login" onClick={onLogin}>
            {t('start.login')}
          </button>
        )}
        <button type="button" style={button(!profile.loggedIn)} data-testid="start-buy" onClick={onBuy}>
          {t('start.purchase')}
        </button>
        <button type="button" style={button()} data-testid="start-mall" onClick={onMall}>
          {t('start.mall')}
        </button>
      </div>
    </section>
  )
}
