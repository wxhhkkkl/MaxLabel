import { useState, type MouseEvent } from 'react'
import { useI18n } from '../features/i18n/useI18n'
import { localizePropertyLabel } from '../../../shared/i18n/property.en-US'
import LText from '../features/i18n/LText'
import type { MallMember } from '../../../shared/ipcContract'
import { FIXED_MALL_ENTRY_URL } from '../dialogs/OptionsDialog'

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

interface RecentItem {
  name: string
  path?: string
}

interface Props {
  onNew: () => void
  onOpenDocument: () => void
  onOpenLocal: () => void
  onOpenRecent: (item: RecentItem) => void
  onLogin: () => void
  onCloudHome: () => void
  onOpenUrl: (url: string) => void
  onGetStarted: () => void
  recentTemplates: RecentItem[]
  mallMember?: MallMember | null
  /** 启动时的登录态检查是否已完成；false 时显示"正在检查"而不是登录提示。 */
  mallSessionChecked?: boolean
}

export type StartView = 'checking' | 'login' | 'mall'

export function startView(checked: boolean, member: MallMember | null | undefined): StartView {
  if (!checked) return 'checking'
  return member ? 'mall' : 'login'
}

const MASCOT_SRC = 'data:image/svg+xml,' + encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96">' +
  '<rect width="96" height="96" rx="48" fill="#fff"/>' +
  '<path d="M26 67c-3-13 2-31 12-39 6-5 13-6 19-2 5 3 9 8 11 15 8 3 12 9 10 16-2 7-7 11-14 12l-5 9H42l-4-8c-5 1-9 0-12-3Z" fill="#fff" stroke="#5c6068" stroke-width="2.2" stroke-linejoin="round"/>' +
  '<path d="M37 27c-3-7-1-13 4-17 2 6 6 10 12 12M30 34c-7-3-11-7-12-13 7 0 13 3 18 8M66 30c8-3 14-1 18 4-6 3-11 7-14 13" fill="#fff" stroke="#5c6068" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>' +
  '<path d="M46 51c2-4 7-5 10-1 2 3 1 8-3 10-4 2-8-1-7-5Z" fill="#fff" stroke="#5c6068" stroke-width="2"/>' +
  '<circle cx="42" cy="42" r="3" fill="#30343a"/><circle cx="63" cy="42" r="3" fill="#30343a"/>' +
  '<circle cx="41" cy="41" r="1" fill="#fff"/><circle cx="62" cy="41" r="1" fill="#fff"/>' +
  '<path d="M48 64c5 3 10 3 15 0M50 72c3 2 8 2 11 0" fill="none" stroke="#5c6068" stroke-width="2" stroke-linecap="round"/>' +
  '</svg>'
)

const SHOP_URL = 'http://www.360code.com/product/'
const LEARN_URL = 'http://www.360code.com/about/software.aspx?sign=learnlabelshop'
const DOWNLOAD_URL = 'http://www.codingv.com/c/app_downloadpc'


function commandClick(callback: () => void) {
  return (event: MouseEvent<HTMLAnchorElement>) => {
    event.preventDefault()
    callback()
  }
}

function externalClick(callback: (url: string) => void, url: string) {
  return (event: MouseEvent<HTMLAnchorElement>) => {
    event.preventDefault()
    callback(url)
  }
}

function SectionToggle({ label, collapsed, onToggle, testId }: { label: string; collapsed: boolean; onToggle: () => void; testId: string }) {
  return (
    <button
      type="button"
      className={'start-section-toggle' + (collapsed ? ' hidecontent' : '')}
      data-testid={testId}
      aria-expanded={!collapsed}
      onClick={onToggle}
    >
      <LText text={label}/>
      <span aria-hidden="true" className="start-section-chevron">{collapsed ? '▸' : '▾'}</span>
    </button>
  )
}

export default function StartPage({ onNew, onOpenDocument, onOpenLocal, onOpenRecent, onLogin, onCloudHome, onOpenUrl, onGetStarted, recentTemplates, mallMember, mallSessionChecked = true }: Props) {
  const { language } = useI18n()
  const L = (text: string) => localizePropertyLabel(text, language)
  const [startCollapsed, setStartCollapsed] = useState(false)
  const view = startView(mallSessionChecked ?? true, mallMember)
  const [recentCollapsed, setRecentCollapsed] = useState(false)

  return (
    <div className="start-page" data-testid="start-page">
      <aside className="start-left" data-testid="start-left">
        <section className="start-account" data-testid="start-account">
          <a href="labelshop:UserLogin" title={L('登录 MaxLabel 商城会员')} onClick={commandClick(onLogin)}>
            <img data-testid="start-mascot" src={MASCOT_SRC} alt={L('签赋吉祥物')} />
          </a>
          <a className="start-account-name" href="labelshop:UserLogin" title={L('登录 MaxLabel 商城会员')} onClick={commandClick(onLogin)} data-testid="start-account-name">
            {mallMember ? (mallMember.nickname || mallMember.mobileMasked) : <LText text="未登录"/>}
          </a>
          {mallMember && (
            <div data-testid="start-subscription" style={{ fontSize: 11, color: mallMember.subscriptionActive ? '#2E7D32' : '#9AA0A6' }}>
              {mallMember.subscriptionActive ? `会员有效${mallMember.subscriptionEndDate ? ` · ${mallMember.subscriptionEndDate}` : ''}` : (mallMember.subscriptionEndDate ? `已过期 · ${mallMember.subscriptionEndDate}` : '未订阅')}
            </div>
          )}
        </section>

        <div className="start-counts" data-testid="start-counts">
          <a href="labelshop:OpenULogin:http://www.360code.com/member/member_coupon.aspx" title={L('优惠券')} onClick={commandClick(onLogin)}>
            <strong>0</strong><span><LText text="优惠券"/></span>
          </a>
          <a href="labelshop:OpenULogin:http://www.360code.com/member/order_all.aspx" title={L('待支付订单')} onClick={commandClick(onLogin)}>
            <strong>0</strong><span><LText text="待支付订单"/></span>
          </a>
          <a href="labelshop:OpenULogin:http://www.360code.com/member/order_all.aspx" title={L('待收货订单')} onClick={commandClick(onLogin)}>
            <strong>0</strong><span><LText text="待收货订单"/></span>
          </a>
        </div>

        <div className="start-account-actions">
          <a href={'labelshop:OpenULogin:' + SHOP_URL} title={L('打开 MaxLabel 商城')} onClick={commandClick(onCloudHome)}><LText text="标签商城"/></a>
          <a href={'labelshop:OpenULogin:' + LEARN_URL} title={L('转到 LabelShop 新手入门页面')} onClick={commandClick(onGetStarted)}><LText text="新手入门"/></a>
        </div>

        <section className="start-section" data-testid="start-section-start">
          <div className="start-section-heading">
            <SectionToggle label="开始" collapsed={startCollapsed} onToggle={() => setStartCollapsed((value) => !value)} testId="start-section-start-toggle" />
            <a className="start-cloud-home" href="LabelShop:OpenCodingV" title={L('打开云马通应用首页')} onClick={commandClick(onCloudHome)}><LText text="云马通首页"/></a>
          </div>
          {!startCollapsed && (
            <ul className="start-menu-list" data-testid="start-menu-list">
              <li><a href="http://wpa.qq.com/msgrd?v=3&uin=1669809392&site=qq&menu=yes" title={L('在线客服1，QQ：1669809392')}><LText text="客服1QQ：1669809392"/></a></li>
              <li><a href="http://wpa.qq.com/msgrd?v=3&uin=3395913685&site=qq&menu=yes" title={L('在线客服2，QQ：3395913685')}><LText text="客服2QQ：3395913685"/></a></li>
              <li><a href="#" title={L('客服电话：4000-987-360')}><LText text="客服电话：4000-987-360"/></a></li>
              <li><a href="LabelShop:NewDocument" title={L('新建新的标签格式模板')} onClick={commandClick(onNew)}><LText text="新建标签模版"/></a></li>
              <li><a href="LabelShop:OpenDocument" title={L('打开保存的标签格式模板')} onClick={commandClick(onOpenDocument)}><LText text="打开标签模版"/></a></li>
              <li><a href="LabelShop:OpenLocal" title={L('打开本机上保存的标签格式模板')} onClick={commandClick(onOpenLocal)}><LText text="打开本机模版"/></a></li>
              <li><a href={'labelshop:OpenUrl:' + DOWNLOAD_URL} title={L('下载云马通APP,手机编辑打印标签')} onClick={externalClick(onOpenUrl, DOWNLOAD_URL)}><span className="start-orange-link"><LText text="下载云马通APP"/></span></a></li>
            </ul>
          )}
        </section>

        <section className="start-section" data-testid="start-section-recent">
          <div className="start-section-heading start-recent-heading">
            <SectionToggle label="最近" collapsed={recentCollapsed} onToggle={() => setRecentCollapsed((value) => !value)} testId="start-section-recent-toggle" />
          </div>
          {!recentCollapsed && (
            recentTemplates.length === 0 ? (
              <div className="start-recent-empty" data-testid="start-recent-empty"><LText text="暂无最近文件"/></div>
            ) : (
              <ul className="start-menu-list" data-testid="start-recent-list">
                {recentTemplates.map((item, index) => {
                  const href = item.path ? 'LabelShop:OpenDocument:' + item.path : 'LabelShop:OpenDocument'
                  return <li key={(item.path ?? item.name) + '-' + index}><a href={href} title={item.path ?? item.name} onClick={commandClick(() => onOpenRecent(item))}>{item.name}</a></li>
                })}
              </ul>
            )
          )}
        </section>
      </aside>

      <main className="start-main">
        {view === 'checking' && (
          <div className="start-login-state" data-testid="start-checking">
            <p>{L('正在检查登录状态…')}</p>
          </div>
        )}
        {view === 'login' && (
          <div className="start-login-state" data-testid="start-login-prompt">
            <h2>{L('请先登录 MaxLabel 商城会员')}</h2>
            <p>{L('登录后可直接在右侧使用商城、购买会员授权和云端模板。')}</p>
            <button type="button" className="start-login-action" onClick={onLogin}>
              {L('立即登录')}
            </button>
          </div>
        )}
        {view === 'mall' && (
          <iframe
            className="start-mall-frame"
            data-testid="start-mall-frame"
            title={L('MaxLabel 商城')}
            src={FIXED_MALL_ENTRY_URL}
          />
        )}
      </main>
    </div>
  )
}
