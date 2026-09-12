import { useEffect, useState } from 'react'
import Modal from './Modal'

interface LibItem {
  name: string
  path: string
  mtime: number
  size: number
  widthMm?: number
  heightMm?: number
  remark?: string
  thumb?: string
}

interface SharedTemplate {
  id: string
  name: string
  updatedAt: string
  author: string
}

interface Props {
  onClose: () => void
  /** 打开模板库中的模板：返回 JSON 文本 */
  onOpen: (item: LibItem) => void
  /** 把当前模板保存进模板库 */
  onSaveCurrent: () => Promise<{ ok: boolean; message?: string }>
  onMsg: (s: string) => void
  /** 当前模板名称与 JSON（用于发布到共享库） */
  docName?: string
  docJson?: string
  /** 打开由 JSON 提供的共享模板 */
  onOpenJson?: (json: string, name: string) => void
}

function fmtTime(ms: number): string {
  const d = new Date(ms)
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`
}

const tabBtn: React.CSSProperties = {
  padding: '7px 14px',
  borderRadius: 8,
  border: '1px solid #D5D4CD',
  cursor: 'pointer',
  fontSize: 13,
  fontWeight: 600,
  fontFamily: 'inherit'
}

/** 模板库：本机模板目录 + 共享库，可打开、删除、保存与发布。 */
export default function TemplateLibDialog({ onClose, onOpen, onSaveCurrent, onMsg, docName, docJson, onOpenJson }: Props) {
  const [tab, setTab] = useState<'local' | 'shared'>('local')
  const [items, setItems] = useState<LibItem[]>([])
  const [dir, setDir] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [sharedList, setSharedList] = useState<SharedTemplate[]>([])
  const [ctx, setCtx] = useState<{ x: number; y: number; kind: 'local' | 'shared'; item: LibItem | SharedTemplate } | null>(null)

  const refresh = async () => {
    try {
      const r = await window.maxlabel.listTemplates()
      if (!r.ok) {
        setError(r.message ?? '读取模板库失败')
        return
      }
      setDir(r.dir ?? '')
      setItems(r.items ?? [])
      setError('')
    } catch (error) {
      setError('读取模板库失败：' + (error instanceof Error ? error.message : String(error)))
    }
  }

  const refreshShared = async () => {
    try {
      const l = await window.maxlabel.sharedTemplates.list()
      if (l.ok) setSharedList(l.templates)
      else onMsg(l.error ?? '读取共享模板失败')
    } catch (error) {
      onMsg('读取共享模板失败：' + (error instanceof Error ? error.message : String(error)))
    }
  }

  useEffect(() => {
    void refresh()
    void refreshShared()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleDelete = async (item: LibItem) => {
    if (!window.confirm(`确定删除模板「${item.name}」？`)) return
    try {
      const r = await window.maxlabel.deleteTemplate(item.path)
      if (r.ok) {
        onMsg('已删除：' + item.name)
        void refresh()
      } else {
        onMsg('删除失败：' + (r.message ?? ''))
      }
    } catch (error) {
      onMsg('删除失败：' + (error instanceof Error ? error.message : String(error)))
    }
  }

  const handleSaveCurrent = async () => {
    setBusy(true)
    try {
      const r = await onSaveCurrent()
      onMsg(r.ok ? '已保存到模板库' : (r.message ?? '保存失败'))
      void refresh()
    } catch (error) {
      onMsg('保存失败：' + (error instanceof Error ? error.message : String(error)))
    } finally {
      setBusy(false)
    }
  }

  const handleSharedPublish = async () => {
    if (!docName || !docJson) {
      onMsg('无当前模板可发布')
      return
    }
    setBusy(true)
    try {
      const r = await window.maxlabel.sharedTemplates.publish(docName, docJson, '当前用户')
      onMsg(r.ok ? '已发布当前模板到共享库' : (r.error ?? '发布失败'))
      void refreshShared()
    } catch (error) {
      onMsg('发布失败：' + (error instanceof Error ? error.message : String(error)))
    } finally {
      setBusy(false)
    }
  }

  const handleSharedLoad = async (t: SharedTemplate) => {
    try {
      const r = await window.maxlabel.sharedTemplates.load(t.id)
      if (r.ok && r.data) {
        if (onOpenJson) onOpenJson(r.data.json, r.data.name)
        else onMsg(`已加载共享模板：${r.data.name}`)
        setCtx(null)
      } else onMsg(r.error ?? '加载失败')
    } catch (error) {
      onMsg('加载失败：' + (error instanceof Error ? error.message : String(error)))
    }
  }

  const handleSharedDelete = async (t: SharedTemplate) => {
    if (!window.confirm(`确定删除共享模板「${t.name}」？`)) return
    try {
      const r = await window.maxlabel.sharedTemplates.delete(t.id)
      onMsg(r.ok ? '已删除共享模板' : (r.error ?? '删除失败'))
      void refreshShared()
      setCtx(null)
    } catch (error) {
      onMsg('删除失败：' + (error instanceof Error ? error.message : String(error)))
    }
  }

  const openMenu = (e: React.MouseEvent, kind: 'local' | 'shared', item: LibItem | SharedTemplate) => {
    e.preventDefault()
    e.stopPropagation()
    setCtx({ x: e.clientX, y: e.clientY, kind, item })
  }

  const closeMenu = () => setCtx(null)

  return (
    <Modal
      title="模板库"
      onClose={() => { setCtx(null); onClose() }}
      width={680}
      footer={
        tab === 'local' ? (
          <>
            <button type="button" onClick={handleSaveCurrent} disabled={busy} style={{ padding: '7px 16px', borderRadius: 8, border: '1px solid #2E6E93', background: '#2E6E93', color: '#fff', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>
              保存当前模板到模板库
            </button>
            <button type="button" onClick={onClose} style={{ padding: '7px 16px', borderRadius: 8, border: '1px solid #D5D4CD', background: '#fff', cursor: 'pointer', fontSize: 13 }}>
              关闭
            </button>
          </>
        ) : (
          <>
            <button type="button" onClick={handleSharedPublish} disabled={busy} style={{ padding: '7px 16px', borderRadius: 8, border: '1px solid #2E6E93', background: '#2E6E93', color: '#fff', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>
              发布当前模板到共享库
            </button>
            <button type="button" onClick={onClose} style={{ padding: '7px 16px', borderRadius: 8, border: '1px solid #D5D4CD', background: '#fff', cursor: 'pointer', fontSize: 13 }}>
              关闭
            </button>
          </>
        )
      }
    >
      <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
        <button type="button" onClick={() => setTab('local')} style={{ ...tabBtn, background: tab === 'local' ? '#2E6E93' : '#fff', color: tab === 'local' ? '#fff' : '#1A1B1C' }}>
          本机模板库
        </button>
        <button type="button" onClick={() => setTab('shared')} style={{ ...tabBtn, background: tab === 'shared' ? '#2E6E93' : '#fff', color: tab === 'shared' ? '#fff' : '#1A1B1C' }}>
          共享模板库
        </button>
      </div>

      {tab === 'local' && (
        <>
          <div style={{ fontSize: 12, color: '#6B7280', marginBottom: 10 }}>本机模板库（{dir || '…'}）· {items.length} 个模板。双击或右键打开。</div>
          {error && <div style={{ fontSize: 12, color: '#C0392B', marginBottom: 10 }}>{error}</div>}
          {items.length === 0 ? (
            <div style={{ fontSize: 13, color: '#9CA3AF', padding: '28px 0', textAlign: 'center' }}>模板库为空。点击下方按钮保存当前模板。</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 380, overflow: 'auto' }}>
              {items.map((it) => (
                <div
                  key={it.path}
                  onDoubleClick={() => onOpen(it)}
                  onContextMenu={(e) => openMenu(e, 'local', it)}
                  style={{
                    border: '1px solid #E4E3DD',
                    borderRadius: 10,
                    padding: '10px 12px',
                    cursor: 'context-menu',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 10,
                    background: '#fff'
                  }}
                >
                  <div style={{ width: 52, height: 40, background: '#F4F3EE', borderRadius: 6, overflow: 'hidden', flexShrink: 0, border: '1px solid #ECEBE6', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {it.thumb ? <img src={it.thumb} style={{ maxWidth: '100%', maxHeight: '100%', display: 'block' }} /> : null}
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: '#1A1B1C' }}>{it.name}</div>
                    <div style={{ fontSize: 11, color: '#6B7280', marginTop: 2 }}>
                      {it.widthMm && it.heightMm ? `${it.widthMm} × ${it.heightMm} mm` : '尺寸未知'}
                      {it.remark ? ' · ' + it.remark : ''}
                      {' · '}修改于 {fmtTime(it.mtime)}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                    <button type="button" onClick={(e) => { e.stopPropagation(); onOpen(it) }} style={{ fontSize: 12, color: '#2E6E93', background: 'none', border: '1px solid #D5D4CD', borderRadius: 6, padding: '4px 10px', cursor: 'pointer' }}>
                      打开
                    </button>
                    <button type="button" onClick={(e) => { e.stopPropagation(); void handleDelete(it) }} style={{ fontSize: 12, color: '#C0392B', background: 'none', border: '1px solid #D5D4CD', borderRadius: 6, padding: '4px 10px', cursor: 'pointer' }}>
                      删除
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {tab === 'shared' && (
        <>
          <div style={{ fontSize: 12, color: '#6B7280', marginBottom: 10 }}>
            共享模板库 · {sharedList.length} 个共享模板
          </div>
          {sharedList.length === 0 ? (
            <div style={{ fontSize: 13, color: '#9CA3AF', padding: '28px 0', textAlign: 'center' }}>共享模板库为空。点击下方按钮发布当前模板。</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 380, overflow: 'auto' }}>
              {sharedList.map((t) => (
                <div
                  key={t.id}
                  onDoubleClick={() => handleSharedLoad(t)}
                  onContextMenu={(e) => openMenu(e, 'shared', t)}
                  style={{
                    border: '1px solid #E4E3DD',
                    borderRadius: 10,
                    padding: '10px 12px',
                    cursor: 'context-menu',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 10,
                    background: '#fff'
                  }}
                >
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: '#1A1B1C' }}>{t.name}</div>
                    <div style={{ fontSize: 11, color: '#6B7280', marginTop: 2 }}>
                      作者：{t.author} · {new Date(t.updatedAt).toLocaleString()}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                    <button type="button" onClick={(e) => { e.stopPropagation(); void handleSharedLoad(t) }} style={{ fontSize: 12, color: '#2E6E93', background: 'none', border: '1px solid #D5D4CD', borderRadius: 6, padding: '4px 10px', cursor: 'pointer' }}>
                      加载
                    </button>
                    <button type="button" onClick={(e) => { e.stopPropagation(); void handleSharedDelete(t) }} style={{ fontSize: 12, color: '#C0392B', background: 'none', border: '1px solid #D5D4CD', borderRadius: 6, padding: '4px 10px', cursor: 'pointer' }}>
                      删除
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {ctx && (
        <div
          onMouseDown={(e) => { e.stopPropagation() }}
          style={{
            position: 'fixed',
            left: Math.min(ctx.x, window.innerWidth - 200),
            top: Math.min(ctx.y, window.innerHeight - 160),
            zIndex: 500,
            background: '#fff',
            border: '1px solid #D8D6CF',
            borderRadius: 8,
            boxShadow: '0 10px 32px rgba(0,0,0,0.18)',
            padding: 5,
            minWidth: 170
          }}
        >
          {ctx.kind === 'local' ? (
            <>
              <div onClick={() => { onOpen(ctx.item as LibItem); closeMenu() }} style={{ padding: '6px 12px', fontSize: 13, borderRadius: 5, cursor: 'pointer' }}>打开</div>
              <div onClick={() => { void handleDelete(ctx.item as LibItem); closeMenu() }} style={{ padding: '6px 12px', fontSize: 13, borderRadius: 5, cursor: 'pointer', color: '#C0392B' }}>删除</div>
            </>
          ) : (
            <>
              <div onClick={() => { void handleSharedLoad(ctx.item as SharedTemplate); closeMenu() }} style={{ padding: '6px 12px', fontSize: 13, borderRadius: 5, cursor: 'pointer' }}>加载</div>
              <div onClick={() => { void handleSharedDelete(ctx.item as SharedTemplate); closeMenu() }} style={{ padding: '6px 12px', fontSize: 13, borderRadius: 5, cursor: 'pointer', color: '#C0392B' }}>删除</div>
            </>
          )}
        </div>
      )}
    </Modal>
  )
}
