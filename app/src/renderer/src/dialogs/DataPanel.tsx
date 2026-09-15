import { useEffect, useRef, useState } from 'react'
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

type ImportType = 'text' | 'excel' | 'odbc' | 'cloud'
type TextDelimiter = 'auto' | ',' | '\t' | ';'
interface PendingFileImport {
  file: File
  preview: Dataset
  sheetNames: string[]
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
  return { id: uid(), name: '', driver: 'sqlserver', authMode: 'windows', server: '', database: '', user: '', password: '', timeoutSec: 15, tableName: '' }
}

function selectAllFromTable(table: string): string {
  return `SELECT * FROM [${table.trim().replace(/]/g, ']]')}]`
}

export default function DataPanel({ datasets, connections, onClose, onImport, onImportReplace, onDelete, onConnectionSave, onConnectionDelete, onRenameField }: Props) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [error, setError] = useState('')
  const [tab, setTab] = useState<'local' | 'db'>('local')
  const [editing, setEditing] = useState<DbConnectionConfig | null>(null)
  const [sql, setSql] = useState('SELECT * FROM [表名]')
  const [dbMsg, setDbMsg] = useState('')
  const [busy, setBusy] = useState(false)
  const requestRef = useRef<string | null>(null)
  /** 字段映射编辑状态：{ 数据集名: { 原字段: 新字段 } } */
  const [fieldRename, setFieldRename] = useState<Record<string, Record<string, string>>>({})
  const [importType, setImportType] = useState<ImportType>('text')
  const [importConfigured, setImportConfigured] = useState(false)
  const [pendingImport, setPendingImport] = useState<PendingFileImport | null>(null)
  const [textDelimiter, setTextDelimiter] = useState<TextDelimiter>('auto')
  const [textHasHeader, setTextHasHeader] = useState(true)
  const [excelSheet, setExcelSheet] = useState('')
  const [excelHasHeader, setExcelHasHeader] = useState(true)
  const [cloudHandoff, setCloudHandoff] = useState(false)

  useEffect(() => () => {
    const requestId = requestRef.current
    if (requestId) void window.maxlabel.db.cancel(requestId).catch(() => {})
  }, [])

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
      const fileIsExcel = /\.(xlsx|xls)$/i.test(f.name)
      const inferredType: ImportType = fileIsExcel ? 'excel' : 'text'
      if (importConfigured && importType !== inferredType) {
        setError(`当前导入类型为“${importType === 'excel' ? 'EXCEL文件' : '文本文件'}”，请选择匹配的文件`)
        return
      }
      if (!importConfigured) {
        // 保留工具栏“导入 CSV / Excel”的快捷路径；选择具体类型后才进入
        // LabelShop 风格的分步导入确认。
        onImport(d)
        setError('')
        return
      }
      let sheetNames: string[] = []
      if (fileIsExcel) {
        const XLSX = await import('@e965/xlsx')
        const wb = XLSX.read(await f.arrayBuffer(), { type: 'array', sheetRows: 1 })
        sheetNames = wb.SheetNames
        setExcelSheet(sheetNames[0] ?? '')
      }
      setPendingImport({ file: f, preview: d, sheetNames })
      setError('')
    } catch (err) {
      setError('导入失败：' + (err instanceof Error ? err.message : String(err)))
    }
  }

  const chooseImportType = (next: ImportType) => {
    setImportType(next)
    setImportConfigured(true)
    setPendingImport(null)
    setError('')
    if (next === 'odbc') setTab('db')
    else setTab('local')
  }

  const confirmFileImport = async () => {
    if (!pendingImport) return
    try {
      const d = await fileToDataset(pendingImport.file, {
        ...(importType === 'text' && textDelimiter !== 'auto' ? { delimiter: textDelimiter } : {}),
        hasHeader: importType === 'excel' ? excelHasHeader : textHasHeader,
        ...(importType === 'excel' && excelSheet ? { sheetName: excelSheet } : {})
      })
      if (!d.columns.length) throw new Error('文件为空或格式不正确')
      onImport(d)
      setPendingImport(null)
      setImportConfigured(false)
      setError('')
    } catch (err) {
      setError('导入失败：' + (err instanceof Error ? err.message : String(err)))
    }
  }

  const names = Object.keys(datasets)
  const total = names.reduce((s, n) => s + (datasets[n]?.rows.length ?? 0), 0)
  const connList = Object.values(connections)

  const patch = (p: Partial<DbConnectionConfig>) => setEditing((e) => (e ? { ...e, ...p } : e))

  const cancelPending = () => {
    const requestId = requestRef.current
    requestRef.current = null
    if (requestId) void window.maxlabel.db.cancel(requestId).catch(() => {})
    setBusy(false)
  }

  const closePanel = () => {
    cancelPending()
    onClose()
  }

  const doTest = async () => {
    if (!editing) return
    cancelPending()
    const requestId = uid()
    requestRef.current = requestId
    setBusy(true)
    setDbMsg('')
    try {
      const r = await window.maxlabel.db.test({ ...editing }, requestId)
      if (requestRef.current !== requestId) return
      setDbMsg(r.ok ? '✓ ' + (r.message ?? '连接成功') : '✗ ' + (r.error ?? '连接失败'))
    } catch (error) {
      if (requestRef.current !== requestId) return
      setDbMsg('✗ 连接失败：' + (error instanceof Error ? error.message : String(error)))
    } finally {
      if (requestRef.current === requestId) {
        requestRef.current = null
        setBusy(false)
      }
    }
  }

  const doQueryImport = async (conn: DbConnectionConfig, targetSql: string, targetName?: string) => {
    cancelPending()
    const requestId = uid()
    requestRef.current = requestId
    setBusy(true)
    setDbMsg('')
    try {
      const r = await window.maxlabel.db.query({ ...conn }, targetSql, requestId)
      if (requestRef.current !== requestId) return
      if (!r.ok) {
        setDbMsg('✗ ' + (r.error ?? '查询失败'))
        return
      }
      const name = (targetName ?? conn.datasetName ?? conn.name) || 'dbdata'
      if (!r.rows.length) {
        onImportReplace(name, { name, columns: datasets[name]?.columns ?? [], rows: [] })
        setDbMsg('查询成功，但返回 0 行')
        return name
      }
      const columns = Object.keys(r.rows[0])
      const rows = r.rows.map((row) => columns.map((c) => row[c] ?? ''))
      onImportReplace(name, { name, columns, rows })
      setDbMsg(`✓ 已导入数据集“${name}”（${rows.length} 行）`)
      return name
    } catch (error) {
      if (requestRef.current !== requestId) return
      setDbMsg('✗ 查询失败：' + (error instanceof Error ? error.message : String(error)))
    } finally {
      if (requestRef.current === requestId) {
        requestRef.current = null
        setBusy(false)
      }
    }
  }

  return (
    <Modal
      title="数据管理（数据源）"
      onClose={closePanel}
      width={680}
      footer={
        <button type="button" onClick={closePanel} style={{ padding: '7px 16px', borderRadius: 8, border: '1px solid #D5D4CD', background: '#fff', cursor: 'pointer', fontSize: 13 }}>
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
          <input ref={fileRef} type="file" accept=".csv,.txt,.tsv,.tab,.xlsx,.xls" style={{ display: 'none' }} onChange={handleFile} />
          <div data-testid="database-import-types" style={{ border: '1px solid #E4E3DD', borderRadius: 8, padding: 10, marginBottom: 12 }}>
            <div style={{ fontSize: 12, color: '#6B7280', marginBottom: 7 }}>类型</div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {([
                ['text', '文本文件'],
                ['excel', 'EXCEL文件'],
                ['odbc', 'ODBC 数据源'],
                ['cloud', '云端数据库']
              ] as Array<[ImportType, string]>).map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  data-testid={`database-import-type-${value}`}
                  onClick={() => chooseImportType(value)}
                  style={{ padding: '6px 12px', borderRadius: 6, border: importType === value ? '1px solid #2E6E93' : '1px solid #D5D4CD', background: importType === value ? '#E8F1F6' : '#fff', color: importType === value ? '#2E6E93' : '#4B5563', cursor: 'pointer', fontSize: 12.5, fontFamily: 'inherit' }}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
          {importType === 'cloud' && (
            <div data-testid="database-import-cloud-panel" style={{ border: '1px dashed #D5D4CD', borderRadius: 8, padding: 12, marginBottom: 12, color: '#6B7280', fontSize: 12.5, lineHeight: 1.7 }}>
              <div data-testid="cloud-import-workflow" style={{ color: '#4B5563', marginBottom: 8 }}>云数据库连接步骤：1/4 选定数据库 → 2/4 选择云端数据库文件 → 3/4 选择可使用的表和字段 → 4/4 确定</div>
              <div style={{ marginBottom: 8 }}>云端数据库保存在云马通账户下。请先登录云服务并在云端数据库中选择表格字段；本地数据管理仍可使用文本文件、EXCEL 和 ODBC 数据源。</div>
              <button type="button" data-testid="cloud-database-select" onClick={async () => {
                setCloudHandoff(true)
                try {
                  const result = await window.maxlabel.cloudService.open()
                  setDbMsg(result.ok ? '✓ 已打开云马通，请在云端数据库中选择表格和字段后返回。' : '✗ 无法打开云马通：' + (result.error ?? '未知错误'))
                } catch (error) {
                  setDbMsg('✗ 无法打开云马通：' + (error instanceof Error ? error.message : String(error)))
                }
              }} style={{ padding: '6px 12px', borderRadius: 6, border: '1px solid #2E6E93', background: '#fff', color: '#2E6E93', cursor: 'pointer', fontSize: 12.5 }}>
                {cloudHandoff ? '重新打开云马通' : '选择云端数据库'}
              </button>
              <div data-testid="cloud-database-table-step" style={{ marginTop: 9, padding: 8, background: '#fff', borderRadius: 6, border: '1px solid #ECEBE6' }}>
                <div>可使用的表和字段</div>
                <select data-testid="cloud-database-table" disabled={!cloudHandoff} style={{ ...inputStyle, marginTop: 5 }} defaultValue="">
                  <option value="">{cloudHandoff ? '等待云端服务返回表格' : '请先选择云端数据库'}</option>
                </select>
                <button type="button" data-testid="cloud-database-confirm" disabled={!cloudHandoff} style={{ marginTop: 8, padding: '6px 12px', borderRadius: 6, border: '1px solid #D5D4CD', background: '#F3F4F6', color: '#9CA3AF', cursor: 'not-allowed', fontSize: 12.5 }}>确定</button>
              </div>
              {dbMsg && <div data-testid="cloud-database-message" style={{ marginTop: 8, fontSize: 12, color: dbMsg.startsWith('✓') ? '#2E7D32' : '#C62828', whiteSpace: 'pre-wrap' }}>{dbMsg}</div>}
            </div>
          )}
          <div data-testid="database-import-workflow" style={{ marginBottom: 10 }}>
            <div data-testid="database-import-step" style={{ fontSize: 12, color: '#6B7280', marginBottom: 7 }}>
              {pendingImport
                ? (importType === 'excel' ? '步骤 3/4：选择数据页并设置首行字段名' : '步骤 3/4：选择符号类型并设置首行字段名')
                : '步骤 1/4：选择数据库类型 → 步骤 2/4：选择文件 → 步骤 3/4：设置字段 → 步骤 4/4：确定'}
            </div>
            {pendingImport && (
              <div data-testid="database-import-confirmation" style={{ border: '1px solid #BFD7E5', borderRadius: 8, padding: 10, background: '#F7FBFD' }}>
                <div style={{ fontSize: 12.5, marginBottom: 7 }}>已选择：{pendingImport.file.name}（预览 {pendingImport.preview.rows.length} 行）</div>
                {importType === 'text' ? (
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                    <label style={{ fontSize: 12, color: '#4B5563' }}>符号类型
                      <select data-testid="database-import-delimiter" value={textDelimiter} onChange={(e) => setTextDelimiter(e.target.value as TextDelimiter)} style={{ ...inputStyle, marginTop: 4 }}>
                        <option value="auto">自动识别</option>
                        <option value=",">逗号</option>
                        <option value="\t">制表符</option>
                        <option value=";">分号</option>
                      </select>
                    </label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 12, color: '#4B5563', paddingTop: 19 }}>
                      <input data-testid="database-import-header" type="checkbox" checked={textHasHeader} onChange={(e) => setTextHasHeader(e.target.checked)} />
                      首行包含字段名称
                    </label>
                  </div>
                ) : (
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                    <label style={{ fontSize: 12, color: '#4B5563' }}>可使用的表（数据页）
                      <select data-testid="database-import-sheet" value={excelSheet} onChange={(e) => setExcelSheet(e.target.value)} style={{ ...inputStyle, marginTop: 4 }}>
                        {pendingImport.sheetNames.map((sheet) => <option key={sheet} value={sheet}>{sheet}</option>)}
                      </select>
                    </label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 12, color: '#4B5563', paddingTop: 19 }}>
                      <input data-testid="database-import-excel-header" type="checkbox" checked={excelHasHeader} onChange={(e) => setExcelHasHeader(e.target.checked)} />
                      首行包含字段名称
                    </label>
                  </div>
                )}
                <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                  <button type="button" data-testid="database-import-confirm" onClick={() => void confirmFileImport()} style={{ padding: '6px 14px', borderRadius: 6, border: '1px solid #2E6E93', background: '#2E6E93', color: '#fff', cursor: 'pointer', fontSize: 12.5 }}>确定</button>
                  <button type="button" data-testid="database-import-cancel" onClick={() => { setPendingImport(null); setError('') }} style={{ padding: '6px 14px', borderRadius: 6, border: '1px solid #D5D4CD', background: '#fff', cursor: 'pointer', fontSize: 12.5 }}>取消</button>
                </div>
              </div>
            )}
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 14 }}>
            <button
              type="button"
              data-testid="database-import-select"
              onClick={() => fileRef.current?.click()}
              style={{ padding: '7px 14px', borderRadius: 8, border: '1px solid #2E6E93', background: '#2E6E93', color: '#fff', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}
            >
              {importConfigured && importType === 'text' ? '选择文本文件' : importConfigured && importType === 'excel' ? '选择 EXCEL 文件' : '导入 CSV / Excel'}
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

          <div data-testid="database-odbc-workflow" style={{ border: '1px solid #E4E3DD', borderRadius: 8, padding: 10, marginBottom: 12, background: '#FAFAF8' }}>
            <div data-testid="database-odbc-step" style={{ fontSize: 12, color: '#4B5563', marginBottom: 6 }}>ODBC 连接步骤：1/4 新建机器数据源 → 2/4 选择驱动程序 → 3/4 配置并测试连接 → 4/4 选表/查询并导入</div>
            <div style={{ fontSize: 11, color: '#6B7280', lineHeight: 1.6 }}>SQL Server 默认使用 Windows 身份验证；也可切换 SQL Server 身份验证。查询结果会作为数据库数据集供对象字段绑定。</div>
          </div>

          {!editing ? (
            <>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <span data-testid="database-connection-count" style={{ fontSize: 12, color: '#6B7280' }}>数据库连接（{connList.length}）</span>
                <button
                  type="button"
                  data-testid="database-connection-new"
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
                      <button type="button" data-testid={`database-connection-edit-${c.id}`} onClick={() => { setEditing({ ...c }); setSql(c.sql ?? 'SELECT * FROM [表名]'); setDbMsg('') }} style={{ fontSize: 12, color: '#2E6E93', background: 'none', border: 'none', cursor: 'pointer' }}>
                        编辑
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          const name = c.datasetName ?? c.name
                          doQueryImport(c, c.tableName?.trim() ? selectAllFromTable(c.tableName) : 'SELECT * FROM [表名]', name)
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
                  <input data-testid="database-connection-name" value={editing.name} onChange={(e) => patch({ name: e.target.value })} style={inputStyle} placeholder="如：生产系统" />
                </div>
                <div>
                  <div style={{ fontSize: 12, color: '#6B7280', marginBottom: 4 }}>驱动类型</div>
                  <select data-testid="database-connection-driver" value={editing.driver} onChange={(e) => patch({ driver: e.target.value as DbDriver })} style={inputStyle}>
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
                    <input data-testid="database-connection-dsn" value={editing.dsn ?? ''} onChange={(e) => patch({ dsn: e.target.value })} style={inputStyle} placeholder="系统/用户 DSN" />
                  </div>
                ) : editing.driver === 'sqlite' ? (
                  <div style={{ gridColumn: '1 / -1' }}>
                    <div style={{ fontSize: 12, color: '#6B7280', marginBottom: 4 }}>数据库文件路径 *</div>
                    <input data-testid="database-connection-file" value={editing.filePath ?? ''} onChange={(e) => patch({ filePath: e.target.value })} style={inputStyle} placeholder="C:\data\db.sqlite" />
                  </div>
                ) : (
                  <>
                    {editing.driver === 'sqlserver' && (
                      <div style={{ gridColumn: '1 / -1' }}>
                        <div style={{ fontSize: 12, color: '#6B7280', marginBottom: 4 }}>身份验证</div>
                        <select data-testid="database-connection-auth-mode" value={editing.authMode ?? 'windows'} onChange={(e) => patch({ authMode: e.target.value as DbConnectionConfig['authMode'] })} style={inputStyle}>
                          <option value="windows">Windows 身份验证</option>
                          <option value="sql">SQL Server 身份验证</option>
                        </select>
                      </div>
                    )}
                    <div>
                      <div style={{ fontSize: 12, color: '#6B7280', marginBottom: 4 }}>服务器</div>
                      <input data-testid="database-connection-server" value={editing.server ?? ''} onChange={(e) => patch({ server: e.target.value })} style={inputStyle} placeholder="localhost\\SQLEXPRESS 或 IP" />
                    </div>
                    <div>
                      <div style={{ fontSize: 12, color: '#6B7280', marginBottom: 4 }}>数据库</div>
                      <input data-testid="database-connection-database" value={editing.database ?? ''} onChange={(e) => patch({ database: e.target.value })} style={inputStyle} placeholder="数据库名" />
                    </div>
                    <div style={{ opacity: editing.driver === 'sqlserver' && (editing.authMode ?? 'windows') === 'windows' ? 0.55 : 1 }}>
                      <div style={{ fontSize: 12, color: '#6B7280', marginBottom: 4 }}>用户名</div>
                      <input data-testid="database-connection-user" disabled={editing.driver === 'sqlserver' && (editing.authMode ?? 'windows') === 'windows'} value={editing.user ?? ''} onChange={(e) => patch({ user: e.target.value })} style={inputStyle} placeholder="sa / root" />
                    </div>
                    <div style={{ opacity: editing.driver === 'sqlserver' && (editing.authMode ?? 'windows') === 'windows' ? 0.55 : 1 }}>
                      <div style={{ fontSize: 12, color: '#6B7280', marginBottom: 4 }}>密码</div>
                      <input data-testid="database-connection-password" disabled={editing.driver === 'sqlserver' && (editing.authMode ?? 'windows') === 'windows'} type="password" value={editing.password ?? ''} onChange={(e) => patch({ password: e.target.value })} style={inputStyle} />
                    </div>
                  </>
                )}
                {editing.driver !== 'sqlite' && editing.driver !== 'dsn' && (
                  <div style={{ gridColumn: '1 / -1' }}>
                    <div style={{ fontSize: 12, color: '#6B7280', marginBottom: 4 }}>可使用的表</div>
                    <input data-testid="database-connection-table" value={editing.tableName ?? ''} onChange={(e) => patch({ tableName: e.target.value })} style={inputStyle} placeholder="例如：Products；留空时使用下方 SQL" />
                  </div>
                )}
                <div style={{ gridColumn: '1 / -1' }}>
                  <div style={{ fontSize: 12, color: '#6B7280', marginBottom: 4 }}>查询 SQL（用于导入数据集）</div>
                  <textarea data-testid="database-connection-sql" value={sql} onChange={(e) => setSql(e.target.value)} rows={3} style={{ ...inputStyle, resize: 'vertical', fontFamily: 'Consolas, monospace' }} />
                </div>
                <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#1A1B1C' }}>
                  <input data-testid="database-connection-auto-refresh" type="checkbox" checked={!!editing.autoRefresh} onChange={(e) => patch({ autoRefresh: e.target.checked })} />
                  每次打印前自动刷新（数据库直连）
                </label>
                <div>
                  <div style={{ fontSize: 12, color: '#6B7280', marginBottom: 4 }}>导入的目标数据集名</div>
                  <input data-testid="database-connection-dataset" value={editing.datasetName ?? ''} onChange={(e) => patch({ datasetName: e.target.value })} style={inputStyle} placeholder="默认 = 连接名" />
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                <button type="button" data-testid="database-connection-test" onClick={doTest} disabled={busy} style={{ padding: '7px 14px', borderRadius: 8, border: '1px solid #D5D4CD', background: '#fff', cursor: 'pointer', fontSize: 13 }}>
                  测试连接
                </button>
                <button
                  type="button"
                  data-testid="database-connection-save-query"
                          onClick={() => {
                            const conn = { ...editing, datasetName: editing.datasetName || editing.name, sql: editing.tableName?.trim() ? selectAllFromTable(editing.tableName) : sql }
                            void doQueryImport(conn, conn.sql ?? sql, conn.datasetName).then((name) => {
                              if (!name) return
                              onConnectionSave(conn)
                              setEditing(null)
                              setDbMsg(`✓ 已导入数据集“${name}”并保存连接`)
                            }).catch((error) => {
                              setDbMsg('✗ 查询失败：' + (error instanceof Error ? error.message : String(error)))
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
