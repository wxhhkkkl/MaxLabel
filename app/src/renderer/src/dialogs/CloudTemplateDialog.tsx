import { useCallback, useEffect, useState } from 'react'
import type { LabelDoc } from '../types'
import type { MallTemplateMetadata } from '../../../shared/ipcContract'
import { toMsdx } from '../io/msdx'
import Modal from './Modal'
import type { AppOptions } from './OptionsDialog'
import { useI18n } from '../features/i18n/useI18n'
import { localizePropertyLabel } from '../../../shared/i18n/property.en-US'

interface Props {
  doc: LabelDoc
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

function shareText(status: number | null | undefined): string {
  if (status === null || status === undefined) return '未共享'
  return ({ 0: '待审核', 1: '已公开', 2: '已驳回', 3: '已下架' } as Record<number, string>)[status] ?? '未知'
}

export default function CloudTemplateDialog({ doc, options, onClose, onLoad }: Props) {
  const { language } = useI18n()
  const L = (text: string) => localizePropertyLabel(text, language)
  const context = { baseUrl: options.mallBaseUrl, tenantId: options.mallTenantId }
  const [items, setItems] = useState<MallTemplateMetadata[]>([])
  const [name, setName] = useState(doc.name || '未命名模板')
  const [category, setCategory] = useState('')
  const [keywords, setKeywords] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')

  const refresh = useCallback(async () => {
    setBusy(true)
    try {
      const result = await window.maxlabel.mall.templates.list(context)
      if (result.ok) setItems(result.items ?? [])
      else setMessage(result.error || L('读取云端模板失败'))
    } finally {
      setBusy(false)
    }
  }, [context.baseUrl, context.tenantId])

  useEffect(() => { void refresh() }, [refresh])

  const upload = async () => {
    setBusy(true)
    setMessage('')
    try {
      const existing = items.find((item) => item.name === name.trim())
      const overwrite = existing && window.confirm(`云端已有同名模板「${name.trim()}」，是否覆盖？`)
      const result = await window.maxlabel.mall.templates.save(context, {
        ...(overwrite && existing ? { id: existing.id } : {}),
        name: name.trim(),
        content: toMsdx(doc),
        widthMm: doc.widthMm,
        heightMm: doc.heightMm,
        category: category.trim(),
        keywords: keywords.trim()
      })
      if (!result.ok) setMessage(result.error || L('上传失败'))
      else await refresh()
    } finally {
      setBusy(false)
    }
  }

  const load = async (id: number) => {
    setBusy(true)
    try {
      const result = await window.maxlabel.mall.templates.load(context, id)
      if (result.ok && result.item) onLoad(result.item.content)
      else setMessage(result.error || L('下载失败'))
    } finally {
      setBusy(false)
    }
  }

  const remove = async (id: number) => {
    if (!window.confirm('确认删除该云端模板？本地文件不受影响。')) return
    setBusy(true)
    try {
      const result = await window.maxlabel.mall.templates.delete(context, id)
      if (!result.ok) setMessage(result.error || L('删除失败'))
      else await refresh()
    } finally {
      setBusy(false)
    }
  }

  const share = async (id: number) => {
    setBusy(true)
    try {
      const result = await window.maxlabel.mall.templates.submitShare(context, id, category.trim(), keywords.trim())
      if (!result.ok) setMessage(result.error || L('提交共享失败'))
      else await refresh()
    } finally {
      setBusy(false)
    }
  }

  const unshare = async (id: number) => {
    setBusy(true)
    try {
      const result = await window.maxlabel.mall.templates.cancelShare(context, id)
      if (!result.ok) setMessage(result.error || L('取消共享失败'))
      else await refresh()
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal title="云标签模板库" onClose={onClose} width={720}>
      <div data-testid="cloud-template-dialog" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {!options.mallBaseUrl && <div style={{ color: '#B3261E' }}>{L('请先在「系统设置 → 商城地址」配置商城地址。')}</div>}
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <input data-testid="cloud-template-name" value={name} maxLength={255} onChange={(e) => setName(e.target.value)} style={{ ...input, width: 220 }} placeholder="模板名称" />
          <input value={category} maxLength={64} onChange={(e) => setCategory(e.target.value)} style={{ ...input, width: 120 }} placeholder="分类（选填）" />
          <input value={keywords} maxLength={255} onChange={(e) => setKeywords(e.target.value)} style={{ ...input, width: 160 }} placeholder="关键词（选填）" />
          <button type="button" data-testid="cloud-template-upload" style={button(true)} disabled={busy || !options.mallBaseUrl} onClick={() => void upload()}>{L('上传当前模板')}</button>
        </div>
        {message && <div style={{ color: '#B3261E' }}>{message}</div>}
        <div style={{ maxHeight: 360, overflow: 'auto', border: '1px solid #E4E3DD', borderRadius: 8 }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ background: '#F7F8FA', textAlign: 'left' }}>
                <th style={{ padding: 8 }}>{L('名称')}</th>
                <th style={{ padding: 8 }}>{L('大小')}</th>
                <th style={{ padding: 8 }}>{L('共享')}</th>
                <th style={{ padding: 8 }}>{L('操作')}</th>
              </tr>
            </thead>
            <tbody>
              {items.length === 0 && <tr><td colSpan={4} style={{ padding: 16, color: '#6B7280' }}>{L('暂无云端模板')}</td></tr>}
              {items.map((item) => (
                <tr key={item.id} style={{ borderTop: '1px solid #F0F0F0' }}>
                  <td style={{ padding: 8 }}>{item.name}</td>
                  <td style={{ padding: 8 }}>{Math.ceil(item.sizeBytes / 1024)} KB</td>
                  <td style={{ padding: 8 }}>{shareText(item.shareStatus)}</td>
                  <td style={{ padding: 8, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    <button type="button" style={button()} disabled={busy} onClick={() => void load(item.id)}>{L('下载')}</button>
                    <button type="button" style={button()} disabled={busy} onClick={() => void share(item.id)}>{L('提交共享')}</button>
                    {item.shareStatus !== null && item.shareStatus !== undefined && (
                      <button type="button" style={button()} disabled={busy} onClick={() => void unshare(item.id)}>{L('取消共享')}</button>
                    )}
                    <button type="button" style={button()} disabled={busy} onClick={() => void remove(item.id)}>{L('删除')}</button>
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
