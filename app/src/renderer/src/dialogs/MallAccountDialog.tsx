import { useCallback, useEffect, useState } from 'react'
import type { MallMember, MallPlan } from '../../../shared/ipcContract'
import Modal from './Modal'
import type { AppOptions } from './OptionsDialog'
import { useI18n } from '../features/i18n/useI18n'
import { localizePropertyLabel } from '../../../shared/i18n/property.en-US'

interface Props {
  options: AppOptions
  onClose: () => void
  onMember?: (member: MallMember | null) => void
}

const EDITION_LABELS: Record<string, string> = {
  standard: '标准版',
  professional: '专业版',
  enterprise: '企业版'
}

const button = (primary = false): React.CSSProperties => ({
  padding: '7px 14px',
  borderRadius: 6,
  border: primary ? '1px solid #2E6E93' : '1px solid #D5D4CD',
  background: primary ? '#2E6E93' : '#fff',
  color: primary ? '#fff' : '#1A1B1C',
  cursor: 'pointer',
  fontSize: 13,
  fontFamily: 'inherit'
})

function statusText(member: MallMember | null): string {
  if (!member) return '未登录'
  if (member.subscriptionActive) {
    return `有效，到期 ${member.subscriptionEndDate ?? '—'}（剩余 ${member.remainingDays ?? 0} 天）`
  }
  if (member.subscriptionEndDate) return `已过期（${member.subscriptionEndDate}）`
  return '未订阅'
}

export default function MallAccountDialog({ options, onClose, onMember }: Props) {
  const { language } = useI18n()
  const L = (text: string) => localizePropertyLabel(text, language)
  const context = { baseUrl: options.mallBaseUrl, tenantId: options.mallTenantId }
  const [member, setMember] = useState<MallMember | null>(null)
  const [plans, setPlans] = useState<MallPlan[]>([])
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')

  const updateMember = useCallback((next: MallMember | null) => {
    setMember(next)
    onMember?.(next)
  }, [onMember])

  const refresh = useCallback(async () => {
    setBusy(true)
    setMessage('')
    try {
      const result = await window.maxlabel.mall.session(context)
      if (result.ok) updateMember(result.member ?? null)
      else setMessage(result.error || L('读取会员状态失败'))
    } finally {
      setBusy(false)
    }
  }, [context.baseUrl, context.tenantId, updateMember])

  useEffect(() => { void refresh() }, [refresh])
  useEffect(() => {
    let live = true
    void window.maxlabel.mall.plans(context)
      .then((result) => { if (live && result.ok) setPlans((result.plans ?? []).filter((plan) => plan.edition)) })
      .catch(() => { /* 套餐列表失败不影响会员状态展示。 */ })
    return () => { live = false }
  }, [context.baseUrl, context.tenantId])
  // 从商城窗口返回桌面端（窗口重新获得焦点）时重新读取订阅，购买/续费后无需重开对话框。
  useEffect(() => {
    const onFocus = () => { void refresh() }
    window.addEventListener('focus', onFocus)
    return () => window.removeEventListener('focus', onFocus)
  }, [refresh])

  const login = async () => {
    setBusy(true)
    setMessage('')
    try {
      const result = await window.maxlabel.mall.login(context)
      if (result.ok && result.member) updateMember(result.member)
      else setMessage(result.error || L('登录失败'))
    } catch (error) {
      setMessage(String((error as { message?: string }).message ?? error))
    } finally {
      setBusy(false)
    }
  }

  const logout = async () => {
    setBusy(true)
    setMessage('')
    try {
      const result = await window.maxlabel.mall.logout(context)
      if (result.ok) updateMember(null)
      else setMessage(result.error || L('退出失败'))
    } finally {
      setBusy(false)
    }
  }

  const buy = async () => {
    const result = await window.maxlabel.mall.open(context, '/membership')
    if (!result.ok) setMessage(result.error || L('无法打开商城'))
  }

  return (
    <Modal title="会员中心" onClose={onClose} width={520}>
      <div data-testid="mall-account" style={{ display: 'flex', flexDirection: 'column', gap: 14, fontSize: 13, color: '#1A1B1C' }}>
        {!options.mallBaseUrl && (
          <div style={{ padding: '8px 10px', background: '#FFF8E1', borderRadius: 6, color: '#7A5B00' }}>
            {L('尚未配置商城地址，请先在「系统设置 → 商城地址」填写。')}
          </div>
        )}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 12px', background: '#F7F8FA', borderRadius: 8 }}>
          <div data-testid="mall-account-identity">
            <div style={{ fontWeight: 600 }}>{member ? (member.nickname || member.mobileMasked || '已登录会员') : '未登录'}</div>
            <div style={{ marginTop: 4, color: member?.subscriptionActive ? '#2E7D32' : '#6B7280' }} data-testid="mall-subscription-status">
              {statusText(member)}
            </div>
          </div>
          <button type="button" style={button()} disabled={busy} onClick={() => void refresh()}>{L('刷新')}</button>
        </div>
        {message && <div data-testid="mall-account-message" style={{ color: '#B3261E' }}>{message}</div>}
        {plans.length > 0 && (
          <div data-testid="mall-plans" style={{ display: 'grid', gap: 6 }}>
            <div style={{ fontWeight: 600, fontSize: 12.5 }}>{L('版本套餐')}</div>
            {plans.map((plan) => (
              <div key={plan.skuId} style={{ display: 'flex', justifyContent: 'space-between', gap: 10, padding: '7px 10px', background: '#F7F8FA', borderRadius: 6 }}>
                <span>{plan.name} · {EDITION_LABELS[plan.edition ?? ''] ?? plan.edition} · {plan.periodMonths} 个月</span>
                <span style={{ color: '#2E6E93' }}>{plan.price}</span>
              </div>
            ))}
          </div>
        )}
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          {!member && <button type="button" data-testid="mall-login" style={button(true)} disabled={busy || !options.mallBaseUrl} onClick={() => void login()}>{L('登录商城会员')}</button>}
          {member && <>
            <button type="button" data-testid="mall-buy" style={button(true)} disabled={busy} onClick={() => void buy()}>{L('购买/续费会员')}</button>
            <button type="button" data-testid="mall-logout" style={button()} disabled={busy} onClick={() => void logout()}>{L('退出登录')}</button>
          </>}
        </div>
      </div>
    </Modal>
  )
}
