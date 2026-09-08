import { useState } from 'react'
import type { DataSource, Dataset } from '../types'
import { FormField } from './Modal'

interface Props {
  source: DataSource
  datasets: Record<string, Dataset>
  onChange: (s: DataSource) => void
  /** 附加数据源（子串）：对象数据 = 主数据源 + 各子串依次连接 */
  subSources?: DataSource[]
  onSubSources?: (list: DataSource[]) => void
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

const KIND_LABELS: Record<string, string> = {
  constant: '常量',
  serial: '序列号',
  database: '数据库',
  date: '日期',
  time: '时间',
  keyboard: '键盘输入',
  script: '脚本'
}

const DATE_FORMATS = ['yyyy-MM-dd', 'yyyy/MM/dd', 'MM/dd/yyyy', 'dd/MM/yyyy', 'yyyy年M月d日', 'M月d日', 'yyyyMMdd']
const TIME_FORMATS = ['HH:mm:ss', 'HH:mm', 'h:mm A', 'hh:mm:ss a', 'HH时mm分']

const SERIAL_CHARSETS = [
  { label: '数字（0123456789，补零）', value: '' },
  { label: '大写字母（A-Z）', value: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ' },
  { label: '小写字母（a-z）', value: 'abcdefghijklmnopqrstuvwxyz' },
  { label: '大写字母+数字', value: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789' },
  { label: '十六进制（0-9A-F）', value: '0123456789ABCDEF' },
  { label: '自定义字符集', value: '__custom__' }
]

function defaultSource(kind: string): DataSource {
  switch (kind) {
    case 'serial':
      return { kind: 'serial', prefix: '', start: 1, step: 1, digits: 1, current: 1, charset: '' }
    case 'database':
      return { kind: 'database', dataset: '', field: '' }
    case 'date':
      return { kind: 'date', format: 'yyyy-MM-dd' }
    case 'time':
      return { kind: 'time', format: 'HH:mm:ss' }
    case 'keyboard':
      return { kind: 'keyboard', label: '请输入数据：' }
    case 'script':
      return {
        kind: 'script',
        code: 'function OnGetData() {\n  return "脚本输出";\n}'
      }
    default:
      return { kind: 'constant', value: '' }
  }
}

function sourceKindLabel(s: DataSource): string {
  return KIND_LABELS[s.kind] ?? s.kind
}

/** 数据源编辑器：主数据源 + 附加数据源（子串）连接；支持多子串添加/删除/排序 */
export default function DataSourceEditor({ source, datasets, onChange, subSources = [], onSubSources }: Props) {
  // editIdx：null = 编辑主数据源；>=0 = 编辑对应子串
  const [editIdx, setEditIdx] = useState<number | null>(null)
  const curSource: DataSource = editIdx === null ? source : (subSources[editIdx] ?? source)
  const curKind = editIdx === null ? source.kind : curSource.kind
  const [kind, setKind] = useState<string>(curKind)

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
  const removeSub = (idx: number) => {
    if (!onSubSources) return
    const l = subSources.slice()
    l.splice(idx, 1)
    onSubSources(l)
    if (editIdx === idx) setEditIdx(null)
    else if (editIdx !== null && editIdx > idx) setEditIdx(editIdx - 1)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
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
        {Object.entries(KIND_LABELS).map(([k, label]) => (
          <button
            key={k}
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
        ))}
      </div>

      {(editIdx === null ? kind : curKind) === 'constant' && (
        <FormField label="常量内容" hint="固定文本，打印时原样输出">
          <input style={inputStyle} value={(curSource as { value?: string }).value ?? ''} onChange={(e) => curOnChange({ kind: 'constant', value: e.target.value })} />
        </FormField>
      )}

      {(editIdx === null ? kind : curKind) === 'serial' && (
        <>
          <div style={{ fontSize: 12, color: '#6B7280' }}>序列号在每次打印后自动递增，适合连续编号标签。</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <FormField label="前缀">
              <input style={numStyle} value={(curSource as { prefix?: string }).prefix ?? ''} onChange={(e) => curOnChange({ ...(curSource as object), prefix: e.target.value } as never)} />
            </FormField>
            <FormField label="字符集" hint="数字序列补零；字母/自定义序列按字符集进位">
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
            <FormField label="起始值">
              <input style={numStyle} type="number" value={(curSource as { start?: number }).start ?? 1} onChange={(e) => curOnChange({ ...(curSource as object), start: parseInt(e.target.value || '0', 10) } as never)} />
            </FormField>
            <FormField label="步长">
              <input style={numStyle} type="number" value={(curSource as { step?: number }).step ?? 1} onChange={(e) => curOnChange({ ...(curSource as object), step: parseInt(e.target.value || '1', 10) } as never)} />
            </FormField>
            <FormField label="位数">
              <input style={numStyle} type="number" min={1} max={12} value={(curSource as { digits?: number }).digits ?? 1} onChange={(e) => curOnChange({ ...(curSource as object), digits: parseInt(e.target.value || '1', 10) } as never)} />
            </FormField>
            <FormField label="当前值" hint="下一张标签打印的取值">
              <input style={numStyle} type="number" value={(curSource as { current?: number }).current ?? 1} onChange={(e) => curOnChange({ ...(curSource as object), current: parseInt(e.target.value || '0', 10) } as never)} />
            </FormField>
          </div>
          <div style={{ fontSize: 12, color: '#9CA3AF' }}>
            示例：前缀"NO."、起始 1、位数 3、步长 1 → NO.001、NO.002…；大写字母序列 1→A、2→B…、27→AA。
          </div>
        </>
      )}

      {(editIdx === null ? kind : curKind) === 'database' && (
        <>
          <FormField label="数据集" hint="在 数据库 → 数据管理 中添加数据集">
            <select style={inputStyle} value={(curSource as { dataset?: string }).dataset ?? ''} onChange={(e) => curOnChange({ kind: 'database', dataset: e.target.value, field: '' })}>
              <option value="">（请选择数据集）</option>
              {Object.keys(datasets).map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </FormField>
          <FormField label="字段" hint="标签文本取该字段的值，随记录逐行变化">
            <select
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
          <div style={{ fontSize: 12, color: '#9CA3AF' }}>打印数量指定输出记录数；可设置起始记录分段打印。</div>
        </>
      )}

      {editIdx !== null && (
        <FormField label="共享变量名" hint="命名该子串；其它对象使用相同共享变量名时，打印时引用同一份数据（对标原版“共享变量”）">
          <input style={inputStyle} value={(curSource as { sharedName?: string }).sharedName ?? ''} onChange={(e) => curOnChange({ ...(curSource as object), sharedName: e.target.value || undefined } as never)} placeholder="如 BatchNo" />
        </FormField>
      )}

      {(editIdx === null ? kind : curKind) === 'date' && (
        <>
          <FormField label="日期格式" hint="打印时输出当前日期">
            <select style={inputStyle} value={(curSource as { format?: string }).format ?? 'yyyy-MM-dd'} onChange={(e) => curOnChange({ ...(curSource as object), kind: 'date', format: e.target.value } as DataSource)}>
              {DATE_FORMATS.map((f) => (
                <option key={f} value={f}>
                  {f}
                </option>
              ))}
            </select>
          </FormField>
          <FormField label="日期偏移（天）" hint="正值=未来的日期，负值=过去的日期">
            <input type="number" style={inputStyle} value={(curSource as { offset?: number }).offset ?? 0} onChange={(e) => curOnChange({ ...(curSource as object), kind: 'date', offset: parseInt(e.target.value, 10) || 0 } as DataSource)} />
          </FormField>
        </>
      )}

      {(editIdx === null ? kind : curKind) === 'time' && (
        <>
          <FormField label="时间格式" hint="打印时输出当前时间">
            <select style={inputStyle} value={(curSource as { format?: string }).format ?? 'HH:mm:ss'} onChange={(e) => curOnChange({ ...(curSource as object), kind: 'time', format: e.target.value } as DataSource)}>
              {TIME_FORMATS.map((f) => (
                <option key={f} value={f}>
                  {f}
                </option>
              ))}
            </select>
          </FormField>
          <FormField label="时间偏移（分钟）" hint="正值=未来的时间，负值=过去的时间">
            <input type="number" style={inputStyle} value={(curSource as { offset?: number }).offset ?? 0} onChange={(e) => curOnChange({ ...(curSource as object), kind: 'time', offset: parseInt(e.target.value, 10) || 0 } as DataSource)} />
          </FormField>
        </>
      )}

      {(editIdx === null ? kind : curKind) === 'keyboard' && (
        <>
          <FormField label="输入方式" hint="键盘输入由操作员在打印时手工输入；电子称通过串口自动采集重量">
            <select
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
                  <input style={inputStyle} defaultValue={((curSource as { weighPort?: string }).weighPort ?? '') || 'COM1'} placeholder="串口号 COM1" onChange={(e) => curOnChange({ ...(curSource as object), kind: 'keyboard', weighPort: e.target.value } as never)} />
                  <select style={inputStyle} value={(curSource as { weighBaud?: string }).weighBaud ?? '9600'} onChange={(e) => curOnChange({ ...(curSource as object), kind: 'keyboard', weighBaud: e.target.value } as never)}>
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
                  <select style={inputStyle} value={(curSource as { weighUnit?: string }).weighUnit ?? 'kg'} onChange={(e) => curOnChange({ ...(curSource as object), kind: 'keyboard', weighUnit: e.target.value } as never)}>
                    <option value="g">克 g</option>
                    <option value="kg">千克 kg</option>
                    <option value="lb">磅 lb</option>
                    <option value="oz">盎司 oz</option>
                    <option value="jin">斤</option>
                  </select>
                </FormField>
                <FormField label="小数位数">
                  <input type="number" min={0} max={4} style={inputStyle} value={(curSource as { weighDecimals?: number }).weighDecimals ?? 2} onChange={(e) => curOnChange({ ...(curSource as object), kind: 'keyboard', weighDecimals: parseInt(e.target.value || '2', 10) } as never)} />
                </FormField>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: '#1A1B1C' }}>
                  <input type="checkbox" checked={(curSource as { weighAutoPrint?: boolean }).weighAutoPrint ?? false} onChange={(e) => curOnChange({ ...(curSource as object), kind: 'keyboard', weighAutoPrint: e.target.checked } as never)} />
                  重量采集后自动打印
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: '#1A1B1C' }}>
                  <input type="checkbox" checked={(curSource as { weighUnitConv?: boolean }).weighUnitConv ?? false} onChange={(e) => curOnChange({ ...(curSource as object), kind: 'keyboard', weighUnitConv: e.target.checked } as never)} />
                  自动换算到其他重量单位
                </label>
              </div>
              <div style={{ fontSize: 12, color: '#9CA3AF' }}>
                注：电子称需真实串口设备，此处为配置界面；采集逻辑需配套串口读卡硬件实现（当前为演示占位）。
              </div>
            </>
          )}
        </>
      )}

      {(editIdx === null ? kind : curKind) === 'script' && (
        <>
          <FormField label="脚本（JavaScript）" hint="定义 OnGetData() 返回标签文本；可用 V_PAGE/V_ROW/V_COL/V_TITLE 等全局变量">
            <textarea
              style={{ ...inputStyle, minHeight: 130, resize: 'vertical', fontFamily: 'Consolas, monospace', fontSize: 12.5 }}
              value={(curSource as { code?: string }).code ?? ''}
              onChange={(e) => curOnChange({ ...(curSource as object), code: e.target.value } as never)}
            />
          </FormField>
          <FormField label="共享变量名（可选）" hint="脚本返回值写入该变量，供后续脚本对象读取">
            <input style={inputStyle} value={(curSource as { sharedName?: string }).sharedName ?? ''} onChange={(e) => curOnChange({ ...(curSource as object), sharedName: e.target.value } as never)} />
          </FormField>
        </>
      )}

      {/* —— 附加数据源（子串）列表 —— */}
      <div style={{ borderTop: '1px solid #E4E3DD', paddingTop: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
          <span style={{ fontSize: 12.5, fontWeight: 600, color: '#1A1B1C' }}>附加数据源（子串）</span>
          <button
            type="button"
            onClick={addSub}
            style={{ padding: '4px 12px', borderRadius: 6, border: '1px solid #2E6E93', background: '#fff', color: '#2E6E93', cursor: 'pointer', fontSize: 12, fontFamily: 'inherit' }}
          >
            ＋ 添加子串
          </button>
        </div>
        <div style={{ fontSize: 12, color: '#9CA3AF', marginBottom: 8 }}>
          对象数据 = 主数据源 + 各子串依次连接。例如："单价" + 序列号 + "元"。
        </div>
        {subSources.length === 0 && <div style={{ fontSize: 12, color: '#C0BEB5' }}>（暂无子串）</div>}
        {subSources.map((s, i) => (
          <div
            key={i}
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
            <span style={{ width: 60, fontSize: 12, color: '#2E6E93', fontWeight: 600 }}>{sourceKindLabel(s)}</span>
            <span style={{ flex: 1, fontSize: 12, color: '#6B7280', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {sourcePreview(s)}
            </span>
            <span style={{ display: 'flex', gap: 2 }}>
              <button type="button" title="上移" onClick={(e) => { e.stopPropagation(); moveSub(i, -1) }} style={iconBtn}>↑</button>
              <button type="button" title="下移" onClick={(e) => { e.stopPropagation(); moveSub(i, 1) }} style={iconBtn}>↓</button>
              <button type="button" title="删除" onClick={(e) => { e.stopPropagation(); removeSub(i) }} style={{ ...iconBtn, color: '#D4380D' }}>×</button>
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
