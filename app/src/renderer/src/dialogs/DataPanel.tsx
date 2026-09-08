import { useRef, useState } from 'react'
import type { Dataset, DbConnectionConfig, DbDriver } from '../types'
import { fileToDataset } from '../editor/dataImport'
import { uid } from '../types'
import Modal from './Modal'

interface Props {
  datasets: Record<string, Dataset>
  connections: Record<string, DbConnectionConfig>
  onClose: () => void
  onImport: (d: Dataset) => void
  onImportReplace: (name: string, d: Dataset) => void
  onDelete: (name: string) => void
  onConnectionSave: (c: DbConnectionConfig) => void
  onConnectionDelete: (id: string) => void
  onRenameField: (name: string, field: string, newField: string) => void
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '6px 8px',
  border: '1px solid #D5D4CD',
  borderRadius: 6,
  fontSize: 13,
  boxSizing: 'border-box',
  fontFamily: 'inherit'
}

const DRIVERS: Array<{ value: DbDriver; label: string; hint: string }> = [
  { value: 'sqlserver', label: 'SQL Server (ODBC)', hint: '需要已安装 “ODBC Driver 17 for SQL Server”' },
  { value: 'mysql', label: 'MySQL (ODBC)', hint: '需要已安装 MySQL ODBC 驱动' },
  { value: 'sqlite', label: 'SQLite (ODBC)', hint: '需要已安装 SQLite3 ODBC 驱动，选择数据库文件' },
  { value: 'dsn', label: '已有 DSN', hint: '填写系统/用户 DSN 名称' }
]

function blankConn(): DbConnectionConfig {
  return { id: uid(), name: '', driver: 'sqlserver', server: '', database: '', user: '', password: '', timeoutSec: 15 }
}

export default function DataPanel({ datasets, connections, onClose, onImport, onImportReplace, onDelete, onConnectionSave, onConnectionDelete, onRenameField }: Props) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [error, setError] = useState('')
  const [tab, setTab] = useState<'local' | 'db'>('local')
  const [editing, setEditing] = useState<DbConnectionConfig | null>(null)
  const [sql, setSql] = useState('SELECT * FROM [表名]')
  const [dbMsg, setDbMsg] = useState('')
  const [busy, setBusy] = useState(false)
  /** 字段映射编辑状态：{ 数据集名: { 原字段: 新字段 } } */
  const [fieldRename, setFieldRename] = useState<Record<string, Record<string, string>>>({})

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    e.target.value = ''
    if (!f) return
    try {
      const d = await fileToDataset(f)
      if (!d.columns.length) {
        setError('文件为空或格式不正确')
        return
      }
      onImport(d)
      setError('')
    } catch (err) {
      setError('导入失败：' + (err instanceof Error ? err.message : String(err)))
    }
  }

  const names = Object.keys(datasets)
  const total = names.reduce((s, n) => s + (datasets[n]?.rows.length ?? 0), 0)
  const connList = Object.values(connections)

  const patch = (p: Partial<DbConnectionConfig>) => setEditing((e) => (e ? { ...e, ...p } : e))

  const doTest = async () => {
    if (!editing) return
    setBusy(true)
    setDbMsg('')
    const r = await window.maxlabel.db.test({ ...editing, password: editing.password ?? '' })
    setBusy(false)
    setDbMsg(r.ok ? '✓ ' + (r.message ?? '连接成功') : '✗ ' + (r.error ?? '连接失败'))
  }

  const doQueryImport = async (conn: DbConnectionConfig, targetSql: string, targetName?: string) => {
    setBusy(true)
    setDbMsg('')
    const r = await window.maxlabel.db.query({ ...conn, password: conn.password ?? '' }, targetSql)
    setBusy(false)
    if (!r.ok) {
      setDbMsg('✗ ' + (r.error ?? '查询失败'))
      return
    }
    const name = (targetName ?? conn.datasetName ?? conn.name) || 'dbdata'
    if (!r.rows.length) {
      setDbMsg('查询成功，但返回 0 行')
      return
    }
    const columns = Object.keys(r.rows[0])
    const rows = r.rows.map((row) => columns.map((c) => row[c] ?? ''))
    onImportReplace(name, { name, columns, rows })
    setDbMsg(`✓ 已导入数据集“${name}”（${rows.length} 行）`)
    return name
  }

  const doSaveConn = async () => {
    if (!editing) return
    if (!editing.name.trim()) {
      setDbMsg('请填写连接名称')
      return
    }
    // 立即查询一次以确定列结构（也可由用户手动点"查询并导入"）
    onConnectionSave(editing)
    setEditing(null)
    setDbMsg('连接已保存。可在列表中对它执行“查询并导入数据集”。')
  }

  return (
    <Modal
      title="数据管理（数据源）"
      onClose={onClose}
      width={680}
      footer={
        <button type="button" onClick={onClose} style={{ padding: '7px 16px', borderRadius: 8, border: '1px solid #D5D4CD', background: '#fff', cursor: 'pointer', fontSize: 13 }}>
          关闭
        </button>
      }
    >
      <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
        <button
          type="button"
          onClick={() => setTab('local')}
          style={{
            padding: '7px 14px',
            borderRadius: 8,
            border: '1px solid #D5D4CD',
            background: tab === 'local' ? '#2E6E93' : '#fff',
            color: tab === 'local' ? '#fff' : '#1A1B1C',
            cursor: 'pointer',
            fontSize: 13,
            fontWeight: 600
          }}
        >
          本地数据（CSV / Excel）
        </button>
        <button
          type="button"
          onClick={() => setTab('db')}
          style={{
            padding: '7px 14px',
            borderRadius: 8,
            border: '1px solid #D5D4CD',
            background: tab === 'db' ? '#2E6E93' : '#fff',
            color: tab === 'db' ? '#fff' : '#1A1B1C',
            cursor: 'pointer',
            fontSize: 13,
            fontWeight: 600
          }}
        >
          数据库（ODBC / SQL）
        </button>
      </div>

      {tab === 'local' && (
        <>
          <input ref={fileRef} type="file" accept=".csv,.txt,.xlsx,.xls" style={{ display: 'none' }} onChange={handleFile} />
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 14 }}>
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              style={{ padding: '7px 14px', borderRadius: 8, border: '1px solid #2E6E93', background: '#2E6E93', color: '#fff', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}
            >
              导入 CSV / Excel
            </button>
            <span style={{ fontSize: 12, color: '#6B7280' }}>支持逗号/制表符分隔文本、Excel 工作表，首行为列名。导入的数据集随模板保存。</span>
          </div>
          {error && <div style={{ fontSize: 12, color: '#C0392B', marginBottom: 10 }}>{error}</div>}

          {names.length === 0 ? (
            <div style={{ fontSize: 13, color: '#9CA3AF', padding: '24px 0', textAlign: 'center' }}>尚未导入任何数据集</div>
          ) : (
            <>
              <div style={{ fontSize: 12, color: '#6B7280', marginBottom: 8 }}>共 {names.length} 个数据集，{total} 行记录</div>
              {names.map((n) => {
                const d = datasets[n]
                return (
                  <div key={n} style={{ border: '1px solid #E4E3DD', borderRadius: 10, padding: 10, marginBottom: 10 }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                      <div style={{ fontSize: 13, fontWeight: 600 }}>
                        {n}
                        <span style={{ color: '#6B7280', fontWeight: 400, marginLeft: 8 }}>{d.rows.length} 行 · {d.columns.join(' / ')}</span>
                      </div>
                      <button type="button" onClick={() => onDelete(n)} style={{ fontSize: 12, color: '#C0392B', background: 'none', border: 'none', cursor: 'pointer' }}>
                        删除
                      </button>
                    </div>
                    {d.rows.length > 0 && (
                      <div style={{ fontSize: 11, color: '#6B7280' }}>首行：{d.columns.map((c, i) => `${c}=${d.rows[0][i] ?? ''}`).join('，')}</div>
                    )}
                    {/* 字段映射：重命名字段（别名） */}
                    <div style={{ marginTop: 8, borderTop: '1px dashed #E4E3DD', paddingTop: 8 }}>
                      <div style={{ fontSize: 11, color: '#6B7280', marginBottom: 4 }}>字段映射（重命名后，数据源下拉显示别名）</div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                        {d.columns.map((c) => {
                          const map = fieldRename[n] ?? {}
                          const val = map[c] ?? ''
                          return (
                            <label key={c} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: '#4B5563', border: '1px solid #E4E3DD', borderRadius: 6, padding: '3px 8px', background: '#FAFAF8' }}>
                              <span style={{ color: '#6B7280' }}>{c} →</span>
                              <input
                                value={val}
                                placeholder="同字段名"
                                style={{ width: 90, border: 'none', background: 'transparent', fontSize: 11, outline: 'none', color: '#1A1B1C' }}
                                onChange={(e) => {
                                  const v = e.target.value.trim()
                                  setFieldRename((prev) => {
                                    const m = { ...(prev[n] ?? {}) }
                                    if (v) m[c] = v
                                    else delete m[c]
                                    return { ...prev, [n]: m }
                                  })
                                  if (v && v !== c) onRenameField(n, c, v)
                                  else if (!v && c) onRenameField(n, c, c)
                                }}
                              />
                            </label>
                          )
                        })}
                      </div>
                    </div>
                  </div>
                )
              })}
            </>
          )}
          <div style={{ marginTop: 8, fontSize: 12, color: '#6B7280' }}>
            使用：在对象的属性面板把数据源改为"数据库字段"，选择数据集与字段。打印时按"打印数量"逐条取记录（每记录一签）。
          </div>
        </>
      )}

      {tab === 'db' && (
        <>
          <div style={{ fontSize: 12, color: '#6B7280', lineHeight: 1.6, marginBottom: 12 }}>
            配置 ODBC / SQL 连接，查询结果导入为数据集供"数据库字段"数据源使用。勾选"打印前自动刷新"后，正式打印前会自动重新查询数据库（数据库直连模式）。
          </div>

          {!editing ? (
            <>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <span style={{ fontSize: 12, color: '#6B7280' }}>数据库连接（{connList.length}）</span>
                <button
                  type="button"
                  onClick={() => {
                    setEditing(blankConn())
                    setDbMsg('')
                  }}
                  style={{ padding: '6px 12px', borderRadius: 8, border: '1px solid #2E6E93', background: '#2E6E93', color: '#fff', cursor: 'pointer', fontSize: 12, fontWeight: 600 }}
                >
                  + 新建连接
                </button>
              </div>
              {connList.length === 0 && <div style={{ fontSize: 13, color: '#9CA3AF', padding: '20px 0', textAlign: 'center' }}>暂无数据库连接</div>}
              {connList.map((c) => (
                <div key={c.id} style={{ border: '1px solid #E4E3DD', borderRadius: 10, padding: 10, marginBottom: 10 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                    <div style={{ fontSize: 13, fontWeight: 600 }}>
                      {c.name}
                      <span style={{ color: '#6B7280', fontWeight: 400, marginLeft: 8 }}>
                        {DRIVERS.find((d) => d.value === c.driver)?.label} {c.autoRefresh ? '· 打印前自动刷新' : ''}
                      </span>
                    </div>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button type="button" onClick={() => { setEditing({ ...c }); setSql(c.sql ?? 'SELECT * FROM [表名]'); setDbMsg('') }} style={{ fontSize: 12, color: '#2E6E93', background: 'none', border: 'none', cursor: 'pointer' }}>
                        编辑
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          const name = c.datasetName ?? c.name
                          doQueryImport(c, 'SELECT * FROM [表名]', name)
                        }}
                        disabled={busy}
                        style={{ fontSize: 12, color: '#2E6E93', background: 'none', border: 'none', cursor: 'pointer' }}
                      >
                        查询并导入
                      </button>
                      <button type="button" onClick={() => onConnectionDelete(c.id)} style={{ fontSize: 12, color: '#C0392B', background: 'none', border: 'none', cursor: 'pointer' }}>
                        删除
                      </button>
                    </div>
                  </div>
                  <div style={{ fontSize: 11, color: '#6B7280' }}>
                    目标数据集：{c.datasetName ?? c.name} {c.autoRefresh ? '（打印前自动刷新）' : ''}
                  </div>
                </div>
              ))}
            </>
          ) : (
            <>
              <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 10 }}>编辑数据库连接</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div>
                  <div style={{ fontSize: 12, color: '#6B7280', marginBottom: 4 }}>连接名称 *</div>
                  <input value={editing.name} onChange={(e) => patch({ name: e.target.value })} style={inputStyle} placeholder="如：生产系统" />
                </div>
                <div>
                  <div style={{ fontSize: 12, color: '#6B7280', marginBottom: 4 }}>驱动类型</div>
                  <select value={editing.driver} onChange={(e) => patch({ driver: e.target.value as DbDriver })} style={inputStyle}>
                    {DRIVERS.map((d) => (
                      <option key={d.value} value={d.value}>
                        {d.label}
                      </option>
                    ))}
                  </select>
                </div>
                {editing.driver === 'dsn' ? (
                  <div style={{ gridColumn: '1 / -1' }}>
                    <div style={{ fontSize: 12, color: '#6B7280', marginBottom: 4 }}>DSN 名称 *</div>
                    <input value={editing.dsn ?? ''} onChange={(e) => patch({ dsn: e.target.value })} style={inputStyle} placeholder="系统/用户 DSN" />
                  </div>
                ) : editing.driver === 'sqlite' ? (
                  <div style={{ gridColumn: '1 / -1' }}>
                    <div style={{ fontSize: 12, color: '#6B7280', marginBottom: 4 }}>数据库文件路径 *</div>
                    <input value={editing.filePath ?? ''} onChange={(e) => patch({ filePath: e.target.value })} style={inputStyle} placeholder="C:\data\db.sqlite" />
                  </div>
                ) : (
                  <>
                    <div>
                      <div style={{ fontSize: 12, color: '#6B7280', marginBottom: 4 }}>服务器</div>
                      <input value={editing.server ?? ''} onChange={(e) => patch({ server: e.target.value })} style={inputStyle} placeholder="localhost\\SQLEXPRESS 或 IP" />
                    </div>
                    <div>
                      <div style={{ fontSize: 12, color: '#6B7280', marginBottom: 4 }}>数据库</div>
                      <input value={editing.database ?? ''} onChange={(e) => patch({ database: e.target.value })} style={inputStyle} placeholder="数据库名" />
                    </div>
                    <div>
                      <div style={{ fontSize: 12, color: '#6B7280', marginBottom: 4 }}>用户名</div>
                      <input value={editing.user ?? ''} onChange={(e) => patch({ user: e.target.value })} style={inputStyle} placeholder="sa / root" />
                    </div>
                    <div>
                      <div style={{ fontSize: 12, color: '#6B7280', marginBottom: 4 }}>密码</div>
                      <input type="password" value={editing.password ?? ''} onChange={(e) => patch({ password: e.target.value })} style={inputStyle} />
                    </div>
                  </>
                )}
                <div style={{ gridColumn: '1 / -1' }}>
                  <div style={{ fontSize: 12, color: '#6B7280', marginBottom: 4 }}>查询 SQL（用于导入数据集）</div>
                  <textarea value={sql} onChange={(e) => setSql(e.target.value)} rows={3} style={{ ...inputStyle, resize: 'vertical', fontFamily: 'Consolas, monospace' }} />
                </div>
                <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#1A1B1C' }}>
                  <input type="checkbox" checked={!!editing.autoRefresh} onChange={(e) => patch({ autoRefresh: e.target.checked })} />
                  每次打印前自动刷新（数据库直连）
                </label>
                <div>
                  <div style={{ fontSize: 12, color: '#6B7280', marginBottom: 4 }}>导入的目标数据集名</div>
                  <input value={editing.datasetName ?? ''} onChange={(e) => patch({ datasetName: e.target.value })} style={inputStyle} placeholder="默认 = 连接名" />
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                <button type="button" onClick={doTest} disabled={busy} style={{ padding: '7px 14px', borderRadius: 8, border: '1px solid #D5D4CD', background: '#fff', cursor: 'pointer', fontSize: 13 }}>
                  测试连接
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const conn = { ...editing, datasetName: editing.datasetName || editing.name, sql }
                    void doQueryImport(conn, sql, conn.datasetName).then((name) => {
                      onConnectionSave(conn)
                      setEditing(null)
                      if (name) setDbMsg(`✓ 已导入数据集“${name}”并保存连接`)
                    })
                  }}
                  disabled={busy}
                  style={{ padding: '7px 14px', borderRadius: 8, border: '1px solid #2E6E93', background: '#2E6E93', color: '#fff', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}
                >
                  保存并查询导入
                </button>
                <button type="button" onClick={() => setEditing(null)} style={{ padding: '7px 14px', borderRadius: 8, border: '1px solid #D5D4CD', background: '#fff', cursor: 'pointer', fontSize: 13 }}>
                  取消
                </button>
              </div>
              <div style={{ fontSize: 11, color: '#6B7280', marginTop: 8 }}>{DRIVERS.find((d) => d.value === editing.driver)?.hint}。查询通过本机 ODBC 驱动执行，密码不写入命令行。</div>
            </>
          )}
          {dbMsg && <div style={{ marginTop: 10, fontSize: 12, color: dbMsg.startsWith('✓') ? '#2E7D32' : '#C0392B', whiteSpace: 'pre-wrap' }}>{dbMsg}</div>}
        </>
      )}
    </Modal>
  )
}
