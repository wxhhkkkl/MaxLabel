import { useState, type MouseEvent } from 'react'

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
const PREVIEW_URL = 'http://down.360code.com/labelshop/LabelShopPreview.zip'

const articles = [
  ['读取RFID芯片TID或EPC信息并转印到纸面', 'RFID读取打印是指通过 RFID 标签打印机读取 RFID 标签的 TID 和 EPC，并将其生成为文本或条码打印到标签表面。', '2025-02-10', 'http://www.360code.com/article/655.htm'],
  ['LabelShop内置免安装驱动打印参数配置', '通过指令集（TSPL/ZPL/CPCL）直连标签打印机，无需安装厂商驱动即可打印。', '2025-02-10', 'http://www.360code.com/article/654.htm'],
  ['LabelShop 打印机 免安装驱动', '免安装驱动即可使用 LabelShop 直接向标签打印机输出。', '2025-02-10', 'http://www.360code.com/article/653.htm'],
  ['PDF文件导入签赋LabelShop编辑打印', '将 PDF 文件导入签赋 LabelShop 后即可继续编辑和打印。', '2025-01-17', 'http://www.360code.com/article/652.htm'],
  ['签赋LabelShop新功能之表格', '了解表格对象在标签模板中的编辑与打印方式。', '2025-01-17', 'http://www.360code.com/article/650.htm'],
  ['学习使用 LabelShop ，从这里开始', '包含 LabelShop 使用教程和在线帮助的网页，快速了解和掌握 LabelShop 的使用方法。', '', LEARN_URL]
] as const

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
      {label}
      <span aria-hidden="true" className="start-section-chevron">{collapsed ? '▸' : '▾'}</span>
    </button>
  )
}

export default function StartPage({ onNew, onOpenDocument, onOpenLocal, onOpenRecent, onLogin, onCloudHome, onOpenUrl, onGetStarted, recentTemplates }: Props) {
  const [startCollapsed, setStartCollapsed] = useState(false)
  const [recentCollapsed, setRecentCollapsed] = useState(false)

  return (
    <div className="start-page" data-testid="start-page">
      <aside className="start-left" data-testid="start-left">
        <section className="start-account" data-testid="start-account">
          <a href="labelshop:UserLogin" title="登录 360Code.com" onClick={commandClick(onLogin)}>
            <img data-testid="start-mascot" src={MASCOT_SRC} alt="签赋吉祥物" />
          </a>
          <a className="start-account-name" href="labelshop:UserLogin" title="登录 360Code.com" onClick={commandClick(onLogin)}>未登录</a>
        </section>

        <div className="start-counts" data-testid="start-counts">
          <a href="labelshop:OpenULogin:http://www.360code.com/member/member_coupon.aspx" title="优惠券" onClick={commandClick(onLogin)}>
            <strong>0</strong><span>优惠券</span>
          </a>
          <a href="labelshop:OpenULogin:http://www.360code.com/member/order_all.aspx" title="待支付订单" onClick={commandClick(onLogin)}>
            <strong>0</strong><span>待支付订单</span>
          </a>
          <a href="labelshop:OpenULogin:http://www.360code.com/member/order_all.aspx" title="待收货订单" onClick={commandClick(onLogin)}>
            <strong>0</strong><span>待收货订单</span>
          </a>
        </div>

        <div className="start-account-actions">
          <a href={'labelshop:OpenULogin:' + SHOP_URL} title="转到云马标签商城" onClick={commandClick(onLogin)}>标签商城</a>
          <a href={'labelshop:OpenULogin:' + LEARN_URL} title="转到 LabelShop 新手入门页面" onClick={commandClick(onGetStarted)}>新手入门</a>
        </div>

        <section className="start-section" data-testid="start-section-start">
          <div className="start-section-heading">
            <SectionToggle label="开始" collapsed={startCollapsed} onToggle={() => setStartCollapsed((value) => !value)} testId="start-section-start-toggle" />
            <a className="start-cloud-home" href="LabelShop:OpenCodingV" title="打开云马通应用首页" onClick={commandClick(onCloudHome)}>云马通首页</a>
          </div>
          {!startCollapsed && (
            <ul className="start-menu-list" data-testid="start-menu-list">
              <li><a href="http://wpa.qq.com/msgrd?v=3&uin=1669809392&site=qq&menu=yes" title="在线客服1，QQ：1669809392">客服1QQ：1669809392</a></li>
              <li><a href="http://wpa.qq.com/msgrd?v=3&uin=3395913685&site=qq&menu=yes" title="在线客服2，QQ：3395913685">客服2QQ：3395913685</a></li>
              <li><a href="#" title="客服电话：4000-987-360">客服电话：4000-987-360</a></li>
              <li><a href="LabelShop:NewDocument" title="新建新的标签格式模板" onClick={commandClick(onNew)}>新建标签模版</a></li>
              <li><a href="LabelShop:OpenDocument" title="打开保存的标签格式模板" onClick={commandClick(onOpenDocument)}>打开标签模版</a></li>
              <li><a href="LabelShop:OpenLocal" title="打开本机上保存的标签格式模板" onClick={commandClick(onOpenLocal)}>打开本机模版</a></li>
              <li><a href={'labelshop:OpenUrl:' + DOWNLOAD_URL} title="下载云马通APP,手机编辑打印标签" onClick={externalClick(onOpenUrl, DOWNLOAD_URL)}><span className="start-orange-link">下载云马通APP</span></a></li>
            </ul>
          )}
        </section>

        <section className="start-section" data-testid="start-section-recent">
          <div className="start-section-heading start-recent-heading">
            <SectionToggle label="最近" collapsed={recentCollapsed} onToggle={() => setRecentCollapsed((value) => !value)} testId="start-section-recent-toggle" />
          </div>
          {!recentCollapsed && (
            recentTemplates.length === 0 ? (
              <div className="start-recent-empty" data-testid="start-recent-empty">暂无最近文件</div>
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
        <div className="start-scroll">
          <section className="start-toplink" data-testid="start-toplink" aria-label="顶部广告位">
            <div className="start-promo-grid">
              <a className="start-promo-notice" href="labelshop:OpenULogin:http://www.360code.com/product/" title="签赋会员服务" onClick={commandClick(onLogin)}>
                <strong>重要通知</strong>
                <span>签赋LabelShop如果无法登录，请及时更新到新版本并升级到金牌会员。</span>
                <span>购买了金牌会员的老用户，请关注会员服务临近到期提醒；到期后将无法登录，请提前续费。</span>
                <em>购买点击</em>
              </a>
              <a className="start-promo-school" href="labelshop:OpenULogin:http://www.360code.com/product/" title="签赋学堂" onClick={commandClick(onLogin)}>
                <b>▱ 签赋学堂</b>
                <strong>免安装Windows驱动<br />打印不干胶标签</strong>
                <span className="start-promo-devices" aria-hidden="true">▰　▱　◈</span>
              </a>
            </div>
            <a className="start-promo-banner" href="labelshop:OpenULogin:http://www.360code.com/product/" title="各类不干胶标签" onClick={commandClick(onLogin)}>
              <div>
                <strong>各类不干胶标签</strong>
                <b>整箱下单 · 更优惠</b>
                <em>联系客服即刻购买 &gt;&gt;&gt;</em>
              </div>
              <div className="start-box-art" aria-hidden="true"><span>不干胶标签纸</span><span>厂家直销</span><i>♻</i></div>
            </a>
          </section>

          <section className="start-articles" data-testid="start-articles">
            <h2>最新文章</h2>
            {articles.map(([title, summary, date, url]) => (
              <article key={title} className="start-article" data-testid="start-article">
                <div className="start-article-heading">
                  <a href={'LabelShop:OpenUrl:' + url} title={url} onClick={externalClick(onOpenUrl, url)}>{title}<span className="start-article-dot">●</span></a>
                  {date && <time>{date}</time>}
                </div>
                <p>{summary}</p>
              </article>
            ))}
          </section>

          <section className="start-download" data-testid="start-download">
            <div className="start-qr-placeholder" aria-label="云马通APP二维码占位"><span>云马通<br />APP</span></div>
            <div>
              <h2>下载云马通APP</h2>
              <p>扫一扫下载云马通APP，在手机上实现标签模板编辑打印功能</p>
              <h3>签赋LabelShop新功能预览版</h3>
              <p>体验图层、表格、PDF打印、图标字符插入、条码尺寸自由调整、RFID TID读取、串口输入打印等诸多新功能！</p>
              <a href={'LabelShop:OpenUrl:' + PREVIEW_URL} onClick={externalClick(onOpenUrl, PREVIEW_URL)}>点击此处下载最新的 签赋LabelShop 6.39.2515 版本安装包</a>
            </div>
          </section>
        </div>
      </main>
    </div>
  )
}
