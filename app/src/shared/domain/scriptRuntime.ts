export type ScriptLanguage = 'vbscript' | 'javascript'
type Value = string | number | boolean
type Token = { text: string; kind: 'id' | 'number' | 'string' | 'symbol' | 'end'; line: number }
type Expr = { kind: 'literal'; value: Value } | { kind: 'name'; name: string } | { kind: 'unary'; op: string; value: Expr }
  | { kind: 'binary'; op: string; left: Expr; right: Expr } | { kind: 'choice'; condition: Expr; yes: Expr; no: Expr }
  | { kind: 'call'; name: string; args: Expr[] } | { kind: 'member'; value: Expr; name: string; call: boolean }
type Statement = { kind: 'assign'; name: string; value: Expr } | { kind: 'declare'; name: string; value?: Expr; constant: boolean; functionScoped: boolean }
  | { kind: 'return'; value: Expr } | { kind: 'if'; condition: Expr; yes: Statement[]; no: Statement[] }
export interface ScriptProgram { language: ScriptLanguage; functions: Map<string, Statement[]>; body: Statement[]; explicit: boolean }
const MAX_SOURCE = 256 * 1024
const MAX_STRING = 1024 * 1024
const MAX_STATE_STRING = 4 * MAX_STRING
const MAX_STRING_WORK = 16 * MAX_STRING
const forbidden = new Set(['eval', 'importscripts', 'globalthis', 'window', 'document', 'localstorage', 'sessionstorage', 'fetch', 'xmlhttprequest', 'require', 'process', 'settimeout', 'setinterval', 'location', 'navigator', 'postmessage', 'constructor', '__proto__', 'prototype'])
const hooks = new Set(['ongetdata', 'onbeginprint', 'onbeginlabel', 'onendlabel', 'onendprint'])
const arities: Record<string, [number, number]> = { cstr: [1, 1], cint: [1, 1], clng: [1, 1], cdbl: [1, 1], string: [1, 2], len: [1, 1], ucase: [1, 1], lcase: [1, 1], trim: [1, 1], left: [2, 2], right: [2, 2], mid: [2, 3], replace: [3, 3], abs: [1, 1], formatnumber: [1, 2], mod10: [1, 1] }
const key = (name: string, language: ScriptLanguage) => language === 'vbscript' ? name.toLowerCase() : name

function tokenize(code: string, language: ScriptLanguage): Token[] {
  if (!code.trim()) throw new Error('脚本内容为空')
  if (code.length > MAX_SOURCE) throw new Error('脚本超过 256 KB 限制')
  const tokens: Token[] = []
  let index = 0
  let line = 1
  const add = (text: string, kind: Token['kind'], at = line) => {
    tokens.push({ text, kind, line: at })
    if (tokens.length > 16000) throw new Error('脚本过于复杂')
  }
  while (index < code.length) {
    const char = code[index]
    if (char === '\r' || char === '\n') {
      if (char === '\r' && code[index + 1] === '\n') index++
      add('\n', 'symbol'); line++; index++; continue
    }
    if (/\s/.test(char)) { index++; continue }
    if ((language === 'vbscript' && char === "'") || (language === 'javascript' && code.startsWith('//', index))) {
      while (index < code.length && !/[\r\n]/.test(code[index])) index++
      continue
    }
    if (language === 'javascript' && code.startsWith('/*', index)) {
      index += 2
      while (index < code.length && !code.startsWith('*/', index)) {
        if (code[index] === '\n') { add('\n', 'symbol'); line++ }
        index++
      }
      if (index >= code.length) throw new Error(`第 ${line} 行：块注释未闭合`)
      index += 2; continue
    }
    if (char === '"' || (language === 'javascript' && char === "'")) {
      const quote = char
      const at = line
      let text = ''
      let closed = false
      index++
      while (index < code.length) {
        const current = code[index++]
        if (current === quote) {
          if (language === 'vbscript' && code[index] === quote) { text += quote; index++; continue }
          closed = true; break
        }
        if (/[\r\n]/.test(current)) throw new Error(`第 ${at} 行：字符串不能直接换行`)
        if (language === 'javascript' && current === '\\') {
          const escape = code[index++]
          const escapes: Record<string, string> = { n: '\n', r: '\r', t: '\t', b: '\b', f: '\f', '\\': '\\', '"': '"', "'": "'" }
          if (escape === 'u' || escape === 'x') {
            const length = escape === 'u' ? 4 : 2
            const hex = code.slice(index, index + length)
            if (!new RegExp(`^[0-9a-fA-F]{${length}}$`).test(hex)) throw new Error(`第 ${at} 行：无效字符串转义`)
            text += String.fromCharCode(parseInt(hex, 16)); index += length
          } else if (escape in escapes) text += escapes[escape]
          else throw new Error(`第 ${at} 行：不支持的字符串转义`)
        } else text += current
      }
      if (!closed) throw new Error(`第 ${at} 行：字符串未闭合`)
      add(text, 'string', at); continue
    }
    const number = code.slice(index).match(/^(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?/)
    if (number) { add(number[0], 'number'); index += number[0].length; continue }
    const identifier = code.slice(index).match(/^[A-Za-z_$][\w$]*/)
    if (identifier) {
      const text = identifier[0]
      if (language === 'vbscript' && text.toLowerCase() === 'rem' && (!tokens.length || ['\n', ':'].includes(tokens[tokens.length - 1].text))) {
        while (index < code.length && !/[\r\n]/.test(code[index])) index++
        continue
      }
      if (forbidden.has(text.toLowerCase())) throw new Error(`第 ${line} 行：不允许使用 ${text}`)
      add(text, 'id'); index += text.length; continue
    }
    const op = ['===', '!==', '>=', '<=', '==', '!=', '<>', '&&', '||'].find((item) => code.startsWith(item, index))
    if (op) { add(op, 'symbol'); index += op.length; continue }
    if ('(){}+-*/%&=<>!?:;,.\\^'.includes(char)) { add(char, 'symbol'); index++; continue }
    throw new Error(`第 ${line} 行：不支持的字符 ${char}`)
  }
  add('', 'end')
  return tokens
}

class Parser {
  private index = 0
  private depth = 0
  private groups = 0
  constructor(private tokens: Token[], readonly language: ScriptLanguage) {}
  private get token(): Token {
    while (this.groups && this.tokens[this.index].text === '\n') this.index++
    return this.tokens[this.index]
  }
  private is(text: string): boolean { return this.token.kind !== 'string' && key(this.token.text, this.language) === key(text, this.language) }
  private take(text: string): boolean { if (!this.is(text)) return false; this.index++; return true }
  private expect(text: string): void { if (!this.take(text)) this.fail(`需要 ${text}`) }
  private fail(message: string): never { throw new Error(`第 ${this.token.line} 行：${message}（${this.token.text || '脚本结束'}）`) }
  private identifier(): string {
    if (this.token.kind !== 'id') this.fail('需要变量名')
    const reserved = ['if', 'then', 'else', 'elseif', 'end', 'function', 'return', 'dim', 'let', 'const', 'var', 'true', 'false', 'null', 'undefined', 'empty', 'and', 'or', 'not', 'mod', 'for', 'while', 'do', 'new', 'class', 'throw', 'try', 'switch', 'option']
    if (reserved.includes(key(this.token.text, this.language))) this.fail('保留字不能用作变量名')
    return this.tokens[this.index++].text
  }
  private separators(): void { while (this.take('\n') || this.take(';') || (this.language === 'vbscript' && this.take(':'))) { /* statement boundaries */ } }
  private boundary(): void {
    if (this.token.kind === 'end' || ['\n', ';', ':', '}'].some((value) => this.is(value))) return
    this.fail('语句之间需要换行或分隔符')
  }
  private nested<T>(read: () => T): T {
    if (++this.depth > 64) this.fail('嵌套超过 64 层限制')
    try { return read() } finally { this.depth-- }
  }
  private group<T>(read: () => T): T {
    this.groups++
    try { const result = read(); this.expect(')'); return result } finally { this.groups-- }
  }
  parse(): ScriptProgram {
    const functions = new Map<string, Statement[]>()
    const body: Statement[] = []
    let explicit = false
    this.separators()
    if (this.language === 'vbscript' && this.take('Option')) { this.expect('Explicit'); explicit = true; this.boundary(); this.separators() }
    while (this.token.kind !== 'end') {
      let name: string | undefined
      if (this.take('function')) name = this.identifier()
      else if (this.language === 'javascript' && this.token.kind === 'id' && this.tokens[this.index + 1]?.text === '=' && this.tokens[this.index + 2]?.text === 'function') {
        name = this.identifier(); this.expect('='); this.expect('function')
      }
      if (name !== undefined) {
        if (!hooks.has(name.toLowerCase())) this.fail('仅支持 OnGetData 和打印生命周期函数')
        this.expect('(')
        if (!this.take(')')) {
          const parameter = this.identifier()
          if (parameter !== 'State' && !(this.language === 'vbscript' && parameter.toLowerCase() === 'state')) this.fail('生命周期参数仅支持 State')
          this.expect(')')
        }
        const functionKey = key(name, this.language)
        if (functions.has(functionKey)) this.fail('函数重复定义')
        let statements: Statement[]
        if (this.language === 'javascript') { this.expect('{'); statements = this.block(['}']); this.expect('}') }
        else { this.boundary(); this.separators(); statements = this.block(['End']); this.expect('End'); this.expect('Function') }
        functions.set(functionKey, statements)
        this.boundary()
      } else body.push(...this.statement())
      this.separators()
    }
    if (functions.size && body.length) this.fail('函数外的执行语句不受支持')
    if (!functions.size && !body.length) this.fail('脚本没有可执行语句')
    return { language: this.language, functions, body, explicit }
  }
  private block(stops: string[]): Statement[] {
    return this.nested(() => {
      const result: Statement[] = []
      this.separators()
      while (this.token.kind !== 'end' && !stops.some((stop) => this.is(stop))) {
        result.push(...this.statement()); this.separators()
      }
      return result
    })
  }
  private statement(): Statement[] {
    if (this.take('if')) {
      let condition: Expr
      let yes: Statement[]
      let no: Statement[] = []
      if (this.language === 'javascript') {
        this.expect('('); condition = this.group(() => this.expression()); this.expect('{')
        yes = this.block(['}']); this.expect('}')
        const beforeElse = this.index
        while (this.take('\n')) { /* Only line breaks may precede else. */ }
        if (this.take('else')) {
          if (this.is('if')) no = this.nested(() => this.statement())
          else { this.expect('{'); no = this.block(['}']); this.expect('}') }
        } else this.index = beforeElse
      } else {
        condition = this.expression(); this.expect('Then')
        if (!this.is('\n') && this.token.kind !== 'end') {
          yes = this.inlineStatements()
          if (this.take('Else')) no = this.inlineStatements()
          return [{ kind: 'if', condition, yes, no }]
        }
        this.separators(); yes = this.block(['Else', 'ElseIf', 'End'])
        if (this.take('ElseIf')) no = this.vbElseIf()
        else if (this.take('Else')) { this.boundary(); this.separators(); no = this.block(['End']) }
        this.expect('End'); this.expect('If')
      }
      if (this.language === 'vbscript') this.boundary()
      return [{ kind: 'if', condition, yes, no }]
    }
    if (this.take('return')) { const value = this.expression(); this.boundary(); return [{ kind: 'return', value }] }
    const declaration = this.language === 'vbscript' ? this.take('Dim') : this.is('let') || this.is('const') || this.is('var')
    if (declaration) {
      let constant = false
      let functionScoped = true
      if (this.language === 'javascript') { constant = this.take('const'); functionScoped = !constant && this.take('var'); if (!constant && !functionScoped) this.expect('let') }
      const declarations: Statement[] = []
      do {
        const name = this.identifier()
        const value = this.take('=') ? this.expression() : undefined
        if (constant && !value) this.fail('const 必须初始化')
        declarations.push({ kind: 'declare', name, value, constant, functionScoped })
      } while (this.take(','))
      this.boundary(); return declarations
    }
    const name = this.identifier()
    this.expect('=')
    const value = this.expression()
    // Else can terminate a VB single-line assignment.
    if (!(this.language === 'vbscript' && this.is('Else'))) this.boundary()
    return [{ kind: 'assign', name, value }]
  }
  private vbElseIf(): Statement[] {
    return this.nested(() => {
      const condition = this.expression(); this.expect('Then'); this.boundary(); this.separators()
      const yes = this.block(['Else', 'ElseIf', 'End'])
      let no: Statement[] = []
      if (this.take('ElseIf')) no = this.vbElseIf()
      else if (this.take('Else')) { this.boundary(); this.separators(); no = this.block(['End']) }
      return [{ kind: 'if', condition, yes, no }]
    })
  }
  private inlineStatements(): Statement[] {
    return this.nested(() => {
      const statements = this.statement()
      while (this.take(':')) {
        if (this.is('\n') || this.is('Else') || this.token.kind === 'end') break
        statements.push(...this.statement())
      }
      return statements
    })
  }
  private precedence(op: string): number {
    const js: Record<string, number> = { '||': 1, '&&': 2, '===': 3, '!==': 3, '==': 3, '!=': 3, '=': 3, '<>': 3, '>': 4, '<': 4, '>=': 4, '<=': 4, '&': 5, '+': 6, '-': 6, '*': 7, '/': 7, '%': 7 }
    const vb: Record<string, number> = { or: 1, and: 2, '=': 4, '<>': 4, '==': 4, '!=': 4, '===': 4, '!==': 4, '>': 4, '<': 4, '>=': 4, '<=': 4, '&': 5, '+': 6, '-': 6, '*': 7, '/': 7, '\\': 7, mod: 7, '%': 7, '^': 9 }
    return (this.language === 'vbscript' ? vb : js)[op] ?? 0
  }
  private expression(minimum = 0): Expr {
    return this.nested(() => {
      const token = this.token
      let left: Expr
      if (this.take('!') || (this.language === 'vbscript' && this.take('Not')) || this.take('+') || this.take('-')) {
        left = { kind: 'unary', op: key(token.text, this.language), value: this.expression(this.language === 'vbscript' && token.text.toLowerCase() === 'not' ? 3 : 8) }
      } else if (this.take('(')) { left = this.group(() => this.expression()) }
      else if (token.kind === 'number' || token.kind === 'string') {
        this.index++; left = { kind: 'literal', value: token.kind === 'number' ? Number(token.text) : token.text }
      } else if (token.kind === 'id') {
        const literalName = key(token.text, this.language)
        const name = ['true', 'false', 'null', 'undefined', 'empty'].includes(literalName) ? this.tokens[this.index++].text : this.identifier()
        if (['true', 'false'].includes(literalName)) left = { kind: 'literal', value: literalName === 'true' }
        else if (['null', 'undefined', ...(this.language === 'vbscript' ? ['empty'] : [])].includes(literalName)) left = { kind: 'literal', value: '' }
        else if (this.take('(')) {
          const args = this.group(() => {
            const values: Expr[] = []
            if (!this.is(')')) { do { values.push(this.expression()) } while (this.take(',')) }
            return values
          })
          const limits = arities[name.toLowerCase()]
          if (!limits || args.length < limits[0] || args.length > limits[1]) this.fail('未知函数或参数数量不正确')
          left = { kind: 'call', name, args }
        } else left = { kind: 'name', name }
      } else this.fail('需要表达式')
      while (this.take('.')) {
        if (this.language !== 'javascript') this.fail('VBScript 不支持成员访问')
        const name = this.identifier()
        if (!['toUpperCase', 'toLowerCase', 'trim', 'length'].includes(name)) this.fail('不支持的成员访问')
        const call = this.take('(')
        if (call) this.expect(')')
        if (name !== 'length' && !call) this.fail('字符串方法必须调用')
        left = { kind: 'member', value: left, name, call }
      }
      while (this.token.kind !== 'string') {
        const op = key(this.token.text, this.language)
        const precedence = this.precedence(op)
        if (!precedence || precedence < minimum) break
        this.index++
        left = { kind: 'binary', op, left, right: this.expression(op === '^' ? precedence : precedence + 1) }
      }
      if (minimum === 0 && this.take('?')) {
        const yes = this.expression(); this.expect(':'); left = { kind: 'choice', condition: left, yes, no: this.expression() }
      }
      return left
    })
  }
}

const cache = new Map<string, ScriptProgram>()
let cacheBytes = 0
export function compileScript(code: string, declaredLanguage: ScriptLanguage = 'javascript'): ScriptProgram {
  if (typeof code !== 'string' || code.length > MAX_SOURCE) throw new Error('脚本超过 256 KB 限制或类型无效')
  const cacheKey = `${declaredLanguage}:${code}`
  const cached = cache.get(cacheKey)
  if (cached) return cached
  let program: ScriptProgram
  try { program = new Parser(tokenize(code, declaredLanguage), declaredLanguage).parse() }
  catch (error) {
    // Infer legacy function syntax from a parsed program, never from strings or comments.
    const otherLanguage = declaredLanguage === 'javascript' ? 'vbscript' : 'javascript'
    try {
      program = new Parser(tokenize(code, otherLanguage), otherLanguage).parse()
      if (!program.functions.size) throw error
    } catch { throw error }
  }
  validateBindings(program)
  if (cache.size >= 128 || cacheBytes + code.length > 1024 * 1024) { cache.clear(); cacheBytes = 0 }
  cache.set(cacheKey, program); cacheBytes += code.length
  return program
}

function checked(value: Value): Value {
  if (typeof value === 'number' && !Number.isFinite(value)) throw new Error('计算结果不是有限数值')
  if (typeof value === 'string' && value.length > MAX_STRING) throw new Error('脚本输出过长')
  return value
}
function numeric(value: Value): number {
  const result = Number(value)
  if (!Number.isFinite(result)) throw new Error('无效数字')
  return result
}
function builtin(name: string, args: Value[]): Value {
  const text = String(args[0])
  const length = () => { const result = Math.trunc(numeric(args[1])); if (result < 0 || result > MAX_STRING) throw new Error('长度超出限制'); return result }
  switch (name.toLowerCase()) {
    case 'cstr': return text
    case 'cdbl': return numeric(args[0])
    case 'cint': case 'clng': { const n = numeric(args[0]); const floor = Math.floor(n); return n - floor === 0.5 ? (floor % 2 === 0 ? floor : floor + 1) : Math.round(n) }
    case 'string': {
      if (args.length === 1) return text
      const count = Math.trunc(numeric(args[0]))
      if (count < 0 || count > MAX_STRING) throw new Error('String 长度超出限制')
      return String(args[1]).slice(0, 1).repeat(count)
    }
    case 'len': return text.length
    case 'ucase': return text.toUpperCase()
    case 'lcase': return text.toLowerCase()
    case 'trim': return text.trim()
    case 'left': return text.slice(0, length())
    case 'right': { const n = length(); return n ? text.slice(-n) : '' }
    case 'mid': { const start = Math.trunc(numeric(args[1])); if (start < 1) throw new Error('Mid 起始位置必须大于零'); const n = args.length === 3 ? Math.trunc(numeric(args[2])) : text.length; if (n < 0) throw new Error('Mid 长度不能为负'); return text.slice(start - 1, start - 1 + n) }
    case 'replace': {
      const search = String(args[1])
      if (!search) return text
      const pieces = text.split(search)
      if (text.length + (pieces.length - 1) * (String(args[2]).length - search.length) > MAX_STRING) throw new Error('替换结果过长')
      return pieces.join(String(args[2]))
    }
    case 'abs': return Math.abs(numeric(args[0]))
    case 'formatnumber': { const digits = args.length > 1 ? Math.trunc(numeric(args[1])) : 2; if (digits < 0 || digits > 20) throw new Error('小数位数超出限制'); return numeric(args[0]).toFixed(digits) }
    case 'mod10': { if (!/^\d+$/.test(text)) throw new Error('校验字符要求数字内容'); let sum = 0; for (let i = text.length - 1, weight = 3; i >= 0; i--, weight = weight === 3 ? 1 : 3) sum += Number(text[i]) * weight; return (10 - sum % 10) % 10 }
    default: throw new Error('未知函数')
  }
}

interface Binding { name: string; value: Value; constant: boolean; initialized: boolean }
export function executeScript(program: ScriptProgram, initial: Record<string, Value>, functionName = 'OnGetData'): { value: Value; values: Record<string, Value>; assigned: Set<string> } {
  const globals = new Map<string, Binding>()
  const scopes: Map<string, Binding>[] = [new Map()]
  const assigned = new Set<string>()
  const canonical = (name: string) => key(name, program.language)
  const stringSize = (value: Value) => typeof value === 'string' ? value.length : 0
  let retainedChars = 0
  let processedChars = 0
  const retain = (value: Value, oldValue: Value = '') => {
    checked(value)
    const next = retainedChars + stringSize(value) - stringSize(oldValue)
    if (next > MAX_STATE_STRING) throw new Error('脚本变量字符串总量超过 4M 字符限制')
    retainedChars = next
  }
  const produced = (value: Value): Value => {
    checked(value)
    processedChars += stringSize(value)
    if (processedChars > MAX_STRING_WORK) throw new Error('脚本字符串处理总量超过限制')
    return value
  }
  for (const [name, value] of Object.entries(initial)) {
    const id = canonical(name)
    retain(value, globals.get(id)?.value)
    globals.set(id, { name, value, constant: false, initialized: true })
  }
  const find = (name: string): Binding | undefined => {
    const id = canonical(name)
    for (let i = scopes.length - 1; i >= 0; i--) { const value = scopes[i].get(id); if (value) return value }
    return globals.get(id)
  }
  const objectScript = canonical(functionName) === canonical('OnGetData')
  if (objectScript) scopes[0].set(canonical('OnGetData'), { name: 'OnGetData', value: '', constant: false, initialized: true })
  const statements = program.functions.size ? program.functions.get(canonical(functionName)) : program.body
  const hoist = (body: Statement[]): void => {
    for (const statement of body) {
      if (statement.kind === 'if') { hoist(statement.yes); hoist(statement.no) }
      else if (statement.kind === 'declare' && statement.functionScoped) {
        scopes[0].set(canonical(statement.name), { name: statement.name, value: '', constant: false, initialized: true })
      }
    }
  }
  if (statements) hoist(statements)
  let steps = 0
  const tick = () => { if (++steps > 20000) throw new Error('脚本执行超过限制') }
  const evaluate = (expr: Expr): Value => {
    tick()
    switch (expr.kind) {
      case 'literal': return checked(expr.value)
      case 'name': { const value = find(expr.name); if (!value) throw new Error(`未知变量 ${expr.name}`); if (!value.initialized) throw new Error(`变量尚未初始化 ${expr.name}`); return value.value }
      case 'unary': { const value = evaluate(expr.value); return checked(expr.op === '!' || expr.op === 'not' ? !Boolean(value) : expr.op === '-' ? -numeric(value) : numeric(value)) }
      case 'choice': return evaluate(evaluate(expr.condition) ? expr.yes : expr.no)
      case 'call': return produced(builtin(expr.name, expr.args.map(evaluate)))
      case 'member': { const value = String(evaluate(expr.value)); return produced(expr.name === 'length' ? value.length : expr.name === 'trim' ? value.trim() : expr.name === 'toUpperCase' ? value.toUpperCase() : value.toLowerCase()) }
      case 'binary': {
        const left = evaluate(expr.left)
        if (expr.op === '&&') return left ? evaluate(expr.right) : left
        if (expr.op === '||') return left ? left : evaluate(expr.right)
        const right = evaluate(expr.right)
        switch (expr.op) {
          case 'and': return Boolean(left) && Boolean(right)
          case 'or': return Boolean(left) || Boolean(right)
          case '===': return left === right
          case '!==': return left !== right
          case '=': case '==': return left === right || String(left) === String(right)
          case '<>': case '!=': return !(left === right || String(left) === String(right))
          case '>': return typeof left === 'string' && typeof right === 'string' ? left > right : numeric(left) > numeric(right)
          case '<': return typeof left === 'string' && typeof right === 'string' ? left < right : numeric(left) < numeric(right)
          case '>=': return typeof left === 'string' && typeof right === 'string' ? left >= right : numeric(left) >= numeric(right)
          case '<=': return typeof left === 'string' && typeof right === 'string' ? left <= right : numeric(left) <= numeric(right)
          case '&': return produced(String(left) + String(right))
          case '+': return produced(typeof left === 'string' || typeof right === 'string' ? String(left) + String(right) : numeric(left) + numeric(right))
          case '-': return checked(numeric(left) - numeric(right))
          case '*': return checked(numeric(left) * numeric(right))
          case '/': return checked(numeric(left) / numeric(right))
          case '\\': return checked(Math.trunc(numeric(left) / numeric(right)))
          case '%': case 'mod': return checked(numeric(left) % numeric(right))
          case '^': return checked(numeric(left) ** numeric(right))
          default: throw new Error('未知运算符')
        }
      }
    }
  }
  const run = (statements: Statement[], block = false): { value: Value } | undefined => {
    if (block && program.language === 'javascript') scopes.push(new Map())
    const currentScope = scopes[scopes.length - 1]
    for (const statement of statements) {
      if (statement.kind === 'declare' && !statement.functionScoped) currentScope.set(canonical(statement.name), { name: statement.name, value: '', constant: statement.constant, initialized: false })
    }
    try {
      for (const statement of statements) {
        tick()
        if (statement.kind === 'return') return { value: evaluate(statement.value) }
        if (statement.kind === 'if') { const result = run(evaluate(statement.condition) ? statement.yes : statement.no, true); if (result) return result; continue }
        const id = canonical(statement.name)
        if (statement.kind === 'declare') {
          const scope = statement.functionScoped ? scopes[0] : scopes[scopes.length - 1]
          const binding = scope.get(id)!
          if (statement.value) {
            const value = evaluate(statement.value)
            retain(value, binding.value)
            binding.value = value
          }
          binding.initialized = true
        } else {
          const value = evaluate(statement.value)
          const existing = find(statement.name)
          if (existing && !existing.initialized) throw new Error(`变量尚未初始化 ${statement.name}`)
          if (existing?.constant) throw new Error('不能修改 const 变量')
          retain(value, existing?.value)
          if (existing) existing.value = value
          else globals.set(id, { name: statement.name, value, constant: false, initialized: true })
          if (globals.get(id) === find(statement.name)) assigned.add(id)
        }
      }
      return undefined
    } finally {
      if (block && program.language === 'javascript') {
        for (const binding of scopes.pop()!.values()) retainedChars -= stringSize(binding.value)
      }
    }
  }
  const result = statements ? run(statements) : undefined
  const value = result?.value ?? (objectScript ? find('OnGetData')?.value ?? '' : '')
  if (retainedChars + stringSize(value) > MAX_STATE_STRING) throw new Error('脚本结果和变量字符串总量超过限制')
  return { value, values: Object.fromEntries([...globals.values()].map((binding) => [binding.name, binding.value])), assigned }
}

export function hasScriptReturn(program: ScriptProgram): boolean {
  const statements = program.functions.get(key('OnGetData', program.language)) ?? (program.functions.size ? undefined : program.body)
  if (!statements) return false
  const contains = (body: Statement[]): boolean => body.some((item) => item.kind === 'return' || (item.kind === 'assign' && key(item.name, program.language) === key('OnGetData', program.language)) || (item.kind === 'if' && (contains(item.yes) || contains(item.no))))
  return contains(statements)
}

export function hasScriptFunction(program: ScriptProgram, name: string): boolean {
  return program.functions.has(key(name, program.language))
}

function validateBindings(program: ScriptProgram): void {
  const predefined = new Set(['v_page', 'v_copy', 'v_labelno', 'v_row', 'v_col', 'v_totallabels', 'v_startno', 'v_title', 'v_printer', 'state', 'ongetdata'])
  const declared = (name: string, scopes: Map<string, boolean>[]) => scopes.some((scope) => scope.has(key(name, program.language))) || predefined.has(name.toLowerCase())
  const expression = (expr: Expr, scopes: Map<string, boolean>[]): void => {
    const pending: Array<{ expr: Expr; depth: number }> = [{ expr, depth: 1 }]
    while (pending.length) {
      const current = pending.pop()!
      if (current.depth > 64) throw new Error('表达式嵌套超过 64 层限制')
      const node = current.expr
      if (program.explicit && node.kind === 'name' && !declared(node.name, scopes)) throw new Error(`Option Explicit：变量未声明 ${node.name}`)
      const children = node.kind === 'unary' || node.kind === 'member' ? [node.value]
        : node.kind === 'binary' ? [node.left, node.right]
        : node.kind === 'choice' ? [node.condition, node.yes, node.no]
        : node.kind === 'call' ? node.args : []
      for (const child of children) pending.push({ expr: child, depth: current.depth + 1 })
    }
  }
  const validate = (body: Statement[], scopes: Map<string, boolean>[]): void => {
    if (program.language === 'javascript') {
      // A var anywhere inside this block conflicts with its direct lexical declarations.
      const variables = functionScope(body)
      for (const statement of body) {
        if (statement.kind === 'declare' && !statement.functionScoped && variables.has(statement.name)) {
          throw new Error(`变量重复声明：${statement.name}`)
        }
      }
    }
    for (const statement of body) {
      if (statement.kind === 'if') {
        expression(statement.condition, scopes)
        validate(statement.yes, program.language === 'javascript' ? [...scopes, new Map()] : scopes)
        validate(statement.no, program.language === 'javascript' ? [...scopes, new Map()] : scopes)
      } else if (statement.kind === 'declare') {
        const name = key(statement.name, program.language)
        const scope = statement.functionScoped ? scopes[0] : scopes[scopes.length - 1]
        if (!statement.functionScoped) {
          if (scope.has(name)) throw new Error(`变量重复声明：${statement.name}`)
          scope.set(name, statement.constant)
        }
        if (statement.value) expression(statement.value, scopes)
      } else if (statement.kind === 'assign') {
        if (program.explicit && !declared(statement.name, scopes)) throw new Error(`Option Explicit：变量未声明 ${statement.name}`)
        expression(statement.value, scopes)
        const name = key(statement.name, program.language)
        for (let i = scopes.length - 1; i >= 0; i--) {
          if (!scopes[i].has(name)) continue
          if (scopes[i].get(name)) throw new Error(`不能修改 const 变量：${statement.name}`)
          break
        }
      } else expression(statement.value, scopes)
    }
  }
  const functionScope = (body: Statement[]): Map<string, boolean> => {
    const scope = new Map<string, boolean>()
    const collect = (statements: Statement[]): void => {
      for (const statement of statements) {
        if (statement.kind === 'if') { collect(statement.yes); collect(statement.no) }
        else if (statement.kind === 'declare' && statement.functionScoped) {
          const name = key(statement.name, program.language)
          if (scope.has(name)) throw new Error(`变量重复声明：${statement.name}`)
          scope.set(name, false)
        }
      }
    }
    collect(body)
    return scope
  }
  validate(program.body, [functionScope(program.body)])
  for (const body of program.functions.values()) validate(body, [functionScope(body)])
}
