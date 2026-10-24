import { useI18n } from '../i18n/useI18n'

interface Props {
  onLogin: () => void
  onRenew: () => void
  onDongle: () => void
}

/** 只读状态条：解释原因，并提供登录、续费、加密狗入口。 */
export default function ReadOnlyNotice({ onLogin, onRenew, onDongle }: Props) {
  const { t } = useI18n()
  const button = {
    padding: '3px 10px',
    border: '1px solid #D5D4CD',
    borderRadius: 6,
    background: '#fff',
    color: '#1A1B1C',
    fontSize: 12,
    fontFamily: 'inherit',
    cursor: 'pointer'
  } as const
  return (
    <div
      data-testid="read-only-notice"
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 12,
        padding: '5px 10px',
        borderBottom: '1px solid #F0D6A8',
        background: '#FFF8E6',
        color: '#7A5200',
        fontSize: 12.5
      }}
    >
      <span>🔒 {t('entitlement.readOnly')}</span>
      <span style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
        <button type="button" style={button} onClick={onLogin}>{t('entitlement.login')}</button>
        <button type="button" style={button} onClick={onRenew}>{t('entitlement.renew')}</button>
        <button type="button" style={button} onClick={onDongle}>{t('entitlement.insertDongle')}</button>
      </span>
    </div>
  )
}
