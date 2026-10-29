import { useEffect, useRef, useState } from 'react'
import type { DataSource, Dataset, DbConnectionConfig, ScriptSource } from '../types'
import type { KeyboardSource } from '../../../shared/domain/datasource'
import {
  DEFAULT_SCRIPT_LANGUAGE,
  PREDEFINED_SCRIPTS,
  SCRIPT_LANGUAGE_LABELS,
  SCRIPT_SCOPE_LABELS,
  checkScriptSyntax,
  type ScriptLanguageName,
  type ScriptScope
} from '../../../shared/domain/datasource'
import { FormField } from './Modal'
import InsertCharDialog from './InsertCharDialog'
import LText from '../features/i18n/LText'
import { useI18n } from '../features/i18n/useI18n'
import { useEntitlements } from '../features/entitlement/useEntitlements'
import { dataSourceKindAllowed } from '../../../shared/domain/entitlement'
import { formatDateLike } from '../../../shared/domain/datasource'
import { localizePropertyLabel } from '../../../shared/i18n/property.en-US'
import { localizeIpcMessage, translate } from '../../../shared/i18n/translate'
import type { ScaleProtocol, ScaleTestResult, WeighUnit } from '../../../shared/scale/types'
import { diagnosticFrames } from '../features/scale/diagnostics'
import { withWeighDefaults } from '../features/scale/config'

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
  /**
   * `'panel'`（默认）：右侧停靠面板用的竖排编辑器，自带主/子串切换与子串列表。
   * `'fields'`：只渲染「子串选项」——数据源下拉 + 该类型的字段 + 变量共享名称，
   * 供「条码属性 → 数据源」页按原版布局（左列表 / 右选项 / 底部示例）自行组织。
   */
  layout?: 'panel' | 'fields'
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

export const KIND_LABELS: Record<string, string> = {
  constant: '常量',
  serial: '序列号',
  date: '日期',
  time: '时间',
  database: '数据库',
  keyboard: '键盘输入',
  script: '脚本'
}
export const KIND_ICONS: Record<string, string> = {
  constant: 'A',
  serial: '#',
  date: '日',
  time: '时',
  database: '▤',
  keyboard: '⌨',
  script: '{}'
}
const SOURCE_KIND_ORDER = ['constant', 'serial', 'date', 'time', 'database', 'keyboard', 'script'] as const

// 原版「日期格式」下拉：每项显示按当天格式化后的样子，括号里是格式说明。
const DATE_FORMATS: Array<{ value: string; label: string }> = [
  { value: 'yyyy年MM月dd日', label: '' },
  { value: 'yyyy-MM-dd', label: '年-月-日' },
  { value: 'MM-dd-yy', label: '月-日-年' },
  { value: 'dd-MM-yy', label: '日-月-年' },
  { value: 'MMMM dd, yyyy', label: '' },
  { value: 'dddd, dd MMMM, yyyy', label: '' },
  { value: 'dd MMMM, yyyy', label: '' },
  { value: 'dd-MMM-yy', label: '' },
  { value: 'MMMM, yy', label: '' },
  { value: 'MMM, yy', label: '' },
  { value: 'DDD', label: '一年中的第几天' },
  { value: 'yyMMdd', label: '年 月 日' },
  { value: 'yyMM00', label: '年 月 00' },
  { value: 'MM', label: '月：2 位数字' },
  { value: 'M', label: '月：1-2 位数字' },
  { value: 'MMMM', label: '月' },
  { value: 'MMM', label: '月：缩写' },
  { value: 'dd', label: '天：2 位数字' },
  { value: 'd', label: '天：1-2 位数字' },
  { value: 'y', label: '年：1 位数字' },
  { value: 'yy', label: '年：2 位数字' },
  { value: 'yyy', label: '年：1-2 位数字' },
  { value: 'yyyy', label: '年：3 位数字' },
  { value: 'YYYY', label: '年：4 位数字' },
  { value: 'e', label: '周中第几天:周日是 0' },
  { value: 'ww', label: '年周数:2位数字' },
  { value: 'w', label: '年周数:1-2位数字' },
  { value: 'dddd', label: '' },
  { value: 'dd.MM.yy', label: '日.月.两位年' },
  { value: 'yy-MM-dd', label: '年-月-日' },
  { value: 'yy/MM/dd', label: '年/月/日' },
  { value: 'dd.MM.yyyy', label: '日 月 四位年' },
  { value: 'MM/dd/yy', label: '月/日/年' },
  { value: 'dd/MM/yy', label: '日/月/年' },
  { value: 'WW', label: '周数:一周始于周一' },
  { value: 'E', label: '周中第几天:周日是7' },
  { value: 'ddd', label: '' }
]
// 原版「时间格式」下拉：每项显示按当前时间格式化后的样子。
const TIME_FORMATS: Array<{ value: string; label: string }> = [
  { value: 'HH:mm:ss', label: '24 小时制' },
  { value: 'hh:mm', label: '12 小时制' },
  { value: 'hh:mm:ss', label: '12 小时制' },
  { value: 'hh:mm:ss tt', label: '12 小时制' },
  { value: 'HH:mm tt', label: '24 小时制' },
  { value: 'HH:mm', label: '24 小时制' },
  { value: 'hh:mm tt', label: '12 小时制' },
  { value: 'HH:mm:ss tt', label: '24 小时制' },
  { value: 'hh', label: '12 小时制:2 位数字' },
  { value: 'h', label: '12 小时制:1-2 位数字' },
  { value: 'HH', label: '24 小时制:2 位数字' },
  { value: 'H', label: '24 小时制:1-2 位数字' },
  { value: 'mm', label: '分钟:2 位数字' },
  { value: 'm', label: '分钟:1-2 位数字' },
  { value: 'ss', label: '秒:2 位数字' },
  { value: 's', label: '秒:1-2 位数字' },
  { value: 'tt', label: '上午 / 下午' }
]
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
  // 边界值：不按字符集推进，而是给定起点/终点，打印越界时整单中止。
  { label: '边界值', value: '__boundary__', charset: '' },
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
  useEffect(() => { setChecked(null) }, [source.code, language, scope])
  const patch = (p: Partial<ScriptSource>) => { setChecked(null); onChange({ ...source, ...p } as never) }
  const setLanguage = (next: ScriptLanguageName) => {
    // 语言切换时同步替换默认模板，避免 VB 模板留在 JavaScript 模式下无法执行。
    const isSeedCode = [
      'Function OnGetData()\n  \' VB Script：定义返回值，可用 V_PAGE/V_ROW/V_COL/V_TITLE 等全局变量\n  OnGetData = "脚本输出"\nEnd Function',
      'function OnGetData() {\n  return "脚本输出";\n}'
    ].includes((source.code ?? '').replace(/\r\n/g, '\n').trim())
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

/** 数据源编辑器：主数据源 + 附加数据源（子串）连接；支持多子串添加/删除/排序 */
export default function DataSourceEditor({ source, datasets, connections = {}, allowMultipleDatabaseConnections = false, onChange, subSources = [], onSubSources, sharedNames = [], layout = 'panel' }: Props) {
  const { t, language } = useI18n()
  const { state: entitlement } = useEntitlements()
  const features = entitlement.features
  const kindAllowed = (kind: string): boolean => dataSourceKindAllowed(kind, features)
  const L = (text: string) => localizePropertyLabel(text, language)
  // editIdx：null = 编辑主数据源；>=0 = 编辑对应子串
  const [editIdx, setEditIdx] = useState<number | null>(null)
  const curSource: DataSource = editIdx === null ? source : (subSources[editIdx] ?? source)
  const curKind = editIdx === null ? source.kind : curSource.kind
  const [kind, setKind] = useState<string>(curKind)
  const currentKind = editIdx === null ? kind : curKind
  const currentKindLocked = !kindAllowed(currentKind)
  // 「类型」下拉里的「自定义」不是模型里的枚举值，只能靠本地状态记住用户选了它；
  // 一旦切换编辑对象就复位，避免串到别的数据源上。
  const [customCharset, setCustomCharset] = useState(false)
  const [insertCharOpen, setInsertCharOpen] = useState(false)
  // 序列号的「类型」：charset 等于某个预设就用该预设，否则就是自定义字符集；
  // 「边界值」是独立的序列号类型，不使用字符集。
  const serialCharset = (curSource as { charset?: string }).charset ?? ''
  const serialBoundary = (curSource as { serialType?: string }).serialType === 'boundary'
  const serialPresetValue = serialBoundary ? '__boundary__' : SERIAL_CHARSETS.find(
    (c) => c.value !== '__custom__' && c.value !== '__boundary__' && c.charset === (serialCharset || '0123456789')
  )?.value
  const serialCustom = !serialBoundary && (customCharset || serialPresetValue === undefined)
  // 插入位置：没动过光标时按「追加到末尾」处理，别默认插到开头。
  const constantCaretRef = useRef<number | null>(null)
  const [scaleTest, setScaleTest] = useState<ScaleTestResult | null>(null)
  const [scaleTesting, setScaleTesting] = useState(false)

  const testWeighConnection = async (): Promise<void> => {
    const value = curSource as { weighProtocol?: ScaleProtocol; weighPort?: string; weighBaud?: string; weighUnit?: WeighUnit; weighDecimals?: number }
    setScaleTesting(true)
    try {
      const port = (value.weighPort ?? '').trim()
      if (!port) {
        setScaleTest({ ok: false, portOpened: false, frames: [], stable: false, messageKey: 'error.scalePort', message: '' })
        return
      }
      setScaleTest(await window.maxlabel.scale.test({
        protocol: value.weighProtocol ?? 'kasda',
        port,
        baud: value.weighBaud ?? '9600',
        unit: value.weighUnit ?? 'kg',
        decimals: value.weighDecimals ?? 2,
        timeoutMs: 3000
      }))
    } catch (error) {
      setScaleTest({ ok: false, portOpened: false, frames: [], stable: false, messageKey: 'error.scalePort', message: error instanceof Error ? error.message : String(error) })
    } finally {
      setScaleTesting(false)
    }
  }

  // Keep the local button state aligned when the parent switches the edited
  // source or replaces the source object after normalization/import.
  useEffect(() => {
    setKind(curKind)
  }, [curKind, editIdx])

  useEffect(() => {
    setCustomCharset(false)
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

  const setInputDevice = (device: string) => {
    const base = { ...(curSource as object), kind: 'keyboard', inputDevice: device === 'weigh' ? 'weigh' : 'keyboard' } as KeyboardSource
    curOnChange((device === 'weigh' ? withWeighDefaults(base) : base) as never)
  }

  const pickKind = (k: string) => {
    if (!kindAllowed(k)) return
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
      {layout === 'fields' && (
        <FormField label="数据源(S):">
          <select
            data-testid="source-kind-select"
            style={selStyle}
            value={currentKind}
            onChange={(e) => pickKind(e.target.value)}
          >
            {SOURCE_KIND_ORDER.map((k) => (
              <option key={k} value={k} disabled={!kindAllowed(k)}>
                {KIND_ICONS[k]} {KIND_LABELS[k]}{kindAllowed(k) ? '' : ' 🔒'}
              </option>
            ))}
          </select>
        </FormField>
      )}

      {layout !== 'fields' && (<>
      {/* 当前编辑源标题 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ fontSize: 12.5, fontWeight: 600, color: '#1A1B1C' }}>
          {editIdx === null ? <LText text="主数据源"/> : <><LText text="子串"/> {editIdx + 1}</>}
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
          const allowed = kindAllowed(k)
          return (
          <button
            key={k}
            data-testid={`source-kind-${k}`}
            type="button"
            onClick={() => pickKind(k)}
            disabled={!allowed}
            title={allowed ? undefined : t('entitlement.featureLocked')}
            style={{
              padding: '5px 12px',
              borderRadius: 6,
              border: (editIdx === null ? kind : curKind) === k ? '1px solid #2E6E93' : '1px solid #D5D4CD',
              background: (editIdx === null ? kind : curKind) === k ? '#E8F1F6' : '#fff',
              color: allowed ? ((editIdx === null ? kind : curKind) === k ? '#2E6E93' : '#4B5563') : '#9CA3AF',
              cursor: allowed ? 'pointer' : 'not-allowed',
              opacity: allowed ? 1 : 0.55,
              fontSize: 12.5,
              fontFamily: 'inherit'
            }}
          >
            <LText text={label}/>
            {!allowed && <span aria-hidden="true"> 🔒</span>}
          </button>
          )
        })}
      </div>

      </>)}

      {currentKindLocked && (
        <div data-testid="data-source-locked" style={{ padding: '7px 10px', border: '1px solid #F0D6A8', borderRadius: 6, background: '#FFF8E6', color: '#7A5200', fontSize: 12.5 }}>
          {t('entitlement.featureLocked')}
        </div>
      )}

      <fieldset
        disabled={currentKindLocked}
        style={{ border: 0, padding: 0, margin: 0, minWidth: 0, opacity: currentKindLocked ? 0.6 : 1 }}
      >
      {(editIdx === null ? kind : curKind) === 'constant' && (
        <FormField label="常量内容" hint="固定文本，打印时原样输出；支持 <HT>/<CR>/<LF>，输入 <<HT> 表示字面 <HT>">
          <div style={{ display: 'flex', gap: 6 }}>
            <input
              data-testid="constant-source-value"
              style={inputStyle}
              value={(curSource as { value?: string }).value ?? ''}
              onChange={(e) => curOnChange({ kind: 'constant', value: e.target.value })}
              onSelect={(e) => { constantCaretRef.current = e.currentTarget.selectionStart ?? 0 }}
            />
            <button
              type="button"
              data-testid="constant-insert-char"
              onClick={() => setInsertCharOpen(true)}
              style={{ whiteSpace: 'nowrap', padding: '4px 10px', borderRadius: 4, border: '1px solid #D5D4CD', background: '#fff', color: '#2E6E93', cursor: 'pointer', fontSize: 12, fontFamily: 'inherit' }}
            >
              <LText text="插入字符..."/>
            </button>
          </div>
          {insertCharOpen && (
            <InsertCharDialog
              onInsert={(token) => {
                const value = (curSource as { value?: string }).value ?? ''
                const caret = constantCaretRef.current
                const at = caret === null ? value.length : Math.min(Math.max(0, caret), value.length)
                curOnChange({ kind: 'constant', value: `${value.slice(0, at)}${token}${value.slice(at)}` })
                constantCaretRef.current = at + token.length
              }}
              onClose={() => setInsertCharOpen(false)}
            />
          )}
        </FormField>
      )}

      {(editIdx === null ? kind : curKind) === 'serial' && (
        <>
          {/* 排版照原版「序列号设置」面板：单列、标签左对齐、每行一个字段。 */}
          <fieldset data-testid="serial-settings" style={{ border: '1px solid #D5D5D5', padding: '8px 10px 10px', margin: 0 }}>
            <legend style={{ fontSize: 12.5, padding: '0 4px' }}><LText text="序列号设置"/></legend>

            <div style={{ display: 'grid', gridTemplateColumns: '88px minmax(0, 1fr)', rowGap: 8, columnGap: 6, alignItems: 'center' }}>
              <span style={{ fontSize: 12.5 }}><LText text="类型(T):"/></span>
              <select
                data-testid="serial-charset"
                style={{ ...inputStyle, width: '100%' }}
                value={serialCustom ? '__custom__' : serialPresetValue}
                onChange={(e) => {
                  const v = e.target.value
                  if (v === '__custom__') {
                    // 只是切到自定义编辑态，字符集原样保留，下面那个输入框直接改它。
                    setCustomCharset(true)
                    if (serialBoundary) {
                      // 从「边界值」切走时要退出边界模式，否则下拉会一直显示边界值。
                      const next: Record<string, unknown> = { ...(curSource as object) }
                      delete next.serialType
                      curOnChange(next as never)
                    }
                    return
                  }
                  setCustomCharset(false)
                  const next: Record<string, unknown> = { ...(curSource as object) }
                  if (v === '__boundary__') {
                    // 边界值类型不使用字符集，改由起点值/终点值定义序列。
                    next.serialType = 'boundary'
                    next.charset = ''
                  } else {
                    delete next.serialType
                    next.charset = v
                  }
                  curOnChange(next as never)
                }}
              >
                {SERIAL_CHARSETS.map((c) => (
                  <option key={c.value} value={c.value}>
                    <LText text={c.label}/>
                  </option>
                ))}
              </select>

              {serialCustom && (
                <>
                  <span style={{ fontSize: 12.5 }}><LText text="字符集(Z):"/></span>
                  <input
                    data-testid="serial-custom-charset"
                    style={{ ...inputStyle, width: '100%', fontFamily: 'Consolas, monospace' }}
                    placeholder={L('按升序输入用到的字符，例如 0123456789ABCDEF')}
                    value={serialCharset}
                    onChange={(e) => curOnChange({ ...(curSource as object), charset: e.target.value } as never)}
                  />
                </>
              )}

              {/* 帮助 label_object_page_data_serial.html：「序列：根据选择的类型显示字符集的所有字符排列」 */}
              {!serialBoundary && (
                <>
                  <span style={{ fontSize: 12.5 }}><LText text="序列(Q):"/></span>
                  <textarea
                    data-testid="serial-sequence"
                    readOnly
                    rows={3}
                    style={{ ...inputStyle, width: '100%', resize: 'none', fontFamily: 'Consolas, monospace', letterSpacing: 1 }}
                    value={serialSequenceOf((curSource as { charset?: string }).charset)}
                  />
                </>
              )}

              <span style={{ fontSize: 12.5 }}><LText text="步长(S):"/></span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <input
                  data-testid="serial-step"
                  style={{ ...numStyle, width: 62 }}
                  type="number"
                  min={1}
                  step={1}
                  value={Math.abs((curSource as { step?: number }).step ?? 1)}
                  onChange={(e) => {
                    const magnitude = Math.max(1, Math.abs(parseInt(e.target.value || '1', 10)))
                    const negative = ((curSource as { step?: number }).step ?? 1) < 0
                    curOnChange({ ...(curSource as object), step: negative ? -magnitude : magnitude } as never)
                  }}
                />
                <label style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12.5, whiteSpace: 'nowrap' }}>
                  <input
                    type="radio"
                    name="serial-step-direction"
                    data-testid="serial-step-increase"
                    checked={((curSource as { step?: number }).step ?? 1) >= 0}
                    onChange={() => curOnChange({ ...(curSource as object), step: Math.abs((curSource as { step?: number }).step ?? 1) || 1 } as never)}
                  />
                  <LText text="增量(A)"/>
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12.5, whiteSpace: 'nowrap' }}>
                  <input
                    type="radio"
                    name="serial-step-direction"
                    data-testid="serial-step-decrease"
                    checked={((curSource as { step?: number }).step ?? 1) < 0}
                    onChange={() => curOnChange({ ...(curSource as object), step: -(Math.abs((curSource as { step?: number }).step ?? 1) || 1) } as never)}
                  />
                  <LText text="减量(D)"/>
                </label>
              </span>

              {/* 边界值类型：起点值 + 终点值 + 是否补0（补0 时按起点值的位数补） */}
              {serialBoundary && (<>
              <span style={{ fontSize: 12.5 }}><LText text="起点值"/></span>
              <input
                data-testid="serial-start"
                style={{ ...inputStyle, width: '100%', fontFamily: 'Consolas, monospace' }}
                inputMode="numeric"
                value={String((curSource as { start?: number }).start ?? 1)}
                onChange={(e) => {
                  const raw = e.target.value.replace(/[^\d]/g, '')
                  const n = raw === '' ? 0 : parseInt(raw, 10)
                  curOnChange({ ...(curSource as object), start: n, current: n, digits: Math.max(1, raw.length) } as never)
                }}
              />

              <span style={{ fontSize: 12.5 }}><LText text="终点值"/></span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <input
                  data-testid="serial-end"
                  style={{ ...inputStyle, width: 120, fontFamily: 'Consolas, monospace' }}
                  inputMode="numeric"
                  placeholder={L('不填表示不限制')}
                  value={(() => {
                    const end = (curSource as { end?: number }).end
                    return end === undefined ? '' : String(end)
                  })()}
                  onChange={(e) => {
                    const raw = e.target.value.trim()
                    const rest: Record<string, unknown> = { ...(curSource as object) }
                    if (raw === '') {
                      delete rest.end
                      curOnChange(rest as never)
                      return
                    }
                    const n = Number(raw.replace(/[^\d-]/g, ''))
                    if (!Number.isFinite(n)) return
                    curOnChange({ ...rest, end: n } as never)
                  }}
                />
                <label style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12.5, whiteSpace: 'nowrap' }}>
                  <input
                    type="checkbox"
                    data-testid="serial-pad-zero"
                    checked={(curSource as { padZero?: boolean }).padZero !== false}
                    onChange={(e) => curOnChange({ ...(curSource as object), padZero: e.target.checked } as never)}
                  />
                  <LText text="补0"/>
                </label>
              </span>

              <span />
              <span style={{ fontSize: 11, color: '#6B7280' }}>
                <LText text="勾选「补0」时按终点值的位数补零（例如 1–100 → 001）；达到终点值后本次打印会中止。"/>
              </span>
              </>)}

              <span style={{ fontSize: 12.5 }}><LText text="重复(E):"/></span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <input
                  data-testid="serial-repeat"
                  style={{ ...numStyle, width: 76 }}
                  type="number"
                  min={1}
                  max={1000000}
                  step={1}
                  value={(curSource as { repeat?: number }).repeat ?? 1}
                  onChange={(e) => curOnChange({ ...(curSource as object), repeat: Math.max(1, Math.min(1000000, parseInt(e.target.value || '1', 10))) } as never)}
                />
                <select
                  data-testid="serial-repeat-basis"
                  style={{ ...inputStyle, width: 140 }}
                  value={(curSource as { repeatBasis?: string }).repeatBasis ?? 'record'}
                  onChange={(e) => curOnChange({ ...(curSource as object), repeatBasis: e.target.value } as never)}
                >
                  <option value="record"><LText text="记录数"/></option>
                  <option value="label"><LText text="标签数"/></option>
                </select>
              </span>

              <span style={{ fontSize: 12.5 }}><LText text="初始值来源(R):"/></span>
              <select
                data-testid="serial-initial-source"
                style={{ ...inputStyle, width: '100%' }}
                value={(curSource as { initialValueSource?: string }).initialValueSource ?? 'default'}
                onChange={(e) => curOnChange({ ...(curSource as object), initialValueSource: e.target.value } as never)}
              >
                <option value="default"><LText text="默认"/></option>
                <option value="keyboard"><LText text="键盘输入"/></option>
              </select>

              {(curSource as { initialValueSource?: string }).initialValueSource === 'keyboard' && (
                <>
                  {/* 原版这一格是「提示(P):」——打印时弹框里显示的那句话；填什么就按什么名字去取值 */}
                  <span style={{ fontSize: 12.5 }}><LText text="提示(P):"/></span>
                  <input
                    data-testid="serial-initial-prompt"
                    style={{ ...inputStyle, width: '100%' }}
                    placeholder={L('打印时在输入框前显示的文字，例如 起始编号')}
                    value={(curSource as { initialValueField?: string }).initialValueField ?? ''}
                    onChange={(e) => curOnChange({ ...(curSource as object), initialValueField: e.target.value } as never)}
                  />
                </>
              )}

            </div>
          </fieldset>

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
                <option value=""><LText text="（默认连接）"/></option>
                {Object.values(connections).map((connection) => <option key={connection.id} value={connection.id}>{connection.name}</option>)}
              </select>
            </FormField>
          )}
          <FormField label="数据集" hint="在 数据库 → 数据管理 中添加数据集">
            <select style={inputStyle} value={(curSource as { dataset?: string }).dataset ?? ''} onChange={(e) => curOnChange({ ...(curSource as object), kind: 'database', dataset: e.target.value, field: '' } as DataSource)}>
              <option value=""><LText text="（请选择数据集）"/></option>
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
              <option value=""><LText text="（请选择字段）"/></option>
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
          <div style={{ fontSize: 12, color: '#9CA3AF' }}><LText text="打印数量指定输出记录数；可设置起始记录分段打印。"/></div>
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
            placeholder={L('如 BatchNo（可从下拉选已有名）')}
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
                <option key={f.value} value={f.value}>
                  {formatDateLike(f.value, new Date())}{f.label ? `（${f.label}）` : ''}
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
                <option key={f.value} value={f.value}>
                  {formatDateLike(f.value, new Date())}{f.label ? `（${f.label}）` : ''}
                </option>
              ))}
            </select>
          </FormField>
          <FormField label="区域" hint="指定国家和地区的时区；默认跟随系统">
            <select data-testid="time-region" style={inputStyle} value={(curSource as { region?: string }).region ?? 'default'} onChange={(e) => curOnChange({ ...(curSource as object), kind: 'time', region: e.target.value } as DataSource)}>
              {TIME_REGIONS.map((region) => <option key={region.value} value={region.value}><LText text={region.label}/></option>)}
            </select>
          </FormField>
          {/* 偏移拆成 小时 + 分（原版是「偏移(O): [0] 小时 [0] 分」，模型里仍按分钟存） */}
          <FormField label="偏移(O):" hint="正值=未来的时间，负值=过去的时间">
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <input
                data-testid="time-offset-hours"
                type="number" min={-1000000} max={1000000} step={1}
                style={{ ...numStyle, width: 72 }}
                value={Math.trunc(((curSource as { offset?: number }).offset ?? 0) / 60)}
                onChange={(e) => {
                  const minutes = ((curSource as { offset?: number }).offset ?? 0) % 60
                  curOnChange({ ...(curSource as object), kind: 'time', offset: (parseInt(e.target.value, 10) || 0) * 60 + minutes } as DataSource)
                }}
              />
              <span style={{ fontSize: 12.5 }}><LText text="小时"/></span>
              <input
                data-testid="time-offset-minutes"
                type="number" min={-59} max={59} step={1}
                style={{ ...numStyle, width: 72 }}
                value={((curSource as { offset?: number }).offset ?? 0) % 60}
                onChange={(e) => {
                  const hours = Math.trunc(((curSource as { offset?: number }).offset ?? 0) / 60)
                  curOnChange({ ...(curSource as object), kind: 'time', offset: hours * 60 + (parseInt(e.target.value, 10) || 0) } as DataSource)
                }}
              />
              <span style={{ fontSize: 12.5 }}><LText text="分"/></span>
            </div>
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
              placeholder={L('例如：批次号、包裹重量')}
            />
          </FormField>
          <FormField label="输入方式" hint="键盘输入由操作员在打印时手工输入；电子称通过串口自动采集重量">
            <select
              data-testid="keyboard-input-device"
              style={inputStyle}
              value={(curSource as { inputDevice?: string }).inputDevice ?? 'keyboard'}
              onChange={(e) => setInputDevice(e.target.value)}
            >
              <option value="keyboard"><LText text="键盘输入"/></option>
              <option value="weigh"><LText text="电子称（串口重量采集）"/></option>
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
                  <option value="kasda"><LText text="凯士达 KASDA"/></option>
                  <option value="tonde"><LText text="拓德 TONDE"/></option>
                  <option value="ad"><LText text="顶尖 A&D"/></option>
                  <option value="mettler"><LText text="梅特勒 Mettler"/></option>
                  <option value="ohaus"><LText text="奥豪斯 Ohaus"/></option>
                  <option value="sartorius"><LText text="赛多利斯 Sartorius"/></option>
                  <option value="standard"><LText text="标准连续输出"/></option>
                  <option value="custom"><LText text="自定义（未收录协议需兼容性扩展）"/></option>
                </select>
              </FormField>
              <FormField label="串口参数">
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                  <input data-testid="weigh-port" style={inputStyle} value={(curSource as { weighPort?: string }).weighPort ?? ''} placeholder={L('串口号 COM1')} onChange={(e) => curOnChange({ ...(curSource as object), kind: 'keyboard', weighPort: e.target.value } as never)} />
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
                    <option value="g"><LText text="克 g"/></option>
                    <option value="kg"><LText text="千克 kg"/></option>
                    <option value="lb"><LText text="磅 lb"/></option>
                    <option value="oz"><LText text="盎司 oz"/></option>
                    <option value="jin"><LText text="斤"/></option>
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
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <button
                  type="button"
                  data-testid="weigh-test"
                  disabled={scaleTesting}
                  onClick={() => { void testWeighConnection() }}
                  style={{ padding: '6px 14px', borderRadius: 6, border: '1px solid #2E6E93', background: '#fff', color: '#2E6E93', cursor: scaleTesting ? 'not-allowed' : 'pointer', fontSize: 12.5, fontFamily: 'inherit' }}
                >
                  {translate(language, 'scale.testConnection')}
                </button>
                {scaleTest && (
                  <span data-testid="weigh-test-result" style={{ fontSize: 12, color: scaleTest.ok ? '#2E7D32' : '#B34747' }}>
                    {scaleTest.ok
                      ? `${translate(language, 'scale.stable')} · ${translate(language, 'scale.testFrames', { count: scaleTest.frames.length })}${scaleTest.value === undefined ? '' : ` · ${scaleTest.value} ${scaleTest.unit ?? ''}`}`
                      : `${scaleTest.portOpened ? translate(language, 'scale.portOpened') + ' · ' : ''}${localizeIpcMessage(language, { message: scaleTest.message ?? '', messageKey: scaleTest.messageKey }) || translate(language, 'scale.invalidReading')}`}
                  </span>
                )}
              </div>
              {scaleTest && scaleTest.frames.length > 0 && (
                <div data-testid="weigh-test-frames" style={{ fontSize: 11.5, color: '#4B5563', fontFamily: 'Consolas, monospace', background: '#F6F5F2', border: '1px solid #E4E3DD', borderRadius: 6, padding: '6px 8px', maxHeight: 108, overflow: 'auto' }}>
                  <div style={{ color: '#6B7280', marginBottom: 4 }}>{translate(language, 'scale.rawFrames')}</div>
                  {diagnosticFrames(scaleTest.frames).map((frame, index) => (
                    <div key={index} style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>{frame}</div>
                  ))}
                </div>
              )}
              <div style={{ fontSize: 12, color: '#9CA3AF' }}>
                {translate(language, 'scale.fallbackHint')}
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
      </fieldset>

      {layout === 'fields' && (
        <FormField label="变量共享名称(N):">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <input
              data-testid="source-shared-name"
              style={inputStyle}
              list="maxlabel-shared-names"
              value={curSource.sharedName ?? ''}
              onChange={(e) => curOnChange({ ...(curSource as object), sharedName: e.target.value || undefined } as never)}
            />
            <datalist id="maxlabel-shared-names">
              {sharedNames.map((name) => <option key={name} value={name} />)}
            </datalist>
            {/* 真机这一项是灰的（只给「源自其它变量」的场景预留），保持同款只读观感。 */}
            <label style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12.5, color: '#9AA0A6', whiteSpace: 'nowrap' }}>
              <input type="checkbox" disabled data-testid="source-shared-from-other" />
              <LText text="源自其它变量"/>
            </label>
          </div>
        </FormField>
      )}

      {layout !== 'fields' && (<>
      {/* —— 附加数据源（子串）列表 —— */}
      <div data-testid="source-substring-list" style={{ borderTop: '1px solid #E4E3DD', paddingTop: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
          <span style={{ fontSize: 12.5, fontWeight: 600, color: '#1A1B1C' }}><LText text="附加数据源（子串）"/></span>
          <span style={{ display: 'flex', gap: 6 }}>
          <button
            type="button"
            data-testid="source-substring-paste"
            disabled={!subClipboard}
            title={L('粘贴')}
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
        {subSources.length === 0 && <div style={{ fontSize: 12, color: '#C0BEB5' }}><LText text="（暂无子串）"/></div>}
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
              <button type="button" data-testid={`source-substring-copy-${i}`} title={L('复制')} onClick={(e) => { e.stopPropagation(); copySub(i) }} style={iconBtn}>⧉</button>
              <button type="button" data-testid={`source-substring-move-up-${i}`} title={L('上移')} onClick={(e) => { e.stopPropagation(); moveSub(i, -1) }} style={iconBtn}>↑</button>
              <button type="button" data-testid={`source-substring-move-down-${i}`} title={L('下移')} onClick={(e) => { e.stopPropagation(); moveSub(i, 1) }} style={iconBtn}>↓</button>
              <button type="button" data-testid={`source-substring-remove-${i}`} title={L('删除')} onClick={(e) => { e.stopPropagation(); removeSub(i) }} style={{ ...iconBtn, color: '#D4380D' }}>×</button>
            </span>
          </div>
        ))}
      </div>
      </>)}
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

export function sourcePreview(s: DataSource): string {
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
