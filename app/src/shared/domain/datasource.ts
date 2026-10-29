import type { MonoBitmap } from './units'
import { compileScript, executeScript, hasScriptFunction, hasScriptReturn } from './scriptRuntime'

interface SharedSourceFields { sharedName?: string }

export interface ConstantSource extends SharedSourceFields { kind: 'constant'; value: string }

export interface SerialSource extends SharedSourceFields {
  kind: 'serial'
  prefix: string
  start: number
  step: number
  digits: number
  current: number
  charset?: string
  /** 相同序列值重复输出的次数，原版 默认 1。 */
  repeat?: number
  /** 序列按数据库记录或逻辑标签推进，原版 默认按记录。 */
  repeatBasis?: 'record' | 'label'
  /** 按标签推进时，每条数据库记录开始是否回到初始值。 */
  resetEachRecord?: boolean
  /** 序列初始值来源：默认显示值、键盘输入或数据库字段。 */
  initialValueSource?: 'default' | 'keyboard' | 'database'
  initialValueField?: string
  /** 序列号类型：`boundary` = 边界值模式（按起点→终点输出，越过终点整单中止）。 */
  serialType?: 'boundary'
  /** 边界终点（仅「边界值」类型的条码对象生效）。 */
  end?: number
  /** 「补0」：按 `digits` 补零；未设置时沿用旧模板的补零行为。 */
  padZero?: boolean
}

export interface DateSource extends SharedSourceFields { kind: 'date'; format: string; offset?: number }
export interface TimeSource extends SharedSourceFields { kind: 'time'; format: string; offset?: number; region?: string }
export interface DatabaseSource extends SharedSourceFields {
  kind: 'database'
  dataset: string
  field: string
  /** 选择多个数据库连接时，字段来自的连接 ID。 */
  connectionId?: string
  /** 0-based offset from the current database record for multi-record labels. */
  recordOffset?: number
}
/** 帮助 `label_object_page_data_script.html`：脚本语言选项目前只支持 VB Script。 */
export type ScriptLanguageName = 'vbscript' | 'javascript'
export const DEFAULT_SCRIPT_LANGUAGE: ScriptLanguageName = 'vbscript'
export const SCRIPT_LANGUAGE_LABELS: Record<ScriptLanguageName, string> = {
  vbscript: 'VB Script',
  javascript: 'JavaScript'
}
/** 私有脚本仅对本变量有效；公共脚本供整个标签全局调用；预定义脚本为只读标准库。 */
export type ScriptScope = 'private' | 'public' | 'predefined'
export const SCRIPT_SCOPE_LABELS: Record<ScriptScope, string> = {
  private: '私有脚本（仅对本变量有效）',
  public: '公共脚本（整个标签全局调用）',
  predefined: '预定义脚本（程序提供的标准脚本库，不可更改）'
}
/** 预定义脚本库：帮助称之为"程序提供的可以调用的标准脚本库"，内容为只读。 */
export const PREDEFINED_SCRIPTS: Array<{ name: string; description: string; code: string }> = [
  {
    name: 'CheckDigit_Mod10',
    description: '按交替权重 3/1 计算 V_LABELNO 的 MOD 10 校验字符',
    code: 'Function OnGetData()\n  OnGetData = Mod10(CStr(V_LABELNO))\nEnd Function'
  },
  {
    name: 'FormatPrice',
    description: '把 V_ROW 格式化为两位小数的价格文本',
    code: 'Function OnGetData()\n  OnGetData = FormatNumber(V_ROW, 2)\nEnd Function'
  },
  {
    name: 'LabelPosition',
    description: '按标签当前位置（V_PAGE / V_ROW / V_COL）拼装数据',
    code: 'Function OnGetData()\n  \' 按标签位置计算变量数据\n  OnGetData = V_PAGE & "-" & V_ROW & "-" & V_COL\nEnd Function'
  }
]

export interface ScriptSource extends SharedSourceFields {
  kind: 'script'
  code: string
  /** 脚本语言；未写时沿用运行时的函数语法自动识别。 */
  language?: ScriptLanguageName
  /** 脚本范围；帮助要求区分私有 / 公共 / 预定义。 */
  scope?: ScriptScope
}

/**
 * 语法检查（帮助 `label_object_page_data_script.html` 的"语法检查用于检验脚本有无语法错误"）。
 * 与执行器共用词法和语法分析，并检查返回入口、声明和禁止的宿主访问。
 * 只验证受限子集；依赖具体数据的运行时错误仍由执行器隔离处理。
 */
export function checkScriptSyntax(code: string, language: ScriptLanguageName = DEFAULT_SCRIPT_LANGUAGE, mode: 'object' | 'global' = 'object'): { ok: boolean; message: string } {
  try {
    const program = compileScript(code, language)
    if (mode === 'object' && !hasScriptReturn(program)) throw new Error('未找到 OnGetData 的返回表达式')
    if (mode === 'global' && !['OnBeginPrint', 'OnBeginLabel', 'OnEndLabel', 'OnEndPrint'].some((name) => hasScriptFunction(program, name))) throw new Error('未找到打印生命周期函数')
    return { ok: true, message: '语法检查：未发现语法错误。' }
  } catch (error) {
    return { ok: false, message: '语法检查：' + (error instanceof Error ? error.message : String(error)) }
  }
}

export type WeighProtocol = 'kasda' | 'tonde' | 'ad' | 'mettler' | 'ohaus' | 'sartorius' | 'standard' | 'custom'
export type WeighUnit = 'g' | 'kg' | 'lb' | 'oz' | 'jin'

/** Keyboard input settings also cover the optional electronic-scale workflow. */
export interface KeyboardSource extends SharedSourceFields {
  kind: 'keyboard'
  label: string
  inputDevice?: 'keyboard' | 'weigh'
  weighProtocol?: WeighProtocol
  weighPort?: string
  weighBaud?: string
  weighUnit?: WeighUnit
  weighDecimals?: number
  weighAutoPrint?: boolean
  weighUnitConv?: boolean
}

export type DataSource = ConstantSource | SerialSource | DateSource | TimeSource | DatabaseSource | ScriptSource | KeyboardSource
export type TextFormat = 'none' | 'upper' | 'lower' | 'capitalize'
export type CutType = 'none' | 'trimLeft' | 'trimRight' | 'dropLeft' | 'dropRight' | 'keepLeft' | 'keepRight' | 'keepInt' | 'keepDecimal'

export interface Substr {
  start: number
  length: number
  /** 旧的单条件截断（老模板兼容）；新模板改用下面这组字段，可同时生效 */
  cutType?: CutType
  cutCount?: number
  /** 截短字符串：删除左/右侧空格 */
  trimLeft?: boolean
  trimRight?: boolean
  /** 丢弃左侧/右侧 N 个字符 */
  dropLeft?: number
  dropRight?: number
  /** 保留左侧/右侧 N 个字符 */
  keepSide?: 'left' | 'right'
  keepCount?: number
  /** 字符验证：许可字符集合；非法字符按 `invalidChars` 处理 */
  allowChars?: 'all' | 'digits' | 'letters' | 'alnum' | 'custom'
  allowCharSet?: string
  invalidChars?: 'keep' | 'remove'
}
export interface LengthLimit {
  mode?: 'none' | 'min' | 'max' | 'both'
  min?: number
  max?: number
  padDir?: 'left' | 'right'
  padChar?: string
  trimDir?: 'left' | 'right'
}

export interface Dataset {
  name: string
  columns: string[]
  rows: string[][]
  /** 导入时的本地源文件路径（CSV/TXT/Excel）；用于「查看文件」，可选且随模板保存。 */
  sourcePath?: string
}

export interface DataCtx {
  labelIndex: number
  recordIndex: number
  copy: number
  count: number
  totalLabels: number
  /** OnBeginPrint explicitly assigned the total, even if it equals the default. */
  totalLabelsOverridden?: boolean
  title: string
  printerName: string
  datasets: Record<string, Dataset>
  sharedVars: Record<string, string>
  /** Typed lifecycle variables; shared text outputs remain available through sharedVars. */
  scriptVars?: Record<string, string | number | boolean>
  keyboardValues: Record<string, string>
  /** Electronic-scale readings: label name -> formatted value per logical label index. */
  scaleValues?: Record<string, string[]>
  /** Script execution is opt-in and must be explicitly enabled by the caller. */
  allowScript?: boolean
  images?: Record<string, MonoBitmap>
  recordRow?: string[]
  activeDataset?: string
  /** Fixed once per print/preview job so date/time fields in one label are consistent. */
  now?: number
  /** Optional template-level VBScript/JavaScript lifecycle program. */
  globalScript?: string
}

const CHINESE_MONTHS = ['一月', '二月', '三月', '四月', '五月', '六月', '七月', '八月', '九月', '十月', '十一月', '十二月']
const CHINESE_WEEKDAYS = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六']
const CHINESE_WEEKDAYS_SHORT = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']

function dayOfYear(d: Date): number {
  const start = new Date(d.getFullYear(), 0, 1)
  return Math.floor((d.getTime() - start.getTime()) / 86400000) + 1
}

/** ISO 8601 周数：一周从周一开始，含当年第一个周四的那周算第 1 周。 */
function isoWeek(d: Date): number {
  const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()))
  const weekday = t.getUTCDay() || 7
  t.setUTCDate(t.getUTCDate() + 4 - weekday)
  const yearStart = new Date(Date.UTC(t.getUTCFullYear(), 0, 1))
  return Math.ceil(((t.getTime() - yearStart.getTime()) / 86400000 + 1) / 7)
}

/**
 * 日期格式化。token 与原版「数据源 → 日期格式」列表一一对应：
 * 年 (`y`/`yy`/`yyy`/`yyyy`/`YYYY`)、月 (`MMMM`/`MMM`/`MM`/`M`)、
 * 日 (`dd`/`d`)、星期 (`dddd`/`ddd`)、一年中的第几天 (`DDD`/`D`)、
 * 年周数 (`ww`/`w`/`WW`)、周中第几天 (`e` 周日=0 / `E` 周日=7)，
 * 以及原有的时间 token。
 */
export function formatDateLike(format: string, d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0')
  const hour24 = d.getHours()
  const hour12 = hour24 % 12 || 12
  const meridiem = hour24 < 12 ? '上午' : '下午'
  const tokens: Record<string, string> = {
    YYYY: String(d.getFullYear()),
    yyyy: String(d.getFullYear()),
    yyy: String(d.getFullYear()).slice(-2),
    yy: String(d.getFullYear()).slice(-2),
    y: String(d.getFullYear()),
    MMMM: CHINESE_MONTHS[d.getMonth()],
    MMM: `${d.getMonth() + 1}月`,
    MM: p(d.getMonth() + 1),
    M: String(d.getMonth() + 1),
    dddd: CHINESE_WEEKDAYS[d.getDay()],
    ddd: CHINESE_WEEKDAYS_SHORT[d.getDay()],
    dd: p(d.getDate()),
    d: String(d.getDate()),
    DDD: String(dayOfYear(d)).padStart(3, '0'),
    D: String(dayOfYear(d)),
    WW: p(isoWeek(d)),
    ww: p(isoWeek(d)),
    w: String(isoWeek(d)),
    E: String(d.getDay() || 7),
    e: String(d.getDay()),
    HH: p(hour24),
    H: String(hour24),
    hh: p(hour12),
    h: String(hour12),
    mm: p(d.getMinutes()),
    m: String(d.getMinutes()),
    ss: p(d.getSeconds()),
    s: String(d.getSeconds()),
    tt: meridiem,
    A: meridiem
  }
  return format.replace(/YYYY|yyyy|yyy|yy|y|MMMM|MMM|MM|M|dddd|ddd|dd|d|DDD|D|WW|ww|w|E|e|HH|H|hh|h|mm|m|ss|s|tt|A/g, (m) => tokens[m] ?? m)
}

function dateInRegion(now: number, region?: string): Date {
  if (!region || region === 'default') return new Date(now)
  try {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: region,
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false
    }).formatToParts(new Date(now))
    const values = Object.fromEntries(parts.filter((part) => part.type !== 'literal').map((part) => [part.type, Number(part.value)]))
    return new Date(values.year, (values.month ?? 1) - 1, values.day ?? 1, values.hour ?? 0, values.minute ?? 0, values.second ?? 0)
  } catch {
    return new Date(now)
  }
}

export function serialInitialValue(s: SerialSource, ctx?: DataCtx): number {
  const initialNumber = (raw: string | undefined): number => {
    if (raw === undefined || raw.trim() === '') return s.current
    const value = Number(raw)
    return Number.isFinite(value) ? value : s.current
  }
  if (s.initialValueSource === 'keyboard' && ctx) {
    const raw = ctx.keyboardValues?.[s.initialValueField ?? '']
    return initialNumber(raw)
  }
  if (s.initialValueSource === 'database' && ctx) {
    const dataset = ctx.activeDataset ? ctx.datasets[ctx.activeDataset] : undefined
    const column = dataset?.columns.indexOf(s.initialValueField ?? '') ?? -1
    return initialNumber(column >= 0 ? dataset?.rows[ctx.recordIndex]?.[column] : undefined)
  }
  return s.current
}

type SerialContext = Pick<DataCtx, 'activeDataset' | 'datasets'>

export function serialUsesRecords(s: SerialSource, ctx?: SerialContext): boolean {
  return s.repeatBasis === 'record' && Boolean(ctx?.activeDataset && ctx.datasets[ctx.activeDataset]?.rows.length)
}

/** 本次标签用到的序列序号（0 基）：按记录推进时取记录号，否则按标签数除以重复数。 */
export function serialSequenceIndex(s: SerialSource, labelIndex: number, ctx?: DataCtx): number {
  const repeat = Math.max(1, Math.floor(s.repeat ?? 1))
  const useRecordBasis = serialUsesRecords(s, ctx)
  const index = useRecordBasis ? Math.max(0, ctx?.recordIndex ?? 0) : Math.floor(Math.max(0, labelIndex - 1) / repeat)
  return s.resetEachRecord && useRecordBasis ? 0 : index
}

/**
 * 补零宽度：边界值类型按**终点值**的位数补（1–100 → 3 位，起始输出 001）；
 * 其他类型仍按「位数」补；旧模板没有 padZero 时保持原来的补零行为。
 */
export function serialPadWidth(s: SerialSource): number {
  if (s.padZero === false) return 0
  if (s.serialType === 'boundary' && s.end !== undefined) return String(Math.trunc(Math.abs(s.end))).length
  return s.digits
}

/** 数值的显示文本（不含前缀）。 */
export function serialNumberText(s: SerialSource, value: number): string {
  return String(value).padStart(serialPadWidth(s), '0')
}

export function serialText(s: SerialSource, labelIndex: number, ctx?: DataCtx): string {
  const value = serialInitialValue(s, ctx) + s.step * serialSequenceIndex(s, labelIndex, ctx)
  const cs = s.charset && s.charset.length > 1 ? s.charset : ''
  if (cs && !/^\d+$/.test(cs)) {
    const len = cs.length
    let n = Math.max(1, Math.floor(value))
    let out = ''
    while (n > 0) {
      out = cs[(n - 1) % len] + out
      n = Math.floor((n - 1) / len)
    }
    return s.prefix + out
  }
  return s.prefix + serialNumberText(s, value)
}

function scriptValues(ctx: DataCtx, state = 0): Record<string, string | number | boolean> {
  const typed = Object.fromEntries(Object.entries(ctx.scriptVars ?? {}).filter(([name, value]) => ctx.sharedVars[name] === String(value)))
  return { ...ctx.sharedVars, ...typed, V_PAGE: ctx.labelIndex, V_COPY: ctx.copy, V_LABELNO: ctx.labelIndex,
    V_ROW: ctx.recordIndex + 1, V_COL: 1, V_TOTALLABELS: ctx.totalLabels, V_STARTNO: 1,
    V_TITLE: ctx.title, V_PRINTER: ctx.printerName, State: state }
}

function publishScriptValue(ctx: Pick<DataCtx, 'sharedVars' | 'scriptVars'>, name: string, value: string | number | boolean, language: ScriptLanguageName): void {
  const aliases = language === 'vbscript'
    ? [...new Set([...Object.keys(ctx.sharedVars), ...Object.keys(ctx.scriptVars ?? {})])].filter((item) => item.toLowerCase() === name.toLowerCase())
    : []
  const target = aliases[0] ?? name
  for (const alias of aliases) {
    delete ctx.sharedVars[alias]
    if (ctx.scriptVars) delete ctx.scriptVars[alias]
  }
  ctx.sharedVars[target] = String(value)
  ctx.scriptVars = { ...ctx.scriptVars, [target]: value }
}

/** Lifecycle and object scripts share the same parser and bounded interpreter. */
export function runGlobalScriptHook(code: string | undefined, ctx: DataCtx, name: 'OnBeginPrint' | 'OnBeginLabel' | 'OnEndLabel' | 'OnEndPrint', state = 0): DataCtx {
  if (ctx.allowScript !== true || !code) return ctx
  try {
    const program = compileScript(code)
    if (!hasScriptFunction(program, name)) return ctx
    const result = executeScript(program, scriptValues(ctx, state), name)
    const published = { sharedVars: { ...ctx.sharedVars }, scriptVars: { ...ctx.scriptVars } }
    for (const [key, value] of Object.entries(result.values)) {
      if (!/^V_/i.test(key) && (program.language === 'vbscript' ? key.toLowerCase() !== 'state' : key !== 'State')) {
        publishScriptValue(published, key, value, program.language)
      }
    }
    const totalLabels = Number(result.values.V_TOTALLABELS)
    const totalKey = program.language === 'vbscript' ? 'v_totallabels' : 'V_TOTALLABELS'
    return { ...ctx, ...published, totalLabels: Number.isFinite(totalLabels) ? Math.max(0, Math.floor(totalLabels)) : ctx.totalLabels,
      ...(name === 'OnBeginPrint' && result.assigned.has(totalKey) ? { totalLabelsOverridden: true } : {}) }
  } catch (error) {
    throw new Error(`全局脚本 ${name} 失败（标签 ${ctx.labelIndex}）：${error instanceof Error ? error.message : String(error)}`)
  }
}

export function runGlobalScript(code: string | undefined, ctx: DataCtx, state: number): DataCtx {
  return runGlobalScriptHook(code, ctx, 'OnBeginPrint', state)
}

function evaluateScriptSource(code: string, ctx: DataCtx, declaredLanguage?: ScriptLanguageName): { value: string; language: ScriptLanguageName } | undefined {
  if (ctx.allowScript !== true) return undefined
  try {
    const program = compileScript(code, declaredLanguage ?? 'javascript')
    if (!hasScriptReturn(program)) return undefined
    return { value: String(executeScript(program, scriptValues(ctx)).value), language: program.language }
  } catch { return undefined }
}

/** Runtime errors resolve to an empty value without changing the caller's variables. */
export function runScriptSource(code: string, ctx: DataCtx, declaredLanguage?: ScriptLanguageName): string {
  return evaluateScriptSource(code, ctx, declaredLanguage)?.value ?? ''
}

const EMPTY_CTX: DataCtx = {
  labelIndex: 1,
  recordIndex: 0,
  copy: 1,
  count: 1,
  totalLabels: 1,
  title: '',
  printerName: '',
  datasets: {},
  sharedVars: {},
  keyboardValues: {},
  allowScript: false
}

export function resolveSourceText(source: DataSource, ctx: DataCtx = EMPTY_CTX): string {
  const now = Number.isFinite(ctx.now) ? Number(ctx.now) : Date.now()
  switch (source.kind) {
    case 'constant': return source.value
    case 'serial': return serialText(source, ctx.labelIndex, ctx)
    case 'date': return formatDateLike(source.format, new Date(now + (source.offset ?? 0) * 86400000))
    case 'time': return formatDateLike(source.format, dateInRegion(now + (source.offset ?? 0) * 60000, source.region))
    case 'keyboard': {
      if (source.inputDevice === 'weigh' && ctx.scaleValues?.[source.label]) {
        return ctx.scaleValues[source.label][ctx.labelIndex - 1] ?? ''
      }
      return ctx.keyboardValues?.[source.label] ?? ''
    }
    case 'database': {
      const ds = ctx.datasets[source.dataset]
      const recordIndex = ctx.recordIndex + (source.recordOffset ?? 0)
      if (!ds || !ds.rows[recordIndex]) return ''
      const ci = ds.columns.indexOf(source.field)
      return ci >= 0 ? ds.rows[recordIndex][ci] ?? '' : ''
    }
    case 'script': {
      const result = evaluateScriptSource(source.code, ctx, source.language)
      if (source.sharedName && result) {
        // Publishing object data always replaces the old lifecycle value with text.
        publishScriptValue(ctx, source.sharedName, result.value, result.language)
      }
      return result?.value ?? ''
    }
  }
}

const CONTROL_CHAR_MAP: Record<string, number> = {
  SOH: 1, STX: 2, ETX: 3, EOT: 4, ENQ: 5, ACK: 6, BEL: 7, BS: 8, HT: 9, LF: 10,
  VT: 11, FF: 12, CR: 13, SO: 14, SI: 15, DLE: 16, DC1: 17, DC2: 18, DC3: 19,
  DC4: 20, NAK: 21, SYN: 22, ETB: 23, CAN: 24, EM: 25, SUB: 26, ESC: 27, FS: 28,
  GS: 29, RS: 30, US: 31
}

/**
 * 非打印 ASCII 字符表（ASCII 1 到 31 共 31 个控制字符），供数据源页插入按钮使用。
 * 帮助 `label_object_page_data.html`：支持直接输入非打印 ASCII 字符（换行符、TAB 字符等）。
 */
const CONTROL_CHAR_NAMES: Record<string, string> = {
  SOH: '标题开始', STX: '正文开始', ETX: '正文结束', EOT: '传输结束', ENQ: '请求',
  ACK: '收到通知', BEL: '响铃', BS: '退格', HT: '水平制表符', LF: '换行键',
  VT: '垂直制表符', FF: '换页键', CR: '回车键', SO: '取消变换', SI: '启用变换',
  DLE: '数据链路转义', DC1: '设备控制一', DC2: '设备控制二', DC3: '设备控制三',
  DC4: '设备控制四', NAK: '拒绝接收', SYN: '同步空闲', ETB: '传输块结束', CAN: '取消',
  EM: '介质中断', SUB: '替换', ESC: '换码', FS: '文件分隔符', GS: '组分隔符',
  RS: '记录分隔符', US: '单元分隔符'
}

/** 非打印 ASCII 字符表（1~31），供「插入字符」对话框使用；名称与 ASCII/十六进制值照原版列表。 */
export const CONTROL_CHAR_ENTRIES: Array<{ name: string; code: number; label: string; description: string; ascii: string; hex: string }> = Object.entries(CONTROL_CHAR_MAP).map(
  ([name, code]) => ({
    name,
    code,
    label: `<${name}>`,
    description: CONTROL_CHAR_NAMES[name] ?? name,
    ascii: String(code).padStart(2, '0'),
    hex: code.toString(16).toUpperCase().padStart(2, '0')
  })
)

export function decodeControlChars(text: string): string {
  if (!text || !text.includes('<')) return text
  return text.replace(/<+([A-Z][A-Z0-9]*)>/g, (m, name: string) => {
    const code = CONTROL_CHAR_MAP[name]
    if (code === undefined) return m
    const depth = m.indexOf(name)
    if (depth > 1) return '<'.repeat(depth - 1) + name + '>'
    return String.fromCharCode(code)
  })
}

function applyCut(text: string, cut?: CutType, n = 0): string {
  switch (cut) {
    case 'trimLeft': return text.replace(/^\s+/, '')
    case 'trimRight': return text.replace(/\s+$/, '')
    case 'dropLeft': return text.slice(Math.min(n, text.length))
    case 'dropRight': return n >= text.length ? '' : text.slice(0, text.length - n)
    case 'keepLeft': return text.slice(0, Math.min(n, text.length))
    case 'keepRight': return n >= text.length ? text : text.slice(text.length - n)
    // 帮助 datasource_advanced_cut.html：「保留……也可以单独保留数字的整数或者小数部分（包含小数点）」
    case 'keepInt': return text.includes('.') ? text.slice(0, text.indexOf('.')) : text
    case 'keepDecimal': return text.includes('.') ? text.slice(text.indexOf('.')) : ''
    default: return text
  }
}

function applyLengthLimit(text: string, lim?: LengthLimit): string {
  if (!lim || !lim.mode || lim.mode === 'none') return text
  let t = text
  const min = lim.mode === 'min' || lim.mode === 'both' ? Math.max(0, lim.min || 0) : 0
  const max = lim.mode === 'max' || lim.mode === 'both' ? Math.max(0, lim.max || 0) : 0
  if (max > 0 && t.length > max) t = lim.trimDir === 'left' ? t.slice(t.length - max) : t.slice(0, max)
  if (min > 0 && t.length < min) {
    const padChar = lim.padChar && lim.padChar.length > 0 ? lim.padChar[0] : ' '
    const fill = padChar.repeat(min - t.length)
    t = lim.padDir === 'right' ? t + fill : fill + t
  }
  return t
}

/**
 * 「截短字符串」：去空格 → 丢弃左右 → 保留一侧，各项互相独立、可同时生效。
 * 只看新字段；老模板里的 `cutType` 走 `applyCut` 的单条件路径。
 */
function applySubstrTrim(text: string, s: Substr): string {
  let t = text
  if (s.trimLeft) t = t.replace(/^\s+/, '')
  if (s.trimRight) t = t.replace(/\s+$/, '')
  const dropL = Math.max(0, s.dropLeft || 0)
  if (dropL > 0) t = t.slice(Math.min(dropL, t.length))
  const dropR = Math.max(0, s.dropRight || 0)
  if (dropR > 0) t = dropR >= t.length ? '' : t.slice(0, t.length - dropR)
  const keep = Math.max(0, s.keepCount || 0)
  if (keep > 0) t = s.keepSide === 'right' ? t.slice(Math.max(0, t.length - keep)) : t.slice(0, keep)
  return t
}

/** 「字符验证」：许可字符之外的字符按 `invalidChars` 保留或删除。 */
function applyCharValidation(text: string, s: Substr): string {
  const allow = s.allowChars
  if (!allow || allow === 'all') return text
  if (s.invalidChars === 'keep') return text
  const test = (ch: string): boolean =>
    allow === 'digits' ? /[0-9]/.test(ch)
      : allow === 'letters' ? /[A-Za-z]/.test(ch)
        : allow === 'alnum' ? /[A-Za-z0-9]/.test(ch)
          : (s.allowCharSet ?? '').includes(ch)
  return Array.from(text).filter(test).join('')
}

export function applyObjectFormat(text: string, format?: TextFormat, substr?: Substr, lengthLimit?: LengthLimit, charTemplate?: string): string {
  let t = text
  if (substr) t = applyCharValidation(t, substr)
  if (substr && (substr.trimLeft || substr.trimRight || substr.dropLeft || substr.dropRight || substr.keepCount)) {
    t = applySubstrTrim(t, substr)
  } else if (substr && substr.cutType && substr.cutType !== 'none') {
    t = applyCut(t, substr.cutType, substr.cutCount || 0)
  }
  if (substr) {
    const start = Math.max(0, substr.start || 0)
    if (substr.length && substr.length > 0) t = t.slice(start, start + substr.length)
    else if (start > 0) t = t.slice(start)
  }
  if (format === 'upper') t = t.toUpperCase()
  else if (format === 'lower') t = t.toLowerCase()
  else if (format === 'capitalize') t = t.charAt(0).toUpperCase() + t.slice(1)
  if (charTemplate && charTemplate.indexOf('?') >= 0) {
    let ci = 0
    t = charTemplate.replace(/\?/g, () => (ci < t.length ? t[ci++] : ''))
  }
  return applyLengthLimit(t, lengthLimit)
}

export function resolveObjectText(obj: { source: DataSource; format?: TextFormat; substr?: Substr; lengthLimit?: LengthLimit; subSources?: DataSource[]; charTemplate?: string }, ctx: DataCtx = EMPTY_CTX): string {
  if (!ctx.sharedVars) (ctx as { sharedVars: Record<string, string> }).sharedVars = {}
  let t = decodeControlChars(resolveSourceText(obj.source, ctx))
  for (const sub of obj.subSources ?? []) {
    const sh = (sub as { sharedName?: string }).sharedName
    let subText = ''
    if (sh && ctx.sharedVars[sh] !== undefined) subText = ctx.sharedVars[sh]
    else {
      subText = decodeControlChars(resolveSourceText(sub, ctx))
      if (sh) ctx.sharedVars[sh] = subText
    }
    t += subText
  }
  return applyObjectFormat(t, obj.format, obj.substr, obj.lengthLimit, obj.charTemplate)
}

export function advanceSerial(source: DataSource, count: number, ctx?: SerialContext): DataSource {
  if (source.kind !== 'serial') return source
  const repeat = Math.max(1, Math.floor(source.repeat ?? 1))
  const advances = serialUsesRecords(source, ctx) ? Math.max(0, count) : Math.ceil(Math.max(0, count) / repeat)
  return { ...source, current: source.current + source.step * advances }
}

export function sourceLabel(s?: DataSource): string {
  if (!s) return '—'
  switch (s.kind) {
    case 'constant': return '固定数据'
    case 'serial': return '序列号'
    case 'date': return '日期'
    case 'time': return '时间'
    case 'database': return '数据库'
    case 'keyboard': return '键盘输入'
    case 'script': return '脚本'
  }
}
