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

import TabStrip from '../editor/TabStrip'

interface Props {
  onNew: () => void
  onOpen: () => void
  onOpenRecent: (item: { name: string; path?: string }) => void
  onLogin: () => void
  onCloudHome: () => void
  onLicense: () => void
  recentTemplates: Array<{ name: string; path?: string }>
  libTemplates: LibItem[]
  onOpenLib: (item: LibItem) => void
  onOpenLibDialog: () => void
  onGetStarted: () => void
  /** 标签页（与编辑页同一位置：左侧栏右侧） */
  tabs: Array<{ key: string; title: string; isStart?: boolean }>
  activeTab: string
  onTabSelect: (k: string) => void
  onTabClose: (k: string) => void
  onTabReorder: (ks: string[]) => void
  onTabNew: () => void
  onTabCloseOthers: (k: string) => void
  onTabCloseAll: () => void
}

function fmtTime(ms: number): string {
  const d = new Date(ms)
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`
}

export default function StartPage({ onNew, onOpen, onOpenRecent, onLogin, onCloudHome, onLicense, recentTemplates, libTemplates, onOpenLib, onOpenLibDialog, onGetStarted, tabs, activeTab, onTabSelect, onTabClose, onTabReorder, onTabNew, onTabCloseOthers, onTabCloseAll }: Props) {
  const leftBtn = {
    display: 'block' as const,
    width: '100%',
    textAlign: 'left' as const,
    padding: '6px 8px',
    borderRadius: 6,
    border: 'none',
    background: 'transparent',
    color: '#1A1B1C',
    cursor: 'pointer',
    fontSize: 13,
    fontFamily: 'inherit' as const
  }
  const section = { fontSize: 12, color: '#6B7280', margin: '14px 8px 6px', fontWeight: 600 }

  return (
    <div style={{ display: 'flex', height: '100%', overflow: 'hidden' }}>
      {/* 左侧导航（对标启动页，宽度与编辑页图层面板一致，保证标签页同一位置） */}
      <div style={{ width: 200, background: '#FAF9F6', borderRight: '1px solid #E4E3DD', padding: '12px 8px', boxSizing: 'border-box', overflow: 'auto' }}>
        <div style={{ fontSize: 20, fontWeight: 700, letterSpacing: 1, color: '#2E6E93', padding: '4px 8px 10px' }}>MaxLabel</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px', background: '#fff', border: '1px solid #E4E3DD', borderRadius: 10, marginBottom: 6 }}>
          <div style={{ width: 36, height: 36, borderRadius: '50%', background: '#DDE6EE', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#5B8FF9', fontSize: 16 }}>☺</div>
          <div>
            <div style={{ fontSize: 13, color: '#1A1B1C', fontWeight: 600 }}>未登录</div>
            <button type="button" onClick={onLogin} style={{ border: 'none', background: 'none', color: '#2E6E93', fontSize: 12, cursor: 'pointer', padding: 0, fontFamily: 'inherit' }}>
              登录 / 注册
            </button>
          </div>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-around', padding: '6px 0', background: '#fff', border: '1px solid #E4E3DD', borderRadius: 10, marginBottom: 6 }}>
          {[
            ['0', '优惠券'],
            ['0', '待支付'],
            ['0', '待收货']
          ].map(([n, t]) => (
            <div key={t} style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 15, fontWeight: 700, color: '#1A1B1C' }}>{n}</div>
              <div style={{ fontSize: 11, color: '#6B7280' }}>{t}</div>
            </div>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          <div style={{ flex: 1, textAlign: 'center', padding: '8px 4px', background: '#fff', border: '1px solid #E4E3DD', borderRadius: 10, cursor: 'pointer', color: '#1A1B1C', fontSize: 12.5 }}>标签商城</div>
          <div onClick={onGetStarted} style={{ flex: 1, textAlign: 'center', padding: '8px 4px', background: '#fff', border: '1px solid #E4E3DD', borderRadius: 10, cursor: 'pointer', color: '#1A1B1C', fontSize: 12.5 }}>新手入门</div>
        </div>

        <div style={section}>开始</div>
        <button type="button" onClick={onNew} style={{ ...leftBtn, background: '#E4EFF7', color: '#2E6E93', fontWeight: 600 }}>
          ＋ 新建标签模版
        </button>
        <button type="button" onClick={onOpen} style={leftBtn}>
          📂 打开标签模版
        </button>
        <button type="button" onClick={onOpen} style={leftBtn}>
          💾 打开本机模版
        </button>
        <button type="button" onClick={onCloudHome} style={leftBtn}>
          ☁ 云服务 / 云端模板
        </button>
        <button type="button" onClick={onLicense} style={leftBtn}>
          🔑 授权激活
        </button>

        <div style={section}>客服</div>
        <div style={{ padding: '0 8px', fontSize: 12, color: '#6B7280', lineHeight: 1.8 }}>
          <div>客服1 QQ: 4000-987-360</div>
          <div>客服电话: 4000-987-360</div>
          <div>（示例联系方式）</div>
        </div>

        <div style={section}>最近</div>
        {recentTemplates.length === 0 && <div style={{ padding: '0 8px', fontSize: 12, color: '#B0AFA9' }}>暂无最近模板</div>}
        {recentTemplates.map((t, i) => (
          <button key={i} type="button" onClick={() => onOpenRecent(t)} style={{ ...leftBtn, fontSize: 12.5 }}>
            {t.name}
          </button>
        ))}
      </div>

      {/* 主区域：标签页 + 内容（标签页与编辑页同一位置，左侧导航右侧起） */}
      <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minWidth: 0, background: 'var(--app-page-bg, #F4F3EE)' }}>
        <TabStrip tabs={tabs} active={activeTab} onSelect={onTabSelect} onClose={onTabClose} onReorder={onTabReorder} onNew={onTabNew} onCloseOthers={onTabCloseOthers} onCloseAll={onTabCloseAll} />
        <div style={{ flex: 1, padding: 24, overflow: 'auto' }}>
        <div style={{ fontSize: 22, fontWeight: 700, color: '#1A1B1C', marginBottom: 4 }}>欢迎使用 MaxLabel</div>
        <div style={{ fontSize: 13, color: '#6B7280', marginBottom: 20 }}>专业版 · 条码标签设计打印软件（对标签赋 LabelShop）</div>

        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 24 }}>
          {[
            { t: '新建标签模版', d: '选择标签格式，开始设计', c: 'linear-gradient(135deg,#2E6E93,#3E8FB8)', act: onNew },
            { t: '打开标签模版', d: '打开本机已保存的模板', c: 'linear-gradient(135deg,#5B8FF9,#7aa5ff)', act: onOpen },
            { t: '云端模板', d: '登录云服务，云端保存/分享', c: 'linear-gradient(135deg,#6BC1A4,#8fd8be)', act: onCloudHome }
          ].map((card) => (
            <div
              key={card.t}
              onClick={card.act}
              style={{
                flex: '1 1 200px',
                minWidth: 190,
                background: card.c,
                color: '#fff',
                borderRadius: 14,
                padding: '18px 18px',
                cursor: 'pointer',
                boxShadow: '0 4px 14px rgba(0,0,0,0.10)'
              }}
            >
              <div style={{ fontSize: 15, fontWeight: 600 }}>{card.t}</div>
              <div style={{ fontSize: 12, marginTop: 6, opacity: 0.92 }}>{card.d}</div>
            </div>
          ))}
        </div>

        {/* 模板库区 */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: '#1A1B1C' }}>模板库</div>
          <button
            type="button"
            onClick={onOpenLibDialog}
            style={{ fontSize: 12, color: '#2E6E93', background: 'none', border: 'none', cursor: 'pointer', padding: '4px 6px', fontFamily: 'inherit' }}
          >
            打开模板库(L) ›
          </button>
        </div>
        {libTemplates.length === 0 ? (
          <div style={{ fontSize: 13, color: '#9CA3AF', padding: '14px 0', marginBottom: 18 }}>本机模板库为空。设计模板后保存到模板库，即可在此快速打开。</div>
        ) : (
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 18 }}>
            {libTemplates.map((it) => (
              <div
                key={it.path}
                onClick={() => onOpenLib(it)}
                title="点击打开"
                style={{
                  flex: '1 1 200px',
                  minWidth: 190,
                  maxWidth: 260,
                  background: '#fff',
                  border: '1px solid #E4E3DD',
                  borderRadius: 12,
                  padding: '12px 14px',
                  cursor: 'pointer',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.05)',
                  boxSizing: 'border-box'
                }}
              >
                <div style={{ height: 86, background: 'var(--app-page-bg, #F4F3EE)', borderRadius: 8, marginBottom: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', border: '1px solid #ECEBE6' }}>
                  {it.thumb ? (
                    <img src={it.thumb} alt={it.name} style={{ maxWidth: '100%', maxHeight: '100%', display: 'block' }} />
                  ) : (
                    <div style={{ fontSize: 11, color: '#B9BEC6' }}>无预览</div>
                  )}
                </div>
                <div style={{ fontSize: 13.5, fontWeight: 600, color: '#1A1B1C', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{it.name}</div>
                <div style={{ fontSize: 12, color: '#6B7280', marginTop: 4 }}>
                  {it.widthMm && it.heightMm ? `${it.widthMm} × ${it.heightMm} mm` : '尺寸未知'}
                </div>
                <div style={{ fontSize: 11, color: '#9AA0A6', marginTop: 3 }}>修改于 {fmtTime(it.mtime)}</div>
              </div>
            ))}
          </div>
        )}

        {/* 最近模板卡片 */}
        <div style={{ fontSize: 14, fontWeight: 600, color: '#1A1B1C', marginBottom: 10 }}>最近打开</div>
        {recentTemplates.length === 0 ? (
          <div style={{ fontSize: 13, color: '#9CA3AF', padding: '12px 0', marginBottom: 14 }}>暂无最近打开的模板</div>
        ) : (
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 14 }}>
            {recentTemplates.slice(0, 6).map((t, i) => (
              <div
                key={i}
                onClick={() => onOpenRecent(t)}
                title={t.path || t.name}
                style={{
                  flex: '1 1 180px',
                  minWidth: 170,
                  maxWidth: 240,
                  background: '#fff',
                  border: '1px solid #E4E3DD',
                  borderRadius: 12,
                  padding: '12px 14px',
                  cursor: 'pointer',
                  boxSizing: 'border-box'
                }}
              >
                <div style={{ fontSize: 13, fontWeight: 600, color: '#1A1B1C', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.name}</div>
                <div style={{ fontSize: 11, color: '#9AA0A6', marginTop: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.path || '本机文件'}</div>
              </div>
            ))}
          </div>
        )}

        <div style={{ fontSize: 14, fontWeight: 600, color: '#1A1B1C', marginBottom: 10 }}>最新文章</div>
        {[
          ['读取 RFID 芯片 TID 或 EPC 信息并转印到纸面', 'RFID 读取打印是指通过 RFID 标签打印机读取 RFID 标签的 TID 和 EPC，并将其生成为文本或条码打印到标签表面。', '2025-02-10'],
          ['LabelShop 内置免安装驱动打印参数配置', '通过指令集（TSPL/ZPL/CPCL）直连标签打印机，无需安装厂商驱动即可打印。', '2025-02-10'],
          ['三套指令集适配市面上大多数标签打印机', '未收录品牌先试 TSPL/ZPL/CPCL，配合分辨率与打印机属性矩阵完成适配。', '2026-09-01']
        ].map(([t, d, date], i) => (
          <div key={i} style={{ background: '#fff', border: '1px solid #E4E3DD', borderRadius: 10, padding: '12px 14px', marginBottom: 8 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ fontSize: 13.5, fontWeight: 600, color: '#1A1B1C' }}>{t}</div>
              <div style={{ fontSize: 11, color: '#9AA0A6' }}>{date}</div>
            </div>
            <div style={{ fontSize: 12, color: '#6B7280', marginTop: 4, lineHeight: 1.6 }}>{d}</div>
          </div>
        ))}
      </div>
      </div>
    </div>
  )
}
