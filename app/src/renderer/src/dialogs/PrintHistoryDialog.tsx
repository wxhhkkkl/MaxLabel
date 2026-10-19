import { useEffect, useState } from 'react'
import { useI18n } from '../features/i18n/useI18n'
import { formatDateTime, formatNumber } from '../features/i18n/format'
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

function statusLabel(status: LogRow['status'] | undefined, t: (key: string, params?: Record<string, string | number>) => string): string {
  if (status === 'partial') return t('history.status.partial')
  if (status === 'failed') return t('history.status.failed')
  if (status === 'canceled') return t('history.status.canceled')
  if (status === 'unknown') return t('history.status.unknown')
  return t('history.status.submitted')
}

/** 打印历史记录（查看 → 打印历史记录，本地打印日志） */
export default function PrintHistoryDialog({ onClose }: Props) {
  const { language, t } = useI18n()
  const [logs, setLogs] = useState<LogRow[]>([])
  const [msg, setMsg] = useState('')
  const [sel, setSel] = useState<LogRow | null>(null)

  const reload = async () => {
    try {
      const r = await window.maxlabel.listPrintLogs()
      if (!r.ok) {
        setMsg(r.message ?? t('history.readFailed'))
        return
      }
      const rows = (r.logs ?? []).filter((l) => l && typeof l === 'object') as unknown as LogRow[]
      setLogs(rows.sort((a, b) => String(b.time ?? '').localeCompare(String(a.time ?? ''))))
    } catch (error) {
      setMsg(t('history.readFailedDetail', { message: error instanceof Error ? error.message : String(error) }))
    }
  }

  useEffect(() => {
    void reload()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleExport = async () => {
    setMsg('')
    try {
      const r = await window.maxlabel.exportPrintLogs(language)
      if (r.ok) setMsg(t('history.exported', { path: r.path ?? '' }))
      else setMsg(r.message ?? t('history.exportFailed'))
    } catch (error) {
      setMsg(t('history.exportFailedDetail', { message: error instanceof Error ? error.message : String(error) }))
    }
  }

  const handleOpenLog = async () => {
    try {
      const r = await window.maxlabel.openPrintLog()
      if (!r.ok) setMsg(r.message ?? t('history.openLogFailed'))
    } catch {
      setMsg(t('history.openLogFailed'))
    }
  }

  const handleClear = async () => {
    if (!window.confirm(t('history.clearConfirm'))) return
    setMsg('')
    try {
      const r = await window.maxlabel.clearPrintLogs()
      if (r.ok) {
        setLogs([])
        setSel(null)
        setMsg(t('history.cleared'))
      } else setMsg(r.message ?? t('history.clearFailed'))
    } catch (error) {
      setMsg(t('history.clearFailedDetail', { message: error instanceof Error ? error.message : String(error) }))
    }
  }

  const handleDelete = async (row: LogRow) => {
    if (!window.confirm(t('history.deleteConfirm', { time: row.time }))) return
    setMsg('')
    try {
      const r = await window.maxlabel.deletePrintLog(row.time)
      if (r.ok) {
        setSel(null)
        await reload()
        setMsg(t('history.deleted'))
      } else setMsg(r.message ?? t('history.deleteFailed'))
    } catch (error) {
      setMsg(t('history.deleteFailedDetail', { message: error instanceof Error ? error.message : String(error) }))
    }
  }

  const btnBase: React.CSSProperties = { padding: '7px 16px', borderRadius: 7, border: '1px solid #D3D6DA', background: '#fff', color: '#1A1B1C', cursor: 'pointer', fontSize: 13, fontFamily: 'inherit' }
  const btnPrimary: React.CSSProperties = { ...btnBase, border: '1px solid #2E6E93', background: '#2E6E93', color: '#fff' }

  return (
    <Modal
      title={t('history.title')}
      onClose={onClose}
      width={760}
      footer={
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <span style={{ fontSize: 11, color: '#6B7280', marginRight: 'auto' }}>{msg}</span>
          <button type="button" onClick={handleExport} style={btnBase}>{t('history.exportCsv')}</button>
          <button type="button" onClick={handleOpenLog} style={btnBase}>{t('history.openLog')}</button>
          <button type="button" onClick={handleClear} style={btnBase}>{t('history.clear')}</button>
          <button type="button" onClick={onClose} style={btnPrimary}>{t('history.close')}</button>
        </div>
      }
    >
      <div style={{ fontSize: 11, color: '#9CA3AF', marginBottom: 8 }}>
        {t('history.summary', { count: formatNumber(logs.length, language) })}
      </div>
      {logs.length === 0 ? (
        <div style={{ fontSize: 13, color: '#6B7280', padding: '40px 0', textAlign: 'center' }}>{t('history.empty')}</div>
      ) : (
        <>
          <div style={{ overflow: 'auto', maxHeight: 300, border: '1px solid #ECEBE6', borderRadius: 8 }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={thStyle}>{t('history.time')}</th>
                  <th style={thStyle}>{t('history.template')}</th>
                  <th style={thStyle}>{t('history.mode')}</th>
                  <th style={thStyle}>{t('history.count')}</th>
                  <th style={thStyle}>{t('history.copies')}</th>
                  <th style={thStyle}>{t('history.physical')}</th>
                  <th style={thStyle}>{t('history.sent')}</th>
                  <th style={thStyle}>{t('history.status')}</th>
                  <th style={thStyle}>{t('history.type')}</th>
                  <th style={thStyle}>{t('history.printer')}</th>
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
                    <td style={tdStyle}>{formatDateTime(l.time, language)}</td>
                    <td style={{ ...tdStyle, maxWidth: 150, overflow: 'hidden', textOverflow: 'ellipsis' }}>{l.title ?? ''}</td>
                    <td style={tdStyle}>{l.mode === 'driver' ? t('history.mode.driver') : t('history.mode.command')}</td>
                    <td style={tdStyle}>{l.count ?? ''}</td>
                    <td style={tdStyle}>{l.copies ?? ''}</td>
                    <td style={tdStyle}>{l.physicalCount ?? ((l.count ?? 0) * (l.copies ?? 0))}</td>
                    <td style={tdStyle}>{l.sentCount ?? '—'}</td>
                    <td style={tdStyle}>{statusLabel(l.status, t)}</td>
                    <td style={tdStyle}>{l.test ? t('history.test') : t('history.normal')}</td>
                    <td style={{ ...tdStyle, maxWidth: 150, overflow: 'hidden', textOverflow: 'ellipsis' }}>{l.printer ?? ''}</td>
                    <td style={{ ...tdStyle, textAlign: 'right' }}>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation()
                          void handleDelete(l)
                        }}
                        title={t('history.deleteRecord')}
                        style={{ padding: '2px 8px', borderRadius: 5, border: '1px solid #E4E3DD', background: '#fff', color: '#B34747', cursor: 'pointer', fontSize: 11, fontFamily: 'inherit' }}
                      >
                        {t('history.delete')}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {sel && (
            <div style={{ marginTop: 10, border: '1px solid #E4E3DD', borderRadius: 8, background: '#FAF9F6', padding: '10px 12px' }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: '#1A1B1C', marginBottom: 6 }}>{t('history.detail')}</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px 16px', fontSize: 12.5, color: '#1A1B1C' }}>
                <div>{t('history.timeLabel', { value: formatDateTime(sel.time, language) || '—' })}</div>
                <div>{t('history.templateLabel', { value: sel.title ?? '—' })}</div>
                <div>{t('history.modeLabel', { value: sel.mode === 'driver' ? t('history.mode.driverDetail') : t('history.mode.commandDetail') })}</div>
                <div>{t('history.typeLabel', { value: sel.test ? t('history.testDetail') : t('history.normalDetail') })}</div>
                <div>{t('history.countLabel', { value: sel.count ?? '—' })}</div>
                <div>{t('history.copiesLabel', { value: sel.copies ?? '—' })}</div>
                <div>{t('history.physicalLabel', { value: sel.physicalCount ?? ((sel.count ?? 0) * (sel.copies ?? 0)) })}</div>
                <div>{t('history.sentLabel', { value: sel.sentCount ?? '—' })}</div>
                <div>{t('history.statusLabel', { value: statusLabel(sel.status, t) })}</div>
                <div>{t('history.printerLabel', { value: sel.printer ?? '—' })}</div>
              </div>
              {(sel as { dataSnapshot?: string[] }).dataSnapshot && (sel as { dataSnapshot?: string[] }).dataSnapshot!.length > 0 && (
                <div style={{ marginTop: 10 }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: '#1A1B1C', marginBottom: 4 }}>{t('history.dataSnapshot')}</div>
                  <div style={{ maxHeight: 160, overflow: 'auto', border: '1px solid #F0EFEA', borderRadius: 6, padding: 6 }}>
                    {(sel as { dataSnapshot?: string[] }).dataSnapshot!.map((line: string, i: number) => (
                      <div key={i} style={{ fontSize: 12, color: '#374151', padding: '2px 0', borderBottom: i === (sel as { dataSnapshot?: string[] }).dataSnapshot!.length - 1 ? 'none' : '1px solid #F5F4EF' }}>
                        <span style={{ color: '#9AA0A6', marginRight: 8 }}>#{i + 1}</span>{line || t('history.emptyValue')}
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
