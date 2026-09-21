import { useEffect, useState } from 'react'
import type { DataSource, Dataset, DbConnectionConfig, ScriptSource } from '../types'
import { serialText } from '../types'
import {
  CONTROL_CHAR_ENTRIES,
  DEFAULT_SCRIPT_LANGUAGE,
  PREDEFINED_SCRIPTS,
  SCRIPT_LANGUAGE_LABELS,
  SCRIPT_SCOPE_LABELS,
  checkScriptSyntax,
  type ScriptLanguageName,
  type ScriptScope
} from '../../../shared/domain/datasource'
import { FormField } from './Modal'

interface Props {
  source: DataSource
  datasets: Record<string, Dataset>
  connections?: Record<string, DbConnectionConfig>
  allowMultipleDatabaseConnections?: boolean
  onChange: (s: DataSource) => void
  /** 附加数据源（子串）：对象数据 = 主数据源 + 各子串依次连接 */
  subSources?: DataSource[]
  onSubSources?: (list: DataSource[]) => void
  /** 文档里已用过的共享变量名：真机这一格是**可编辑组合框**（下拉选已有名或手工输入） */
  sharedNames?: string[]
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '7px 9px',
  border: '1px solid #D5D4CD',
  borderRadius: 6,
  fontSize: 13,
  fontFamily: 'inherit',
  boxSizing: 'border-box'
}
const numStyle: React.CSSProperties = { ...inputStyle, width: 90 }
const selStyle: React.CSSProperties = { ...inputStyle, width: 220, maxWidth: '100%' }

const KIND_LABELS: Record<string, string> = {
  constant: '常量',
  serial: '序列号',
  date: '日期',
  time: '时间',
  database: '数据库',
  keyboard: '键盘输入',
  script: '脚本'
}
const KIND_ICONS: Record<string, string> = {
  constant: 'A',
  serial: '#',
  date: '日',
  time: '时',
  database: '▤',
  keyboard: '⌨',
  script: '{}'
}
const SOURCE_KIND_ORDER = ['constant', 'serial', 'date', 'time', 'database', 'keyboard', 'script'] as const

const DATE_FORMATS = ['yyyy年MM月dd日', 'yyyy年M月d日', 'yyyy-MM-dd', 'yyyy/MM/dd', 'MM/dd/yyyy', 'dd/MM/yyyy', 'yyyyMMdd']
const TIME_FORMATS = ['HH:mm:ss', 'HH:mm', 'H:mm:ss', 'H:mm', 'hh:mm:ss tt', 'hh:mm tt', 'mm:ss']
const TIME_REGIONS = [
  { value: 'default', label: '默认' },
  { value: 'Asia/Shanghai', label: '中国标准时间（北京时间）' },
  { value: 'UTC', label: '协调世界时（UTC）' },
  { value: 'America/New_York', label: '美国东部时间' }
]

/** 序列号「类型」对应的字符集序列（帮助 label_object_page_data_serial.html 的「序列」一行：
 *  「根据选择的类型显示字符集的所有字符排列」；10 进制就是 0-9，自定义类型显示用户输入串）。 */
function serialSequenceOf(charset: string | undefined): string {
  if (!charset) return '0123456789'
  return charset === '__custom__' ? '（自定义：在下方输入字符序列）' : charset
}
const SERIAL_CHARSETS = [
  { label: '10进制(数字)', value: '', charset: '0123456789' },
  { label: '26进制(字母)', value: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', charset: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ' },
  { label: '36进制(数字和字母)', value: '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ', charset: '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ' },
  { label: '16进制(0-9、A-F)', value: '0123456789ABCDEF', charset: '0123456789ABCDEF' },
  { label: '自定义', value: '__custom__', charset: '（自定义：在下方输入字符序列）' }
]

function defaultSource(kind: string): DataSource {
  switch (kind) {
    case 'serial':
      return { kind: 'serial', prefix: '', start: 1, step: 1, digits: 1, current: 1, charset: '', repeat: 1, repeatBasis: 'record', initialValueSource: 'default' }
    case 'database':
      return { kind: 'database', dataset: '', field: '', recordOffset: 0 }
    case 'date':
      return { kind: 'date', format: 'yyyy-MM-dd' }
    case 'time':
      return { kind: 'time', format: 'HH:mm:ss', region: 'default', offset: 0 }
    case 'keyboard':
      return { kind: 'keyboard', label: '请输入数据：' }
    case 'script':
      // 帮助 label_object_page_data_script.html：脚本语言目前只支持 VB Script。
      return {
        kind: 'script',
        language: DEFAULT_SCRIPT_LANGUAGE,
        scope: 'private',
        code: 'Function OnGetData()\n  \' VB Script：定义返回值，可用 V_PAGE/V_ROW/V_COL/V_TITLE 等全局变量\n  OnGetData = "脚本输出"\nEnd Function'
      }
    default:
      return { kind: 'constant', value: '' }
  }
}

function sourceKindLabel(s: DataSource): string {
  return KIND_LABELS[s.kind] ?? s.kind
}

/**
 * 脚本属性页（帮助 `label_object_page_data_script.html`）：
 * 脚本语言（目前只支持 VB Script）、语法检查、私有 / 公共 / 预定义脚本与出错处理说明。
 */
function ScriptFields({ source, onChange }: { source: ScriptSource; onChange: (s: DataSource) => void }) {
  const language: ScriptLanguageName = source.language ?? DEFAULT_SCRIPT_LANGUAGE
  const scope: ScriptScope = source.scope ?? 'private'
  const [checked, setChecked] = useState<{ ok: boolean; message: string } | null>(null)
  const patch = (p: Partial<ScriptSource>) => onChange({ ...source, ...p } as never)
  const setLanguage = (next: ScriptLanguageName) => {
    // 语言切换时同步替换默认模板，避免 VB 模板留在 JavaScript 模式下无法执行。
    const isSeedCode = /^\s*(?:function\s+OnGetData|Function\s+OnGetData)/i.test(source.code ?? '')
    const code = isSeedCode
      ? next === 'vbscript'
        ? 'Function OnGetData()\n  \' VB Script：定义返回值，可用 V_PAGE/V_ROW/V_COL/V_TITLE 等全局变量\n  OnGetData = "脚本输出"\nEnd Function'
        : 'function OnGetData() {\n  return "脚本输出";\n}'
      : source.code
    setChecked(null)
    patch({ language: next, code })
  }
  const predefined = PREDEFINED_SCRIPTS.find((p) => p.name === source.sharedName)
  return (
    <>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <FormField label="脚本语言" hint="目前只支持 VB Script；JavaScript 为等价兼容项">
          <select data-testid="script-language" style={selStyle} value={language} onChange={(e) => setLanguage(e.target.value as ScriptLanguageName)}>
            {(Object.keys(SCRIPT_LANGUAGE_LABELS) as ScriptLanguageName[]).map((k) => (
              <option key={k} value={k}>
                {SCRIPT_LANGUAGE_LABELS[k]}
              </option>
            ))}
          </select>
        </FormField>
        <FormField label="脚本范围" hint="私有脚本仅对本变量有效，公共脚本用于整个标签全局调用">
          <select
            data-testid="script-scope"
            style={selStyle}
            value={scope}
            onChange={(e) => {
              const next = e.target.value as ScriptScope
              const first = PREDEFINED_SCRIPTS[0]
              setChecked(null)
              if (next === 'predefined') patch({ scope: next, code: first.code, sharedName: first.name })
              else patch({ scope: next, sharedName: next === 'public' ? (source.sharedName ?? 'PublicScript') : undefined })
            }}
          >
            {(Object.keys(SCRIPT_SCOPE_LABELS) as ScriptScope[]).map((k) => (
              <option key={k} value={k}>
                {SCRIPT_SCOPE_LABELS[k]}
              </option>
            ))}
          </select>
        </FormField>
      </div>
      {scope === 'predefined' && (
        <FormField label="预定义脚本库" hint="程序提供的标准脚本库，系统预定义的脚本无法更改">
          <select
            data-testid="script-predefined-list"
            style={selStyle}
            value={predefined?.name ?? PREDEFINED_SCRIPTS[0].name}
            onChange={(e) => {
              const p = PREDEFINED_SCRIPTS.find((x) => x.name === e.target.value)
              if (p) patch({ code: p.code, sharedName: p.name })
            }}
          >
            {PREDEFINED_SCRIPTS.map((p) => (
              <option key={p.name} value={p.name}>
                {p.name} — {p.description}
              </option>
            ))}
          </select>
        </FormField>
      )}
      <FormField label="脚本内容" hint="定义 OnGetData() 返回标签文本；可用 V_PAGE/V_ROW/V_COL/V_TITLE 等全局变量">
        <textarea
          data-testid="script-code"
          readOnly={scope === 'predefined'}
          style={{ ...inputStyle, minHeight: 130, resize: 'vertical', fontFamily: 'Consolas, monospace', fontSize: 12.5, background: scope === 'predefined' ? '#F7F6F2' : '#fff' }}
          value={source.code ?? ''}
          onChange={(e) => patch({ code: e.target.value })}
        />
      </FormField>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <button
          type="button"
          data-testid="script-syntax-check"
          onClick={() => setChecked(checkScriptSyntax(source.code ?? '', language))}
          style={{ padding: '6px 14px', borderRadius: 6, border: '1px solid #2E6E93', background: '#fff', color: '#2E6E93', cursor: 'pointer', fontSize: 12.5, fontFamily: 'inherit' }}
        >
          语法检查
        </button>
        {checked && (
          <span data-testid="script-syntax-result" data-ok={checked.ok ? 'true' : 'false'} style={{ fontSize: 12, color: checked.ok ? '#2F7D4F' : '#EA6668' }}>
            {checked.message}
          </span>
        )}
      </div>
      <div data-testid="script-error-handling" style={{ fontSize: 12, color: '#6B7280' }}>
        出错处理：执行时出错（含语法错误）的脚本变量会被置为空字符串，不影响其余对象；若脚本造成程序停止响应，可在系统设置中关闭"允许运行脚本"后重新打开文档更正。
      </div>
    </>
  )
}

/** 非打印 ASCII 字符（ASCII 1–31）插入条，对应帮助的"支持直接输入非打印 ASCII 字符"。 */
function ControlCharBar({ onInsert }: { onInsert: (token: string) => void }) {
  return (
    <div data-testid="control-char-bar" style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 6 }}>
      {CONTROL_CHAR_ENTRIES.map((c) => (
        <button
          key={c.name}
          type="button"
          data-testid={`control-char-${c.code}`}
          title={`ASCII ${c.code} ${c.name}`}
          onClick={() => onInsert(`<${c.name}>`)}
          style={{ padding: '2px 6px', borderRadius: 4, border: '1px solid #D5D4CD', background: '#fff', cursor: 'pointer', fontSize: 11.5, fontFamily: 'Consolas, monospace' }}
        >
          {c.label}
        </button>
      ))}
    </div>
  )
}

/** 数据源编辑器：主数据源 + 附加数据源（子串）连接；支持多子串添加/删除/排序 */
export default function DataSourceEditor({ source, datasets, connections = {}, allowMultipleDatabaseConnections = false, onChange, subSources = [], onSubSources, sharedNames = [] }: Props) {
  // editIdx：null = 编辑主数据源；>=0 = 编辑对应子串
  const [editIdx, setEditIdx] = useState<number | null>(null)
  const curSource: DataSource = editIdx === null ? source : (subSources[editIdx] ?? source)
  const curKind = editIdx === null ? source.kind : curSource.kind
  const [kind, setKind] = useState<string>(curKind)

  // Keep the local button state aligned when the parent switches the edited
  // source or replaces the source object after normalization/import.
  useEffect(() => {
    setKind(curKind)
  }, [curKind, editIdx])

  const updateSub = (idx: number, s: DataSource) => {
    const l = subSources.slice()
    l[idx] = s
    onSubSources?.(l)
  }

  const curOnChange = (s: DataSource) => {
    if (editIdx === null) onChange(s)
    else updateSub(editIdx, s)
  }

  const pickKind = (k: string) => {
    if (k === (editIdx === null ? kind : curKind)) return
    setKind(k)
    curOnChange(defaultSource(k))
  }

  const addSub = () => {
    if (!onSubSources) return
    const l = subSources.slice()
    l.push({ kind: 'constant', value: '' })
    onSubSources(l)
    setEditIdx(l.length - 1)
  }
  const moveSub = (idx: number, dir: -1 | 1) => {
    if (!onSubSources) return
    const to = idx + dir
    if (to < 0 || to >= subSources.length) return
    const l = subSources.slice()
    const tmp = l[idx]
    l[idx] = l[to]
    l[to] = tmp
    onSubSources(l)
    setEditIdx(to)
  }
  /** 子串工具栏的"复制/粘贴"剪贴板（帮助 label_object_page_data.html 的子串工具栏六项）。 */
  const [subClipboard, setSubClipboard] = useState<DataSource | null>(null)
  const copySub = (idx: number) => {
    const s = subSources[idx]
    if (s) setSubClipboard({ ...s })
  }
  const removeSub = (idx: number) => {
    if (!onSubSources) return
    const l = subSources.slice()
    l.splice(idx, 1)
    onSubSources(l)
    if (editIdx === idx) setEditIdx(null)
    else if (editIdx !== null && editIdx > idx) setEditIdx(editIdx - 1)
  }

  return (
    <div data-testid="data-source-editor" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {/* 当前编辑源标题 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ fontSize: 12.5, fontWeight: 600, color: '#1A1B1C' }}>
          {editIdx === null ? '主数据源' : `子串 ${editIdx + 1}`}
        </span>
        {editIdx !== null && (
          <button type="button" onClick={() => setEditIdx(null)} style={{ padding: '3px 10px', borderRadius: 6, border: '1px solid #D5D4CD', background: '#fff', color: '#2E6E93', cursor: 'pointer', fontSize: 12, fontFamily: 'inherit' }}>
            ← 返回主数据源
          </button>
        )}
      </div>

      {/* 类型选择 */}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {SOURCE_KIND_ORDER.map((k) => {
          const label = KIND_LABELS[k]
          return (
          <button
            key={k}
            data-testid={`source-kind-${k}`}
            type="button"
            onClick={() => pickKind(k)}
            style={{
              padding: '5px 12px',
              borderRadius: 6,
              border: (editIdx === null ? kind : curKind) === k ? '1px solid #2E6E93' : '1px solid #D5D4CD',
              background: (editIdx === null ? kind : curKind) === k ? '#E8F1F6' : '#fff',
              color: (editIdx === null ? kind : curKind) === k ? '#2E6E93' : '#4B5563',
              cursor: 'pointer',
              fontSize: 12.5,
              fontFamily: 'inherit'
            }}
          >
            {label}
          </button>
          )
        })}
      </div>

      {(editIdx === null ? kind : curKind) === 'constant' && (
        <FormField label="常量内容" hint="固定文本，打印时原样输出；支持 <HT>/<CR>/<LF>，输入 <<HT> 表示字面 <HT>">
          <input data-testid="constant-source-value" style={inputStyle} value={(curSource as { value?: string }).value ?? ''} onChange={(e) => curOnChange({ kind: 'constant', value: e.target.value })} />
          <ControlCharBar onInsert={(token) => curOnChange({ kind: 'constant', value: `${(curSource as { value?: string }).value ?? ''}${token}` })} />
        </FormField>
      )}

      {(editIdx === null ? kind : curKind) === 'serial' && (
        <>
          <div data-testid="serial-settings" style={{ fontSize: 12, color: '#6B7280' }}>序列号（计数器）按标签顺序变化；实际打印完成后才推进并回写模板。</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <FormField label="显示数据前缀">
              <input style={numStyle} value={(curSource as { prefix?: string }).prefix ?? ''} onChange={(e) => curOnChange({ ...(curSource as object), prefix: e.target.value } as never)} />
            </FormField>
            <FormField label="类型(&T):" hint="序列号字符集；默认是 10 进制（数字）">
              <select
                style={numStyle}
                value={(curSource as { charset?: string }).charset ?? ''}
                onChange={(e) => {
                  const v = e.target.value
                  curOnChange({ ...(curSource as object), charset: v === '__custom__' ? 'ABCDEFGHIJKLMNOPQRSTUVWXYZ' : v } as never)
                }}
              >
                {SERIAL_CHARSETS.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.label}
                  </option>
                ))}
              </select>
            </FormField>
            {/* 帮助 label_object_page_data_serial.html：「序列：根据选择的类型显示字符集的所有字符排列」 */}
            <FormField label="序列(&Q):" hint="当前类型对应的字符集序列（帮助：根据选择的类型显示字符集的所有字符排列）">
              <input
                data-testid="serial-sequence"
                readOnly
                style={{ ...numStyle, background: '#F4F3EE', color: '#4B5563' }}
                value={serialSequenceOf((curSource as { charset?: string }).charset)}
              />
            </FormField>
            <FormField label="显示数据">
              <input data-testid="serial-current" style={numStyle} type="number" value={(curSource as { current?: number }).current ?? 1} onChange={(e) => curOnChange({ ...(curSource as object), current: parseInt(e.target.value || '0', 10) } as never)} />
            </FormField>
            <FormField label="序列起始值" hint="默认使用显示数据；用于设置回写后的基准值">
              <input style={numStyle} type="number" value={(curSource as { start?: number }).start ?? 1} onChange={(e) => curOnChange({ ...(curSource as object), start: parseInt(e.target.value || '1', 10) } as never)} />
            </FormField>
            <FormField label="步长(&S):" hint="正数为增量，负数为减量">
              <input style={numStyle} type="number" min={-1000000000} max={1000000000} step={1} value={(curSource as { step?: number }).step ?? 1} onChange={(e) => curOnChange({ ...(curSource as object), step: parseInt(e.target.value || '1', 10) } as never)} />
            </FormField>
            <FormField label="位数" hint="10 进制数字的补零位数">
              <input style={numStyle} type="number" min={1} max={64} value={(curSource as { digits?: number }).digits ?? 1} onChange={(e) => curOnChange({ ...(curSource as object), digits: Math.max(1, Math.min(64, parseInt(e.target.value || '1', 10))) } as never)} />
            </FormField>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <FormField label="重复(&E):" hint="相同序列值连续打印的数量，范围 1–1000000">
              <input style={numStyle} type="number" min={1} max={1000000} step={1} value={(curSource as { repeat?: number }).repeat ?? 1} onChange={(e) => curOnChange({ ...(curSource as object), repeat: Math.max(1, Math.min(1000000, parseInt(e.target.value || '1', 10))) } as never)} />
            </FormField>
            <FormField label="变化基准">
              <select style={inputStyle} value={(curSource as { repeatBasis?: string }).repeatBasis ?? 'record'} onChange={(e) => curOnChange({ ...(curSource as object), repeatBasis: e.target.value } as never)}>
                <option value="record">记录数</option>
                <option value="label">标签数</option>
              </select>
            </FormField>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <FormField label="初始值来源(&R):">
              <select style={inputStyle} value={(curSource as { initialValueSource?: string }).initialValueSource ?? 'default'} onChange={(e) => curOnChange({ ...(curSource as object), initialValueSource: e.target.value } as never)}>
                <option value="default">默认</option>
                <option value="keyboard">键盘输入</option>
                <option value="database">数据库字段</option>
              </select>
            </FormField>
            <FormField label="初始值字段" hint="选择键盘输入提示名或当前数据集字段">
              <select style={inputStyle} value={(curSource as { initialValueField?: string }).initialValueField ?? ''} onChange={(e) => curOnChange({ ...(curSource as object), initialValueField: e.target.value } as never)}>
                <option value="">（未指定）</option>
                {Object.keys(datasets).flatMap((name) => datasets[name].columns.map((field) => <option key={`${name}.${field}`} value={field}>{name}.{field}</option>))}
              </select>
            </FormField>
          </div>
          {/* DIFF-63：真机「序列号设置」里**只有一个** `重置` 按钮，且在全部可达状态下恒为禁用
              （`PROBE-verifier-round88-DIFF63-serial.md` 控件树 `[V] class=Button DISABLED text='重置'`；
              round-104 又确认资源里的「重置初始值:」「立即重置」是**隐藏**控件、无用户可达路径）。
              复刻版此前既没有「重置」也没有「立即重置」——这里按真机的**可见形态**补上这一个按钮，
              并**保持禁用**（真机本机观测恒禁用，启用条件未知，按待取证处理：不猜一个启用条件，
              不给它编造行为）。真机是**隐藏**控件的「重置初始值:」「立即重置」不落地（与「应用(&A)」同款口径）。 */}
          <div>
            <button type="button" data-testid="serial-reset" disabled style={{ padding: '5px 16px', borderRadius: 6, border: '1px solid #D5D4CD', background: '#F4F3EE', color: '#B0AFA9', cursor: 'not-allowed', fontSize: 12.5, fontFamily: 'inherit' }}>重置</button>
          </div>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: '#1A1B1C' }}>
            <input type="checkbox" checked={(curSource as { resetEachRecord?: boolean }).resetEachRecord === true} onChange={(e) => curOnChange({ ...(curSource as object), resetEachRecord: e.target.checked } as never)} />
            按标签变化时每条记录开始复位到初始值
          </label>
          <div data-testid="serial-preview" style={{ fontSize: 12, color: '#9CA3AF' }}>
            示例：{serialText(curSource as Extract<DataSource, { kind: 'serial' }>, 1)} → {serialText(curSource as Extract<DataSource, { kind: 'serial' }>, 2)}
          </div>
        </>
      )}

      {(editIdx === null ? kind : curKind) === 'database' && (
        <>
          {allowMultipleDatabaseConnections && Object.keys(connections).length > 0 && (
            <FormField label="数据库连接" hint="启用多个数据库连接后，选择当前数据源使用的连接">
              <select
                data-testid="database-connection-selector"
                style={inputStyle}
                value={(curSource as { connectionId?: string }).connectionId ?? ''}
                onChange={(e) => curOnChange({ ...(curSource as object), kind: 'database', connectionId: e.target.value || undefined } as DataSource)}
              >
                <option value="">（默认连接）</option>
                {Object.values(connections).map((connection) => <option key={connection.id} value={connection.id}>{connection.name}</option>)}
              </select>
            </FormField>
          )}
          <FormField label="数据集" hint="在 数据库 → 数据管理 中添加数据集">
            <select style={inputStyle} value={(curSource as { dataset?: string }).dataset ?? ''} onChange={(e) => curOnChange({ ...(curSource as object), kind: 'database', dataset: e.target.value, field: '' } as DataSource)}>
              <option value="">（请选择数据集）</option>
              {Object.keys(datasets).map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </FormField>
          <FormField label="字段名" hint="指定当前子串从数据库中的哪个字段引入数据">
            <select
              data-testid="database-field"
              style={inputStyle}
              value={(curSource as { field?: string }).field ?? ''}
              disabled={!((curSource as { dataset?: string }).dataset && datasets[(curSource as { dataset?: string }).dataset ?? ''])}
              onChange={(e) => curOnChange({ ...(curSource as object), field: e.target.value } as never)}
            >
              <option value="">（请选择字段）</option>
              {(() => {
                const ds = datasets[(curSource as { dataset?: string }).dataset ?? ''] as Dataset | undefined
                return ds ? ds.columns.map((f: string) => (
                  <option key={f} value={f}>
                    {f}
                  </option>
                )) : null
              })()}
            </select>
          </FormField>
          <FormField label="单标签记录" hint="同一标签使用多条记录时，选择从当前记录起使用第几条记录">
            <select
              data-testid="database-record-offset"
              style={inputStyle}
              value={String(((curSource as { recordOffset?: number }).recordOffset ?? 0) + 1)}
              onChange={(e) => curOnChange({ ...(curSource as object), recordOffset: Math.max(0, parseInt(e.target.value || '1', 10) - 1) } as never)}
            >
              {Array.from({ length: Math.max(10, Math.min(100, datasets[(curSource as { dataset?: string }).dataset ?? '']?.rows.length ?? 0)) }, (_, index) => (
                <option key={index} value={index + 1}>第 {index + 1} 条记录</option>
              ))}
            </select>
          </FormField>
          <div style={{ fontSize: 12, color: '#9CA3AF' }}>打印数量指定输出记录数；可设置起始记录分段打印。</div>
        </>
      )}

      {editIdx !== null && (
        <FormField label="共享变量名" hint="命名该子串；其它对象使用相同共享变量名时，打印时引用同一份数据（对标原版“共享变量”）">
          <input
            data-testid="shared-source-name"
            list="maxlabel-shared-names"
            style={inputStyle}
            value={(curSource as { sharedName?: string }).sharedName ?? ''}
            onChange={(e) => curOnChange({ ...(curSource as object), sharedName: e.target.value || undefined } as never)}
            placeholder="如 BatchNo（可从下拉选已有名）"
          />
          {/* 真机这一格是可编辑组合框：下拉列出文档里已用过的共享名，也可直接手输新名 */}
          <datalist id="maxlabel-shared-names" data-testid="shared-source-name-options">
            {(sharedNames ?? []).map((name) => <option key={name} value={name} />)}
          </datalist>
        </FormField>
      )}

      {(editIdx === null ? kind : curKind) === 'date' && (
        <>
          <FormField label="日期格式" hint="打印时输出当前日期">
            <select data-testid="date-format" style={inputStyle} value={(curSource as { format?: string }).format ?? 'yyyy-MM-dd'} onChange={(e) => curOnChange({ ...(curSource as object), kind: 'date', format: e.target.value } as DataSource)}>
              {DATE_FORMATS.map((f) => (
                <option key={f} value={f}>
                  {f}
                </option>
              ))}
            </select>
          </FormField>
          <FormField label="日期偏移（天）" hint="正值=未来的日期，负值=过去的日期">
            <input data-testid="date-offset" type="number" min={-1000000} max={1000000} step={1} style={inputStyle} value={(curSource as { offset?: number }).offset ?? 0} onChange={(e) => curOnChange({ ...(curSource as object), kind: 'date', offset: parseInt(e.target.value, 10) || 0 } as DataSource)} />
          </FormField>
        </>
      )}

      {(editIdx === null ? kind : curKind) === 'time' && (
        <>
          <FormField label="时间格式" hint="打印时输出当前时间">
            <select data-testid="time-format" style={inputStyle} value={(curSource as { format?: string }).format ?? 'HH:mm:ss'} onChange={(e) => curOnChange({ ...(curSource as object), kind: 'time', format: e.target.value } as DataSource)}>
              {TIME_FORMATS.map((f) => (
                <option key={f} value={f}>
                  {f}
                </option>
              ))}
            </select>
          </FormField>
          <FormField label="区域" hint="指定国家和地区的时区；默认跟随系统">
            <select data-testid="time-region" style={inputStyle} value={(curSource as { region?: string }).region ?? 'default'} onChange={(e) => curOnChange({ ...(curSource as object), kind: 'time', region: e.target.value } as DataSource)}>
              {TIME_REGIONS.map((region) => <option key={region.value} value={region.value}>{region.label}</option>)}
            </select>
          </FormField>
          <FormField label="时间偏移（分钟）" hint="正值=未来的时间，负值=过去的时间">
            <input data-testid="time-offset" type="number" min={-1000000} max={1000000} step={1} style={inputStyle} value={(curSource as { offset?: number }).offset ?? 0} onChange={(e) => curOnChange({ ...(curSource as object), kind: 'time', offset: parseInt(e.target.value, 10) || 0 } as DataSource)} />
          </FormField>
        </>
      )}

      {(editIdx === null ? kind : curKind) === 'keyboard' && (
        <>
          <FormField label="提示" hint="仅在打印作业开始时请求输入；所有输出标签共用这次输入值">
            <input
              data-testid="keyboard-label"
              style={inputStyle}
              value={(curSource as { label?: string }).label ?? ''}
              onChange={(e) => curOnChange({ ...(curSource as object), kind: 'keyboard', label: e.target.value } as never)}
              placeholder="例如：批次号、包裹重量"
            />
          </FormField>
          <FormField label="输入方式" hint="键盘输入由操作员在打印时手工输入；电子称通过串口自动采集重量">
            <select
              data-testid="keyboard-input-device"
              style={inputStyle}
              value={(curSource as { inputDevice?: string }).inputDevice ?? 'keyboard'}
              onChange={(e) => curOnChange({ ...(curSource as object), kind: 'keyboard', inputDevice: e.target.value } as never)}
            >
              <option value="keyboard">键盘输入</option>
              <option value="weigh">电子称（串口重量采集）</option>
            </select>
          </FormField>
          {((curSource as { inputDevice?: string }).inputDevice ?? 'keyboard') === 'weigh' && (
            <>
              <FormField label="电子称协议">
                <select
                  style={inputStyle}
                  value={(curSource as { weighProtocol?: string }).weighProtocol ?? 'kasda'}
                  onChange={(e) => curOnChange({ ...(curSource as object), kind: 'keyboard', weighProtocol: e.target.value } as never)}
                >
                  <option value="kasda">凯士达 KASDA</option>
                  <option value="tonde">拓德 TONDE</option>
                  <option value="ad">顶尖 A&D</option>
                  <option value="mettler">梅特勒 Mettler</option>
                  <option value="ohaus">奥豪斯 Ohaus</option>
                  <option value="sartorius">赛多利斯 Sartorius</option>
                  <option value="standard">标准连续输出</option>
                  <option value="custom">自定义（未收录协议需兼容性扩展）</option>
                </select>
              </FormField>
              <FormField label="串口参数">
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                  <input data-testid="weigh-port" style={inputStyle} value={((curSource as { weighPort?: string }).weighPort ?? '') || 'COM1'} placeholder="串口号 COM1" onChange={(e) => curOnChange({ ...(curSource as object), kind: 'keyboard', weighPort: e.target.value } as never)} />
                  <select data-testid="weigh-baud" style={inputStyle} value={(curSource as { weighBaud?: string }).weighBaud ?? '9600'} onChange={(e) => curOnChange({ ...(curSource as object), kind: 'keyboard', weighBaud: e.target.value } as never)}>
                    <option value="2400">2400</option>
                    <option value="4800">4800</option>
                    <option value="9600">9600</option>
                    <option value="19200">19200</option>
                    <option value="38400">38400</option>
                  </select>
                </div>
              </FormField>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                <FormField label="重量单位">
                  <select data-testid="weigh-unit" style={inputStyle} value={(curSource as { weighUnit?: string }).weighUnit ?? 'kg'} onChange={(e) => curOnChange({ ...(curSource as object), kind: 'keyboard', weighUnit: e.target.value } as never)}>
                    <option value="g">克 g</option>
                    <option value="kg">千克 kg</option>
                    <option value="lb">磅 lb</option>
                    <option value="oz">盎司 oz</option>
                    <option value="jin">斤</option>
                  </select>
                </FormField>
                <FormField label="小数位数">
                  <input data-testid="weigh-decimals" type="number" min={0} max={4} style={inputStyle} value={(curSource as { weighDecimals?: number }).weighDecimals ?? 2} onChange={(e) => curOnChange({ ...(curSource as object), kind: 'keyboard', weighDecimals: Math.max(0, Math.min(4, parseInt(e.target.value || '2', 10) || 0)) } as never)} />
                </FormField>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: '#1A1B1C' }}>
                  <input data-testid="weigh-auto-print" type="checkbox" checked={(curSource as { weighAutoPrint?: boolean }).weighAutoPrint ?? false} onChange={(e) => curOnChange({ ...(curSource as object), kind: 'keyboard', weighAutoPrint: e.target.checked } as never)} />
                  重量采集后自动打印
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: '#1A1B1C' }}>
                  <input data-testid="weigh-unit-conv" type="checkbox" checked={(curSource as { weighUnitConv?: boolean }).weighUnitConv ?? false} onChange={(e) => curOnChange({ ...(curSource as object), kind: 'keyboard', weighUnitConv: e.target.checked } as never)} />
                  自动换算到其他重量单位
                </label>
              </div>
              <div style={{ fontSize: 12, color: '#9CA3AF' }}>
                注：电子称需真实串口设备，此处为连接配置界面；采集逻辑需配套串口读卡硬件。
              </div>
            </>
          )}
        </>
      )}

      {(editIdx === null ? kind : curKind) === 'script' && (
        <>
          <ScriptFields source={curSource as ScriptSource} onChange={curOnChange} />
          <FormField label="共享变量名（可选）" hint="脚本返回值写入该变量，供后续脚本对象读取">
            <input style={inputStyle} value={(curSource as { sharedName?: string }).sharedName ?? ''} onChange={(e) => curOnChange({ ...(curSource as object), sharedName: e.target.value } as never)} />
          </FormField>
        </>
      )}

      {/* —— 附加数据源（子串）列表 —— */}
      <div data-testid="source-substring-list" style={{ borderTop: '1px solid #E4E3DD', paddingTop: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
          <span style={{ fontSize: 12.5, fontWeight: 600, color: '#1A1B1C' }}>附加数据源（子串）</span>
          <span style={{ display: 'flex', gap: 6 }}>
          <button
            type="button"
            data-testid="source-substring-paste"
            disabled={!subClipboard}
            title="粘贴"
            onClick={() => {
              if (!onSubSources || !subClipboard) return
              const l = subSources.slice()
              l.push({ ...subClipboard })
              onSubSources(l)
              setEditIdx(l.length - 1)
            }}
            style={{ padding: '4px 10px', borderRadius: 6, border: '1px solid #D5D4CD', background: subClipboard ? '#fff' : '#F4F5F6', color: subClipboard ? '#2E6E93' : '#B9B7AE', cursor: subClipboard ? 'pointer' : 'default', fontSize: 12, fontFamily: 'inherit' }}
          >
            粘贴
          </button>
          <button
            type="button"
            data-testid="source-substring-add"
            onClick={addSub}
            style={{ padding: '4px 12px', borderRadius: 6, border: '1px solid #2E6E93', background: '#fff', color: '#2E6E93', cursor: 'pointer', fontSize: 12, fontFamily: 'inherit' }}
          >
            ＋ 添加子串
          </button>
          </span>
        </div>
        <div style={{ fontSize: 12, color: '#9CA3AF', marginBottom: 8 }}>
          对象数据 = 主数据源 + 各子串依次连接。例如："单价" + 序列号 + "元"。
        </div>
        {subSources.length === 0 && <div style={{ fontSize: 12, color: '#C0BEB5' }}>（暂无子串）</div>}
        {subSources.map((s, i) => (
          <div
            key={i}
            data-testid={`source-substring-${i}`}
            onClick={() => setEditIdx(i)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '6px 8px',
              marginBottom: 6,
              borderRadius: 6,
              border: editIdx === i ? '1px solid #2E6E93' : '1px solid #E4E3DD',
              background: editIdx === i ? '#E8F1F6' : '#FAFAF7',
              cursor: 'pointer'
            }}
          >
            <span aria-hidden="true" style={{ width: 24, height: 20, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', borderRadius: 4, background: '#E8F1F6', color: '#2E6E93', fontSize: 11, fontWeight: 700 }}>{KIND_ICONS[s.kind] ?? '?'}</span>
            <span style={{ width: 54, fontSize: 12, color: '#2E6E93', fontWeight: 600 }}>{sourceKindLabel(s)}</span>
            <span data-testid={`source-substring-preview-${i}`} style={{ flex: 1, fontSize: 12, color: '#6B7280', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {sourcePreview(s)}
            </span>
            <span style={{ display: 'flex', gap: 2 }}>
              <button type="button" data-testid={`source-substring-copy-${i}`} title="复制" onClick={(e) => { e.stopPropagation(); copySub(i) }} style={iconBtn}>⧉</button>
              <button type="button" data-testid={`source-substring-move-up-${i}`} title="上移" onClick={(e) => { e.stopPropagation(); moveSub(i, -1) }} style={iconBtn}>↑</button>
              <button type="button" data-testid={`source-substring-move-down-${i}`} title="下移" onClick={(e) => { e.stopPropagation(); moveSub(i, 1) }} style={iconBtn}>↓</button>
              <button type="button" data-testid={`source-substring-remove-${i}`} title="删除" onClick={(e) => { e.stopPropagation(); removeSub(i) }} style={{ ...iconBtn, color: '#D4380D' }}>×</button>
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

const iconBtn: React.CSSProperties = {
  padding: '2px 6px',
  borderRadius: 4,
  border: '1px solid #E4E3DD',
  background: '#fff',
  color: '#4B5563',
  cursor: 'pointer',
  fontSize: 11,
  fontFamily: 'inherit',
  lineHeight: '1.2'
}

function sourcePreview(s: DataSource): string {
  switch (s.kind) {
    case 'constant':
      return (s as { value?: string }).value ?? ''
    case 'serial':
      return `${(s as { prefix?: string }).prefix ?? ''}${(s as { current?: number }).current ?? 1}`
    case 'database':
      return `${(s as { dataset?: string }).dataset ?? ''}.${(s as { field?: string }).field ?? ''}`
    case 'date':
      return `日期(${(s as { format?: string }).format ?? 'yyyy-MM-dd'})`
    case 'time':
      return `时间(${(s as { format?: string }).format ?? 'HH:mm:ss'})`
    case 'keyboard':
      return (s as { label?: string }).label ?? '键盘输入'
    case 'script':
      return (s as { sharedName?: string }).sharedName ? `脚本→${(s as { sharedName?: string }).sharedName}` : '脚本'
    default:
      return ''
  }
}
