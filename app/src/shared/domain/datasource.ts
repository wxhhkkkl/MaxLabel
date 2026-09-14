import type { MonoBitmap } from './units'

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
  /** 相同序列值重复输出的次数，LabelShop 默认 1。 */
  repeat?: number
  /** 序列按数据库记录或逻辑标签推进，LabelShop 默认按记录。 */
  repeatBasis?: 'record' | 'label'
  /** 按标签推进时，每条数据库记录开始是否回到初始值。 */
  resetEachRecord?: boolean
  /** 序列初始值来源：默认显示值、键盘输入或数据库字段。 */
  initialValueSource?: 'default' | 'keyboard' | 'database'
  initialValueField?: string
}

export interface DateSource extends SharedSourceFields { kind: 'date'; format: string; offset?: number }
export interface TimeSource extends SharedSourceFields { kind: 'time'; format: string; offset?: number; region?: string }
export interface DatabaseSource extends SharedSourceFields {
  kind: 'database'
  dataset: string
  field: string
  /** 0-based offset from the current database record for multi-record labels. */
  recordOffset?: number
}
export interface ScriptSource extends SharedSourceFields { kind: 'script'; code: string }

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
export type CutType = 'none' | 'trimLeft' | 'trimRight' | 'dropLeft' | 'dropRight' | 'keepLeft' | 'keepRight'

export interface Substr { start: number; length: number; cutType?: CutType; cutCount?: number }
export interface LengthLimit {
  mode?: 'none' | 'min' | 'max' | 'both'
  min?: number
  max?: number
  padDir?: 'left' | 'right'
  padChar?: string
  trimDir?: 'left' | 'right'
}

export interface Dataset { name: string; columns: string[]; rows: string[][] }

export interface DataCtx {
  labelIndex: number
  recordIndex: number
  copy: number
  count: number
  totalLabels: number
  title: string
  printerName: string
  datasets: Record<string, Dataset>
  sharedVars: Record<string, string>
  keyboardValues: Record<string, string>
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

export function formatDateLike(format: string, d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0')
  const hour24 = d.getHours()
  const hour12 = hour24 % 12 || 12
  const meridiem = hour24 < 12 ? '上午' : '下午'
  return format
    .replace(/yyyy/g, String(d.getFullYear()))
    .replace(/yy/g, String(d.getFullYear()).slice(-2))
    .replace(/MM/g, p(d.getMonth() + 1))
    .replace(/M/g, String(d.getMonth() + 1))
    .replace(/dd/g, p(d.getDate()))
    .replace(/d/g, String(d.getDate()))
    .replace(/HH/g, p(hour24))
    .replace(/H/g, String(hour24))
    .replace(/hh/g, p(hour12))
    .replace(/h/g, String(hour12))
    .replace(/mm/g, p(d.getMinutes()))
    .replace(/ss/g, p(d.getSeconds()))
    .replace(/tt/g, meridiem)
    .replace(/A/g, meridiem)
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

function serialInitialValue(s: SerialSource, ctx?: DataCtx): number {
  if (s.initialValueSource === 'keyboard' && ctx) {
    const raw = ctx.keyboardValues?.[s.initialValueField ?? '']
    const value = Number(raw)
    if (Number.isFinite(value)) return value
  }
  if (s.initialValueSource === 'database' && ctx) {
    const dataset = ctx.activeDataset ? ctx.datasets[ctx.activeDataset] : undefined
    const column = dataset?.columns.indexOf(s.initialValueField ?? '') ?? -1
    const value = Number(column >= 0 ? dataset?.rows[ctx.recordIndex]?.[column] : '')
    if (Number.isFinite(value)) return value
  }
  return s.current
}

export function serialText(s: SerialSource, labelIndex: number, ctx?: DataCtx): string {
  const repeat = Math.max(1, Math.floor(s.repeat ?? 1))
  const useRecordBasis = s.repeatBasis === 'record' && Boolean(ctx?.activeDataset && ctx.datasets[ctx.activeDataset]?.rows.length)
  let sequenceIndex = useRecordBasis ? Math.max(0, ctx?.recordIndex ?? 0) : Math.floor(Math.max(0, labelIndex - 1) / repeat)
  if (s.resetEachRecord && useRecordBasis) sequenceIndex = 0
  const value = serialInitialValue(s, ctx) + s.step * sequenceIndex
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
  return s.prefix + String(value).padStart(s.digits, '0')
}

/**
 * Execute an explicitly enabled data script.
 *
 * LabelShop templates most commonly use scripts to return a small expression
 * based on the built-in variables (for example `"SN-" + V_LABELNO`).  The
 * previous implementation dynamically evaluated template code, which gave
 * template content access to the renderer global object and could freeze the UI with a loop.
 * Keep the compatible expression subset, but evaluate it without dynamic code
 * execution. Unsupported statements intentionally resolve to an empty value.
 */
type ScriptLanguage = 'javascript' | 'vbscript'

interface ScriptFunctionMatch { body: string; language: ScriptLanguage }

function scriptFunctionBody(code: string, name: string): ScriptFunctionMatch | undefined {
  const js = code.match(new RegExp(`function\\s+${name}\\s*\\([^)]*\\)\\s*\\{([\\s\\S]*?)\\}`, 'i'))
    ?? code.match(new RegExp(`${name}\\s*=\\s*function\\s*\\([^)]*\\)\\s*\\{([\\s\\S]*?)\\}`, 'i'))
  if (js) return { body: js[1], language: 'javascript' }
  const vb = code.match(new RegExp(`Function\\s+${name}\\s*\\([^)]*\\)([\\s\\S]*?)End\\s+Function`, 'i'))
  return vb ? { body: vb[1], language: 'vbscript' } : undefined
}

function scriptValues(ctx: DataCtx, state?: number): Record<string, string | number> {
  return {
    ...(ctx.sharedVars || {}),
    V_PAGE: ctx.labelIndex,
    V_COPY: ctx.copy,
    V_LABELNO: ctx.labelIndex,
    V_ROW: ctx.recordIndex + 1,
    V_COL: 1,
    V_TOTALLABELS: ctx.totalLabels,
    V_STARTNO: 1,
    V_TITLE: ctx.title,
    V_PRINTER: ctx.printerName,
    State: state ?? 0
  }
}

function stripScriptComments(code: string): string {
  return code.split(/\r?\n/).map((line) => {
    const trimmed = line.trim()
    if (trimmed.startsWith("'")) return ''
    return line.replace(/\/\/.*$/, '')
  }).join('\n')
}

function scriptAssignmentValue(value: string, values: Record<string, string | number>, language: ScriptLanguage): string | number {
  const result = evaluateSafeExpression(value.replace(/[;,]\s*$/, '').trim(), values, language)
  return typeof result === 'boolean' ? (result ? 1 : 0) : result
}

function executeScriptAssignments(body: string, values: Record<string, string | number>, language: ScriptLanguage): void {
  let active = true
  let conditional = false
  for (const raw of stripScriptComments(body).split(/[\r\n;]+/)) {
    const statement = raw.trim().replace(/[{}]$/, '').trim()
    if (!statement) continue
    const ifMatch = statement.match(/^if\s*(?:\((.+?)\)|(.+?))\s*(?:then)?$/i)
    if (ifMatch) {
      const condition = (ifMatch[1] ?? ifMatch[2]).replace(/\s+then$/i, '').trim()
      active = Boolean(evaluateSafeExpression(condition, values, language))
      conditional = true
      continue
    }
    if (/^else\b/i.test(statement)) {
      active = conditional ? !active : active
      continue
    }
    if (/^(?:end\s+if|})$/i.test(statement)) {
      active = true
      conditional = false
      continue
    }
    if (!active) continue
    const assignment = statement.match(/^(?:set\s+)?([A-Za-z_$][\w$]*)\s*=\s*(.+)$/i)
    if (!assignment) continue
    const key = assignment[1]
    values[key] = scriptAssignmentValue(assignment[2], values, language)
  }
}

/** Execute a template-level lifecycle hook in the same safe subset as object scripts. */
export function runGlobalScriptHook(code: string | undefined, ctx: DataCtx, name: 'OnBeginPrint' | 'OnBeginLabel' | 'OnEndLabel' | 'OnEndPrint', state = 0): DataCtx {
  if (ctx.allowScript !== true || !code || code.length > 256 * 1024) return ctx
  if (/(?:while|for|do|eval|importScripts|globalThis|window|document|localStorage|sessionStorage|fetch|XMLHttpRequest|require|process|setTimeout|setInterval|location|navigator|postMessage)\b/i.test(code)) return ctx
  const match = scriptFunctionBody(code, name)
  if (!match) return ctx
  const values = scriptValues(ctx, state)
  try {
    executeScriptAssignments(match.body, values, match.language)
    const sharedVars = { ...ctx.sharedVars }
    for (const [key, value] of Object.entries(values)) {
      if (!/^V_/.test(key) && key !== 'State') sharedVars[key] = String(value)
    }
    const totalLabels = Number(values.V_TOTALLABELS)
    return { ...ctx, totalLabels: Number.isFinite(totalLabels) ? Math.max(0, Math.floor(totalLabels)) : ctx.totalLabels, sharedVars }
  } catch {
    return ctx
  }
}

/** Run OnBeginPrint and return the resulting output count/shared variables. */
export function runGlobalScript(code: string | undefined, ctx: DataCtx, state: number): DataCtx {
  return runGlobalScriptHook(code, ctx, 'OnBeginPrint', state)
}

export function runScriptSource(code: string, ctx: DataCtx): string {
  if (ctx.allowScript !== true) return ''
  if (typeof code !== 'string' || code.length > 256 * 1024) return ''
  if (/(?:while|for|do|eval|importScripts|globalThis|window|document|localStorage|sessionStorage|fetch|XMLHttpRequest|require|process|setTimeout|setInterval|location|navigator|postMessage)\b/i.test(code)) return ''
  const match = scriptFunctionBody(code, 'OnGetData')
  const body = match?.body ?? code
  const returnMatch = body.match(/return\s+([\s\S]*?)(?:;|$)/i)
  const assignmentMatch = body.match(/OnGetData\s*=\s*([\s\S]*?)(?:;|$)/i)
  const expression = returnMatch?.[1] ?? assignmentMatch?.[1]
  if (!expression) return ''
  const values = scriptValues(ctx)
  try {
    return String(evaluateSafeExpression(expression.trim(), values, match?.language ?? 'javascript'))
  } catch {
    return ''
  }
}

function splitTopLevel(expression: string, separator: string): string[] {
  const parts: string[] = []
  let start = 0
  let depth = 0
  let quote = ''
  let escaped = false
  for (let i = 0; i < expression.length; i += 1) {
    const ch = expression[i]
    if (quote) {
      if (escaped) escaped = false
      else if (ch === '\\') escaped = true
      else if (ch === quote) quote = ''
      continue
    }
    if (ch === '"' || ch === "'") { quote = ch; continue }
    if (ch === '(' || ch === '[') depth += 1
    else if (ch === ')' || ch === ']') depth -= 1
    else if (depth === 0 && expression.startsWith(separator, i)) {
      parts.push(expression.slice(start, i).trim())
      start = i + separator.length
      i += separator.length - 1
    }
  }
  parts.push(expression.slice(start).trim())
  return parts
}

function parseLiteral(term: string, values: Record<string, string | number>): string | number | boolean | undefined {
  if (/^[-+]?\d+(?:\.\d+)?$/.test(term)) return Number(term)
  if (/^true$/i.test(term)) return true
  if (/^false$/i.test(term)) return false
  if (/^(null|undefined)$/i.test(term)) return ''
  if ((term.startsWith('"') && term.endsWith('"')) || (term.startsWith("'") && term.endsWith("'"))) {
    const quote = term[0]
    const inner = term.slice(1, -1).replace(new RegExp('\\\\' + quote, 'g'), quote).replace(/\\n/g, '\n').replace(/\\r/g, '\r').replace(/\\t/g, '\t').replace(/\\\\/g, '\\')
    return inner
  }
  const cast = term.match(/^(CStr|CInt|CLng|CDbl|String)\(([^()]*)\)$/i)
  if (cast) {
    const value = evaluateSafeExpression(cast[2], values)
    if (/^c(?:int|lng|dbl)$/i.test(cast[1])) return Number(value) || 0
    return String(value)
  }
  const method = term.match(/^([A-Za-z_$][\w$]*)\.(toUpperCase|toLowerCase|trim|length)\(\)?$/)
  if (method) {
    const value = values[method[1]] ?? ''
    if (method[2] === 'length') return String(value).length
    if (method[2] === 'toUpperCase') return String(value).toUpperCase()
    if (method[2] === 'toLowerCase') return String(value).toLowerCase()
    return String(value).trim()
  }
  const stringCall = term.match(/^String\(([^()]*)\)$/)
  if (stringCall) return String(evaluateSafeExpression(stringCall[1], values))
  const value = values[term]
  if (value !== undefined) return value
  throw new Error('unsupported script term')
}

function evaluateSafeExpression(expression: string, values: Record<string, string | number>, language: ScriptLanguage = 'javascript'): string | number | boolean {
  const negated = expression.trim().match(/^!\s*(.+)$/)
  if (negated) return !Boolean(evaluateSafeExpression(negated[1], values, language))
  const notMatch = expression.trim().match(/^Not\s+(.+)$/i)
  if (notMatch) return !Boolean(evaluateSafeExpression(notMatch[1], values, language))
  const ternary = splitTopLevel(expression, '?')
  if (ternary.length === 2) {
    const branches = splitTopLevel(ternary[1], ':')
    if (branches.length !== 2) throw new Error('invalid ternary')
    const condition = evaluateSafeExpression(ternary[0], values, language)
    return evaluateSafeExpression(condition ? branches[0] : branches[1], values, language)
  }
  for (const operator of ['===', '!==', '>=', '<=', '==', '!=', '=', '>', '<']) {
    const parts = splitTopLevel(expression, operator)
    if (parts.length === 2) {
      const left = evaluateSafeExpression(parts[0], values, language)
      const right = evaluateSafeExpression(parts[1], values, language)
      if (operator === '===' || operator === '==') return left === right || String(left) === String(right)
      if (operator === '!==' || operator === '!=') return !(left === right || String(left) === String(right))
      if (operator === '>') return Number(left) > Number(right)
      if (operator === '<') return Number(left) < Number(right)
      if (operator === '>=') return Number(left) >= Number(right)
      return Number(left) <= Number(right)
    }
  }
  const concat = splitTopLevel(expression, '&')
  if (concat.length > 1) return concat.map((term) => String(evaluateSafeExpression(term, values, language))).join('')
  const product = splitTopLevel(expression, '*')
  if (product.length > 1) return product.reduce((result, term) => result * Number(evaluateSafeExpression(term, values, language)), 1)
  const terms = splitTopLevel(expression, '+')
  if (terms.length > 1) {
    const parsed = terms.map((term) => evaluateSafeExpression(term, values, language))
    return parsed.some((value) => typeof value === 'string') ? parsed.map(String).join('') : parsed.reduce((sum, value) => Number(sum) + Number(value), 0)
  }
  const trimmed = expression.trim()
  if (trimmed.startsWith('(') && trimmed.endsWith(')')) return evaluateSafeExpression(trimmed.slice(1, -1), values, language)
  const direct = Object.keys(values).find((key) => key.toLowerCase() === trimmed.toLowerCase())
  return parseLiteral(trimmed, values) ?? (direct ? values[direct] : '')
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
    case 'keyboard': return ctx.keyboardValues?.[source.label] ?? ''
    case 'database': {
      const ds = ctx.datasets[source.dataset]
      const recordIndex = ctx.recordIndex + (source.recordOffset ?? 0)
      if (!ds || !ds.rows[recordIndex]) return ''
      const ci = ds.columns.indexOf(source.field)
      return ci >= 0 ? ds.rows[recordIndex][ci] ?? '' : ''
    }
    case 'script': {
      const out = runScriptSource(source.code, ctx)
      if (source.sharedName && out !== '') ctx.sharedVars[source.sharedName] = out
      return out
    }
  }
}

const CONTROL_CHAR_MAP: Record<string, number> = {
  SOH: 1, STX: 2, ETX: 3, EOT: 4, ENQ: 5, ACK: 6, BEL: 7, BS: 8, HT: 9, LF: 10,
  VT: 11, FF: 12, CR: 13, SO: 14, SI: 15, DLE: 16, DC1: 17, DC2: 18, DC3: 19,
  DC4: 20, NAK: 21, SYN: 22, ETB: 23, CAN: 24, EM: 25, SUB: 26, ESC: 27, FS: 28,
  GS: 29, RS: 30, US: 31
}

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

export function applyObjectFormat(text: string, format?: TextFormat, substr?: Substr, lengthLimit?: LengthLimit, charTemplate?: string): string {
  let t = text
  if (substr && substr.cutType && substr.cutType !== 'none') t = applyCut(t, substr.cutType, substr.cutCount || 0)
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

export function advanceSerial(source: DataSource, count: number): DataSource {
  if (source.kind !== 'serial') return source
  const repeat = Math.max(1, Math.floor(source.repeat ?? 1))
  const advances = source.repeatBasis === 'label' ? Math.ceil(Math.max(0, count) / repeat) : Math.max(0, count)
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
