import { useEffect, useState } from 'react'
import Modal from './Modal'

interface Props {
  onClose: () => void
}

interface LogRow {
  time: string
  title: string
  mode: string
  count: number
  copies: number
  physicalCount?: number
  sentCount?: number
  status?: 'completed' | 'submitted' | 'partial' | 'failed' | 'canceled' | 'unknown'
  test: boolean
  printer: string
}

const thStyle: React.CSSProperties = { fontSize: 12, color: '#4B5563', textAlign: 'left', padding: '7px 10px', borderBottom: '1px solid #E4E3DD', whiteSpace: 'nowrap' }
const tdStyle: React.CSSProperties = { fontSize: 12, color: '#1A1B1C', padding: '7px 10px', borderBottom: '1px solid #F0EFEA', whiteSpace: 'nowrap' }

function statusLabel(status?: LogRow['status']): string {
  if (status === 'partial') return '部分发送'
  if (status === 'failed') return '失败'
  if (status === 'canceled') return '已取消'
  if (status === 'unknown') return '状态未知'
  if (status === 'submitted') return '已提交'
  return '已提交'
}

/** 打印历史记录（查看 → 打印历史记录，本地打印日志） */
export default function PrintHistoryDialog({ onClose }: Props) {
  const [logs, setLogs] = useState<LogRow[]>([])
  const [msg, setMsg] = useState('')
  const [sel, setSel] = useState<LogRow | null>(null)

  const reload = async () => {
    try {
      const r = await window.maxlabel.listPrintLogs()
      if (!r.ok) {
        setMsg(r.message ?? '读取失败')
        return
      }
      const rows = (r.logs ?? []).filter((l) => l && typeof l === 'object') as unknown as LogRow[]
      setLogs(rows.sort((a, b) => String(b.time ?? '').localeCompare(String(a.time ?? ''))))
    } catch (error) {
      setMsg('读取失败：' + (error instanceof Error ? error.message : String(error)))
    }
  }

  useEffect(() => {
    void reload()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleExport = async () => {
    setMsg('')
    try {
      const r = await window.maxlabel.exportPrintLogs()
      if (r.ok) setMsg(`已导出：${r.path}`)
      else setMsg(r.message ?? '导出失败')
    } catch (error) {
      setMsg('导出失败：' + (error instanceof Error ? error.message : String(error)))
    }
  }

  const handleOpenLog = async () => {
    try {
      const r = await window.maxlabel.openPrintLog()
      if (!r.ok) setMsg(r.message ?? '打开日志文件失败')
    } catch {
      setMsg('打开日志文件失败')
    }
  }

  const handleClear = async () => {
    if (!window.confirm('确定清空全部打印历史记录？此操作不可恢复。')) return
    setMsg('')
    try {
      const r = await window.maxlabel.clearPrintLogs()
      if (r.ok) {
        setLogs([])
        setSel(null)
        setMsg('打印历史已清空')
      } else setMsg(r.message ?? '清空失败')
    } catch (error) {
      setMsg('清空失败：' + (error instanceof Error ? error.message : String(error)))
    }
  }

  const handleDelete = async (row: LogRow) => {
    if (!window.confirm(`确定删除该条打印记录？\n时间：${row.time}`)) return
    setMsg('')
    try {
      const r = await window.maxlabel.deletePrintLog(row.time)
      if (r.ok) {
        setSel(null)
        await reload()
        setMsg('已删除该条记录')
      } else setMsg(r.message ?? '删除失败')
    } catch (error) {
      setMsg('删除失败：' + (error instanceof Error ? error.message : String(error)))
    }
  }

  const btnBase: React.CSSProperties = { padding: '7px 16px', borderRadius: 7, border: '1px solid #D3D6DA', background: '#fff', color: '#1A1B1C', cursor: 'pointer', fontSize: 13, fontFamily: 'inherit' }
  const btnPrimary: React.CSSProperties = { ...btnBase, border: '1px solid #2E6E93', background: '#2E6E93', color: '#fff' }

  return (
    <Modal
      title="打印历史记录"
      onClose={onClose}
      width={760}
      footer={
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <span style={{ fontSize: 11, color: '#6B7280', marginRight: 'auto' }}>{msg}</span>
          <button type="button" onClick={handleExport} style={btnBase}>导出 CSV</button>
          <button type="button" onClick={handleOpenLog} style={btnBase}>打开日志文件</button>
          <button type="button" onClick={handleClear} style={btnBase}>清空</button>
          <button type="button" onClick={onClose} style={btnPrimary}>关闭</button>
        </div>
      }
    >
      <div style={{ fontSize: 11, color: '#9CA3AF', marginBottom: 8 }}>
        本地打印日志 · 共 {logs.length} 条
      </div>
      {logs.length === 0 ? (
        <div style={{ fontSize: 13, color: '#6B7280', padding: '40px 0', textAlign: 'center' }}>暂无打印记录</div>
      ) : (
        <>
          <div style={{ overflow: 'auto', maxHeight: 300, border: '1px solid #ECEBE6', borderRadius: 8 }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={thStyle}>时间</th>
                  <th style={thStyle}>模板</th>
                  <th style={thStyle}>打印方式</th>
                  <th style={thStyle}>数量</th>
                  <th style={thStyle}>份数</th>
                  <th style={thStyle}>实际张数</th>
                  <th style={thStyle}>已发送</th>
                  <th style={thStyle}>状态</th>
                  <th style={thStyle}>类型</th>
                  <th style={thStyle}>打印机</th>
                  <th style={{ ...thStyle, textAlign: 'right' }}></th>
                </tr>
              </thead>
              <tbody>
                {logs.map((l, i) => (
                  <tr
                    key={i}
                    onClick={() => setSel(sel === l ? null : l)}
                    style={{ cursor: 'pointer', background: sel === l ? '#E4EFF7' : 'transparent' }}
                  >
                    <td style={tdStyle}>{l.time ? new Date(l.time).toLocaleString() : ''}</td>
                    <td style={{ ...tdStyle, maxWidth: 150, overflow: 'hidden', textOverflow: 'ellipsis' }}>{l.title ?? ''}</td>
                    <td style={tdStyle}>{l.mode === 'driver' ? '驱动打印' : '指令打印'}</td>
                    <td style={tdStyle}>{l.count ?? ''}</td>
                    <td style={tdStyle}>{l.copies ?? ''}</td>
                    <td style={tdStyle}>{l.physicalCount ?? ((l.count ?? 0) * (l.copies ?? 0))}</td>
                    <td style={tdStyle}>{l.sentCount ?? '—'}</td>
                    <td style={tdStyle}>{statusLabel(l.status)}</td>
                    <td style={tdStyle}>{l.test ? '测试' : '正式'}</td>
                    <td style={{ ...tdStyle, maxWidth: 150, overflow: 'hidden', textOverflow: 'ellipsis' }}>{l.printer ?? ''}</td>
                    <td style={{ ...tdStyle, textAlign: 'right' }}>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation()
                          void handleDelete(l)
                        }}
                        title="删除该条记录"
                        style={{ padding: '2px 8px', borderRadius: 5, border: '1px solid #E4E3DD', background: '#fff', color: '#B34747', cursor: 'pointer', fontSize: 11, fontFamily: 'inherit' }}
                      >
                        删除
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {sel && (
            <div style={{ marginTop: 10, border: '1px solid #E4E3DD', borderRadius: 8, background: '#FAF9F6', padding: '10px 12px' }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: '#1A1B1C', marginBottom: 6 }}>打印详情</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px 16px', fontSize: 12.5, color: '#1A1B1C' }}>
                <div>时间：{sel.time ? new Date(sel.time).toLocaleString() : '—'}</div>
                <div>模板：{sel.title ?? '—'}</div>
                <div>打印方式：{sel.mode === 'driver' ? '驱动打印（系统对话框）' : '指令打印（TSPL/ZPL/CPCL 直连）'}</div>
                <div>类型：{sel.test ? '测试打印（不写日志、不推进序列号）' : '正式打印'}</div>
                <div>数量：{sel.count ?? '—'}</div>
                <div>单签拷贝：{sel.copies ?? '—'}</div>
                <div>实际打印张数：{sel.physicalCount ?? ((sel.count ?? 0) * (sel.copies ?? 0))}</div>
                <div>已发送标签张数：{sel.sentCount ?? '—'}</div>
                <div>打印状态：{statusLabel(sel.status)}</div>
                <div>打印机：{sel.printer ?? '—'}</div>
              </div>
              {(sel as { dataSnapshot?: string[] }).dataSnapshot && (sel as { dataSnapshot?: string[] }).dataSnapshot!.length > 0 && (
                <div style={{ marginTop: 10 }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: '#1A1B1C', marginBottom: 4 }}>打印数据项目（每张标签内容）</div>
                  <div style={{ maxHeight: 160, overflow: 'auto', border: '1px solid #F0EFEA', borderRadius: 6, padding: 6 }}>
                    {(sel as { dataSnapshot?: string[] }).dataSnapshot!.map((line: string, i: number) => (
                      <div key={i} style={{ fontSize: 12, color: '#374151', padding: '2px 0', borderBottom: i === (sel as { dataSnapshot?: string[] }).dataSnapshot!.length - 1 ? 'none' : '1px solid #F5F4EF' }}>
                        <span style={{ color: '#9AA0A6', marginRight: 8 }}>#{i + 1}</span>{line || '（空）'}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </Modal>
  )
}
