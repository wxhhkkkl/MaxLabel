import { useState } from 'react'
import type { EntitlementState } from '../../../shared/domain/entitlement'
import type { MallMember } from '../../../shared/ipcContract'
import type { AppOptions } from '../dialogs/OptionsDialog'
import ProfileCard from './start/ProfileCard'
import PromoBanner from './start/PromoBanner'
import RecentTemplates, { type RecentTemplateView } from './start/RecentTemplates'
import CloudTemplates from './start/CloudTemplates'

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
  onRefreshSubscription: () => void
  refreshingSubscription: boolean
  onOpenRecent: (item: RecentTemplateView) => void
  onLoadTemplate: (content: string) => void
}

/** 起始页：左栏会员面板，右栏 banner / 最近模板 / 云模板。 */
export default function StartPage({
  options,
  member,
  entitlement,
  recentTemplates,
  onLogin,
  onBuy,
  onMall,
  onRefreshSubscription,
  refreshingSubscription,
  onOpenRecent,
  onLoadTemplate
}: Props) {
  // SC-007：记录渲染进程从加载到起始页首次渲染的时间，供 e2e/quickstart 验证。
  const [firstRenderMs] = useState(() => Math.round(performance.now()))
  return (
    <div className="start-page" data-testid="start-page" data-render-ms={firstRenderMs}>
      <aside className="start-profile" data-testid="start-profile-column">
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
        <RecentTemplates items={recentTemplates} onOpen={onOpenRecent} />
        <CloudTemplates options={options} member={member} onLoad={onLoadTemplate} onLogin={onLogin} />
      </main>
    </div>
  )
}
