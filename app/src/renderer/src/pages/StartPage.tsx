import { useState } from 'react'
import type { EntitlementState } from '../../../shared/domain/entitlement'
import type { MallMember } from '../../../shared/ipcContract'
import type { AppOptions } from '../dialogs/OptionsDialog'
import { useI18n } from '../features/i18n/useI18n'
import ProfileCard from './start/ProfileCard'
import PromoBanner from './start/PromoBanner'
import RecentTemplates, { type RecentTemplateView } from './start/RecentTemplates'
import StartSpacePanel, { type StartSpace } from './start/StartSpacePanel'

export interface LibItem {
  name: string
  path: string
  mtime: number
  size: number
  widthMm?: number
  heightMm?: number
  remark?: string
  thumb?: string
}

interface Props {
  options: AppOptions
  member: MallMember | null
  entitlement: EntitlementState
  recentTemplates: RecentTemplateView[]
  onLogin: () => void
  onBuy: () => void
  onMall: () => void
  onNew: () => void
  onOpen: () => void
  onRefreshSubscription: () => void
  refreshingSubscription: boolean
  onOpenRecent: (item: RecentTemplateView) => void
  onLoadTemplate: (content: string) => void
}

type StartView = 'recent' | StartSpace

type NavIconKind = 'plus' | 'folder' | 'clock' | 'platform' | 'personal' | 'enterprise'

function NavIcon({ kind }: { kind: NavIconKind }) {
  const common = {
    width: 18,
    height: 18,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.8,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    'aria-hidden': true
  }
  switch (kind) {
    case 'plus':
      return <svg {...common}><path d="M12 5v14M5 12h14" /></svg>
    case 'folder':
      return <svg {...common}><path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /></svg>
    case 'clock':
      return <svg {...common}><circle cx="12" cy="12" r="8.5" /><path d="M12 7.5V12l3 2" /></svg>
    case 'platform':
      return <svg {...common}><path d="M7 18h10a4 4 0 0 0 .8-7.9A5.5 5.5 0 0 0 7.1 9 4.5 4.5 0 0 0 7 18z" /></svg>
    case 'personal':
      return <svg {...common}><circle cx="12" cy="8" r="3.2" /><path d="M5 20a7 7 0 0 1 14 0" /></svg>
    case 'enterprise':
      return <svg {...common}><path d="M4 21V5a1 1 0 0 1 1-1h9a1 1 0 0 1 1 1v16" /><path d="M15 9h4a1 1 0 0 1 1 1v11" /><path d="M8 8h3M8 12h3M8 16h3M18 13h1M18 17h1" /></svg>
  }
}

/** 起始页：左侧按钮导航 + 会员信息，右侧按选中项显示最近文件或共享空间。 */
export default function StartPage({
  options,
  member,
  entitlement,
  recentTemplates,
  onLogin,
  onBuy,
  onMall,
  onNew,
  onOpen,
  onRefreshSubscription,
  refreshingSubscription,
  onOpenRecent,
  onLoadTemplate
}: Props) {
  const { t } = useI18n()
  // SC-007：记录渲染进程从加载到起始页首次渲染的时间，供 e2e/quickstart 验证。
  const [firstRenderMs] = useState(() => Math.round(performance.now()))
  /** 默认选中「最近使用」。 */
  const [view, setView] = useState<StartView>('recent')

  const navItem = (key: StartView, label: string, testId: string, icon: NavIconKind) => (
    <button
      key={key}
      type="button"
      className="start-nav-button start-nav-ghost"
      data-testid={testId}
      data-active={view === key ? 'true' : 'false'}
      onClick={() => setView(key)}
    >
      <span className="start-nav-icon"><NavIcon kind={icon} /></span>
      <span>{label}</span>
    </button>
  )

  return (
    <div className="start-page" data-testid="start-page" data-render-ms={firstRenderMs}>
      <aside className="start-profile" data-testid="start-profile-column">
        <nav className="start-nav" data-testid="start-nav">
          <button type="button" className="start-nav-button start-nav-primary" data-testid="start-nav-new" onClick={onNew}>
            <span className="start-nav-icon"><NavIcon kind="plus" /></span>
            <span>{t('start.new')}</span>
          </button>
          <button type="button" className="start-nav-button start-nav-outline" data-testid="start-nav-open" onClick={onOpen}>
            <span className="start-nav-icon"><NavIcon kind="folder" /></span>
            <span>{t('start.open')}</span>
          </button>
          {navItem('recent', t('start.recent'), 'start-nav-recent', 'clock')}
          {navItem('personal', t('start.personalSpace'), 'start-nav-personal', 'personal')}
          {navItem('enterprise', t('start.enterpriseSpace'), 'start-nav-enterprise', 'enterprise')}
          {navItem('platform', t('start.platformSpace'), 'start-nav-platform', 'platform')}
        </nav>
        <ProfileCard
          member={member}
          entitlement={entitlement}
          onLogin={onLogin}
          onBuy={onBuy}
          onMall={onMall}
          onRefreshSubscription={onRefreshSubscription}
          refreshingSubscription={refreshingSubscription}
        />
      </aside>
      <main className="start-main" data-testid="start-main">
        <PromoBanner />
        {view === 'recent'
          ? <RecentTemplates items={recentTemplates} onOpen={onOpenRecent} />
          : (
            <StartSpacePanel
              options={options}
              member={member}
              space={view}
              onLoad={onLoadTemplate}
              onLogin={onLogin}
            />
          )}
      </main>
    </div>
  )
}
