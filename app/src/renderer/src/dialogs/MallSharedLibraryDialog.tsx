import { useCallback, useEffect, useState } from 'react'
import type { MallSharedTemplate } from '../../../shared/ipcContract'
import Modal from './Modal'
import type { AppOptions } from './OptionsDialog'
import { useI18n } from '../features/i18n/useI18n'
import { localizePropertyLabel } from '../../../shared/i18n/property.en-US'

interface Props {
  options: AppOptions
  onClose: () => void
  onLoad: (json: string) => void
}

const button = (primary = false): React.CSSProperties => ({
  padding: '6px 12px',
  borderRadius: 6,
  border: primary ? '1px solid #2E6E93' : '1px solid #D5D4CD',
  background: primary ? '#2E6E93' : '#fff',
  color: primary ? '#fff' : '#1A1B1C',
  cursor: 'pointer',
  fontSize: 12.5,
  fontFamily: 'inherit'
})

const input: React.CSSProperties = {
  padding: '6px 8px',
  border: '1px solid #D5D4CD',
  borderRadius: 6,
  fontSize: 13,
  fontFamily: 'inherit'
}

const thumbStyle: React.CSSProperties = {
  width: 64,
  height: 44,
  objectFit: 'contain',
  border: '1px solid #E8E7E2',
  borderRadius: 4,
  background: '#fff'
}

export default function MallSharedLibraryDialog({ options, onClose, onLoad }: Props) {
  const { language } = useI18n()
  const L = (text: string) => localizePropertyLabel(text, language)
  const context = { baseUrl: options.mallBaseUrl, tenantId: options.mallTenantId }
  const [items, setItems] = useState<MallSharedTemplate[]>([])
  const [keyword, setKeyword] = useState('')
  const [category, setCategory] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')

  const refresh = useCallback(async () => {
    setBusy(true)
    setMessage('')
    try {
      const result = await window.maxlabel.mall.shared.list(context, keyword.trim(), category.trim())
      if (result.ok) setItems(result.items ?? [])
      else setMessage(result.error || L('读取共享模板失败'))
    } finally {
      setBusy(false)
    }
  }, [context.baseUrl, context.tenantId, keyword, category])

  useEffect(() => { void refresh() }, [refresh])

  const load = async (id: number) => {
    setBusy(true)
    try {
      const result = await window.maxlabel.mall.shared.load(context, id)
      if (result.ok && result.item) onLoad(result.item.content)
      else setMessage(result.error || L('下载共享模板失败'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal title="平台共享模板库" onClose={onClose} width={720}>
      <div data-testid="mall-shared-library" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {!options.mallBaseUrl && <div style={{ color: '#B3261E' }}>{L('请先在「系统设置 → 商城地址」配置商城地址。')}</div>}
        <div style={{ display: 'flex', gap: 8 }}>
          <input value={keyword} maxLength={255} onChange={(e) => setKeyword(e.target.value)} style={{ ...input, width: 220 }} placeholder="名称/关键词" />
          <input value={category} maxLength={64} onChange={(e) => setCategory(e.target.value)} style={{ ...input, width: 140 }} placeholder="分类" />
          <button type="button" style={button(true)} disabled={busy} onClick={() => void refresh()}>{L('搜索')}</button>
        </div>
        {message && <div style={{ color: '#B3261E' }}>{message}</div>}
        <div style={{ maxHeight: 380, overflow: 'auto', border: '1px solid #E4E3DD', borderRadius: 8 }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ background: '#F7F8FA', textAlign: 'left' }}>
                <th style={{ padding: 8 }}>{L('示意图')}</th>
                <th style={{ padding: 8 }}>{L('名称')}</th>
                <th style={{ padding: 8 }}>{L('尺寸')}</th>
                <th style={{ padding: 8 }}>{L('分类')}</th>
                <th style={{ padding: 8 }}>{L('发布者')}</th>
                <th style={{ padding: 8 }}>{L('操作')}</th>
              </tr>
            </thead>
            <tbody>
              {items.length === 0 && <tr><td colSpan={6} style={{ padding: 16, color: '#6B7280' }}>{L('暂无共享模板')}</td></tr>}
              {items.map((item) => (
                <tr key={item.id} style={{ borderTop: '1px solid #F0F0F0' }}>
                  <td style={{ padding: 8 }}>{item.thumb ? <img src={item.thumb} alt={item.name} style={thumbStyle} /> : '—'}</td>
                  <td style={{ padding: 8 }}>{item.name}</td>
                  <td style={{ padding: 8 }}>{item.widthMm} × {item.heightMm} mm</td>
                  <td style={{ padding: 8 }}>{item.category || '—'}</td>
                  <td style={{ padding: 8 }}>{item.publisherNickname || '匿名会员'}</td>
                  <td style={{ padding: 8 }}>
                    <button type="button" style={button()} disabled={busy} onClick={() => void load(item.id)}>{L('下载使用')}</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </Modal>
  )
}
