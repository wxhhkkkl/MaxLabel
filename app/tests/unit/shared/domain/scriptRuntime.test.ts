import { Script } from 'node:vm'
import { describe, expect, it } from 'vitest'
import type { LabelDoc } from '@shared/domain/document'
import { checkScriptSyntax, PREDEFINED_SCRIPTS, resolveSourceText, runGlobalScriptHook, runScriptSource } from '@shared/domain/datasource'
import { buildPrintPlan } from '@shared/print/plan'
import { resolvePrintJob } from '@shared/print/scene'
import { compileScript, executeScript } from '@shared/domain/scriptRuntime'
import { dataCtx } from '../../../helpers/factories'

const context = dataCtx({
  allowScript: true,
  labelIndex: 3,
  recordIndex: 1,
  copy: 1,
  count: 3,
  totalLabels: 3,
  title: 'Title',
  printerName: 'Printer',
  sharedVars: { N: '0', Mixed: 'shared' }
})

const vb = (body: string) => `Function OnGetData()\n${body}\nEnd Function`
const js = (body: string) => `function OnGetData() {\n${body}\n}`

describe('VB script semantics', () => {
  it.each([
    [vb('Dim x\nx = 2\nOnGetData = x + 1'), '3'],
    [vb('Dim X\nx = 2\nOnGetData = X + 1'), '3'],
    [vb('Dim a, b\na = 2\nb = 3\nOnGetData = a * b'), '6'],
    [vb('Dim Mixed\nMixed = "local"\nOnGetData = Mixed'), 'local'],
    [vb('If False Then\nOnGetData = "wrong"\nElse\nOnGetData = "right"\nEnd If'), 'right'],
    [vb('If False Then\nIf UNKNOWN > 0 Then\nOnGetData = "wrong"\nEnd If\nElse\nOnGetData = "right"\nEnd If'), 'right'],
    [vb('If V_LABELNO = 1 Then\nOnGetData = "one"\nElseIf V_LABELNO = 3 Then\nOnGetData = "three"\nElse\nOnGetData = "other"\nEnd If'), 'three'],
    [vb('If False Then OnGetData = "wrong" Else OnGetData = "right"'), 'right'],
    [vb('OnGetData = "first"\nOnGetData = "last"'), 'last'],
    [vb('Return "early"\nOnGetData = "late"'), 'early'],
    [vb('Rem window process forbidden words in comments\nOnGetData = "https://example.com/A;B"'), 'https://example.com/A;B'],
    [vb('OnGetData = "(window) ""quoted"" C:\\folder\\"'), '(window) "quoted" C:\\folder\\'],
    [vb('OnGetData = Not 2 = 3 And True'), 'true'],
    [vb('OnGetData = False Or (2 < 3 And Not False)'), 'true'],
    [vb('OnGetData = 2 ^ 3 ^ 2'), '512'],
    [vb('OnGetData = -2 ^ 2'), '-4'],
    [vb('OnGetData = 7 \\ 2 + 8 Mod 3'), '5'],
    [vb('OnGetData = Left(UCase("abc"), 2) & Right("xyz", 1)'), 'ABz'],
    [vb('OnGetData = Mid("abcdef", 2, 3)'), 'bcd'],
    [vb('OnGetData = Len(Trim(" abc "))'), '3'],
    [vb('OnGetData = Replace("a-b-a", "a", "x")'), 'x-b-x'],
    [vb('OnGetData = FormatNumber(12.5, 2)'), '12.50'],
    [vb('OnGetData = CInt(2.5) & "," & CLng(3.5) & "," & CDbl("1.5")'), '2,4,1.5'],
    [vb('OnGetData = String(3, "x")'), 'xxx'],
    [vb('OnGetData = Mod10("123456789012")'), '8'],
    ['Option Explicit\n' + vb('OnGetData = V_TITLE'), 'Title'],
    ['ongetdata = "lowercase"', 'lowercase']
  ])('evaluates %#', (code, expected) => {
    expect(checkScriptSyntax(code, 'vbscript').ok).toBe(true)
    expect(runScriptSource(code, context, 'vbscript')).toBe(expected)
  })
})

describe('JavaScript script semantics', () => {
  it.each([
    [js('let x = 2; x = x + 1; return x;'), '3'],
    [js('let n = 9; return N;'), '0'],
    [js('const x = 2; return x * 3;'), '6'],
    [js('if (false) { return "wrong"; } else { return "right"; }'), 'right'],
    [js('if (false) { return "one"; } else if (V_LABELNO === 3) { return "three"; } else { return "other"; }'), 'three'],
    [js('if (true) { let Mixed = "local"; }\nreturn Mixed;'), 'shared'],
    [js('if (true) { var x = 9; }\nreturn x;'), '9'],
    [js('return "early"; return "late";'), 'early'],
    [js('return false && UNKNOWN;'), 'false'],
    [js('return true || UNKNOWN;'), 'true'],
    [js('return true ? false ? 1 : 2 : UNKNOWN;'), '2'],
    [js('return " aBc ".trim().toUpperCase();'), 'ABC'],
    [js('return "abc".length;'), '3'],
    [js('return "abc".length();'), '3'],
    [js('return (\n  2 +\n  3\n) * 4;'), '20'],
    [js('return String(\nV_LABELNO\n);'), '3'],
    [js('/* } window */ return "https://example.com/A;B"; // { process'), 'https://example.com/A;B'],
    [js('return "\\u4e2d\\x41\\n\\t\\\\";'), '中A\n\t\\'],
    [js('return "window document fetch process for while";'), 'window document fetch process for while'],
    [js('return "Function OnGetData() End Function";'), 'Function OnGetData() End Function'],
    ['OnGetData = "bare";', 'bare'],
    ['OnGetData = function() { return "assigned function"; };', 'assigned function']
  ])('evaluates %#', (code, expected) => {
    expect(checkScriptSyntax(code, 'javascript').ok).toBe(true)
    expect(runScriptSource(code, context, 'javascript')).toBe(expected)
  })
})

describe('sandbox and diagnostics', () => {
  it('rejects invalid or unsafe programs without executing them', () => {
    const rejected = [
      ['', 'vbscript'],
      [vb('OnGetData = (1 + 2'), 'vbscript'],
      [vb('OnGetData = "bad'), 'vbscript'],
      ['Option Explicit\n' + vb('x = 1\nOnGetData = x'), 'vbscript'],
      ['Option Explicit\n' + vb('OnGetData = unknown'), 'vbscript'],
      [vb('OnGetData = UNKNOWN_FN(1)'), 'vbscript'],
      [vb('If True Then\nOnGetData = 1'), 'vbscript'],
      [vb('Else\nOnGetData = 1'), 'vbscript'],
      [vb('Dim x\nDim X\nOnGetData = 1'), 'vbscript'],
      [vb('OnGetData = 1 garbage'), 'vbscript'],
      [vb('OnGetData = Left("a")'), 'vbscript'],
      [vb('For i = 1 To 9\nOnGetData = i\nNext'), 'vbscript'],
      [vb('OnGetData = window'), 'vbscript'],
      [js('return "bad\\q";'), 'javascript'],
      [js('return 1; /* unclosed'), 'javascript'],
      [js('while(true) {} return 1;'), 'javascript'],
      [js('return globalThis;'), 'javascript'],
      [js('return "a".constructor;'), 'javascript'],
      [js('return "a".unknown();'), 'javascript'],
      [js('let x = 1; let x = 2; return x;'), 'javascript'],
      [js('const x = 1; x = 2; return x;'), 'javascript'],
      [js('if (false) { return UNKNOWN_FN(1); } return 1;'), 'javascript'],
      ['function OnGetData() { return 1; }\nfunction OnGetData() { return 2; }', 'javascript'],
      ['function Helper() { return 1; }', 'javascript'],
      ['return ' + '('.repeat(80) + '1' + ')'.repeat(80), 'javascript'],
      ['return ' + Array(200).fill('1').join('+') + ';', 'javascript'],
      ['return "' + 'a'.repeat(256 * 1024) + '";', 'javascript']
    ] as const
    for (const [code, language] of rejected) {
      expect(checkScriptSyntax(code, language).ok).toBe(false)
      expect(runScriptSource(code, context, language)).toBe('')
    }
  })

  it('returns empty for runtime errors and respects allowScript', () => {
    for (const code of [js('return 1 / 0;'), js('return UNKNOWN;'), vb('OnGetData = String(1000000000, "x")'), vb('OnGetData = CDbl("bad")')]) {
      expect(checkScriptSyntax(code).ok).toBe(true)
      expect(runScriptSource(code, context)).toBe('')
    }
    expect(runScriptSource(js('return "disabled";'), { ...context, allowScript: false })).toBe('')
  })

  it('agrees with the native V8 parser on declaration and else boundaries', () => {
    for (const body of [
      'if (true) { let x = 1; var x = 2; } return x;',
      'if (true) { var x = 2; let x = 1; } return x;',
      'if (true) { const x = 1; if (false) { var x = 2; } } return x;',
      'let x = 1; if (false) { var x = 2; } return x;',
      'if (false) { return 1; }; else { return 2; }',
      'if (false) { return 1; }\n;\nelse { return 2; }'
    ]) {
      const code = js(body)
      expect(() => new Script(code)).toThrow(SyntaxError)
      expect(checkScriptSyntax(code, 'javascript').ok).toBe(false)
      expect(runScriptSource(code, context, 'javascript')).toBe('')
    }
  })
})

describe('lifecycle, shared state and quotas', () => {
  it('runs global hooks and publishes shared variables without leaking locals', () => {
    const global = 'Function OnBeginPrint(State)\nDim Temporary\nTemporary = 99\nn = CInt(N) + 1\nv_totallabels = 4\nEnd Function'
    expect(checkScriptSyntax(global, 'vbscript', 'global').ok).toBe(true)
    expect(checkScriptSyntax(global, 'vbscript').ok).toBe(false)
    expect(checkScriptSyntax(vb('OnGetData = 1'), 'vbscript', 'global').ok).toBe(false)

    const next = runGlobalScriptHook(global, context, 'OnBeginPrint', 2)
    expect(next.sharedVars.N).toBe('1')
    expect(next.sharedVars.Temporary).toBeUndefined()
    expect(next.totalLabels).toBe(4)
    expect(next.totalLabelsOverridden).toBe(true)
    expect(runGlobalScriptHook(global, context, 'OnEndPrint')).toEqual(context)
    expect(runGlobalScriptHook('N = 100', context, 'OnBeginLabel')).toEqual(context)
  })

  it('blocks malformed global scripts and preserves the caller context', () => {
    const malformed = 'Function OnBeginPrint(State)\nN = 99\nUNKNOWN_CALL(1)\nEnd Function'
    expect(() => runGlobalScriptHook(malformed, context, 'OnBeginPrint')).toThrow(/OnBeginPrint/)
    expect(context.sharedVars.N).toBe('0')
    expect(runGlobalScriptHook('function OnBeginPrint(State) { let Mixed = "local"; N = CInt(N) + 1; }', context, 'OnBeginPrint').sharedVars.Mixed).toBe('shared')
  })

  it('publishes only explicitly named outputs and handles empty/failed output', () => {
    const shared = { ...context, sharedVars: { ...context.sharedVars } }
    expect(resolveSourceText({ kind: 'script', code: vb('Dim x\nx = 8\nOnGetData = x'), language: 'vbscript', sharedName: 'Published' }, shared)).toBe('8')
    expect(shared.sharedVars.Published).toBe('8')
    expect(shared.sharedVars.x).toBeUndefined()

    for (const preset of PREDEFINED_SCRIPTS) {
      expect(checkScriptSyntax(preset.code, 'vbscript').ok).toBe(true)
    }
    expect(runScriptSource(PREDEFINED_SCRIPTS[0].code, context)).toBe('1')
    expect(runScriptSource(PREDEFINED_SCRIPTS[1].code, context)).toBe('2.00')
    expect(runScriptSource(PREDEFINED_SCRIPTS[2].code, context)).toBe('3-2-1')

    const empty = { ...context, sharedVars: { N: 'OLD' }, scriptVars: { N: 'OLD' } }
    resolveSourceText({ kind: 'script', sharedName: 'N', code: 'return "";', language: 'javascript' }, empty)
    expect(empty.sharedVars.N).toBe('')
    expect(empty.scriptVars?.N).toBe('')

    for (const code of ['return 1 / 0;', 'return UNKNOWN;', 'broken source']) {
      const failed = { ...context, sharedVars: { N: 'OLD' }, scriptVars: { N: 'OLD' } }
      resolveSourceText({ kind: 'script', sharedName: 'N', code, language: 'javascript' }, failed)
      expect(failed.sharedVars.N).toBe('OLD')
      expect(failed.scriptVars?.N).toBe('OLD')
    }
  })

  it('enforces retained-string and processing quotas', () => {
    const retained = Array.from({ length: 4 }, (_, i) => `A${i}=String(1048576,"x");`).join('')
    expect(Object.keys(executeScript(compileScript(`function OnBeginPrint(State) {${retained}}`), {}, 'OnBeginPrint').values)).toHaveLength(4)
    expect(String(executeScript(compileScript(`function OnBeginPrint(State) {${Array(10).fill('A=String(1048576,"x");').join('')}}`), {}, 'OnBeginPrint').values.A).length).toBe(1048576)
    const expensive = `function OnBeginPrint(State) {${Array(17).fill('A=String(1048576,"x");').join('')}}`
    expect(() => executeScript(compileScript(expensive), {}, 'OnBeginPrint')).toThrow(/处理总量/)
  })

  it('preserves numeric/boolean typed state across print batches', () => {
    const plan = buildPrintPlan({ test: false, requestedCount: 3, recordStart: 0, cellsPerPage: 1, defaultCopies: 1 })
    for (const language of ['vbscript', 'javascript'] as const) {
      const globalScript = language === 'vbscript'
        ? 'Function OnBeginPrint(State)\nN = 0\nFlag = False\nEnd Function\nFunction OnBeginLabel()\nIf Flag Then\nN = 99\nElse\nN = N + 1\nEnd If\nEnd Function'
        : 'function OnBeginPrint(State) { N = 0; Flag = false; }\nfunction OnBeginLabel() { if (Flag) { N = 99; } else { N = N + 1; } }'
      const document: LabelDoc = {
        version: 1,
        name: 'typed variables',
        widthMm: 50,
        heightMm: 30,
        globalScript,
        objects: [
          {
            id: 'text',
            type: 'text',
            x: 1,
            y: 1,
            w: 20,
            h: 5,
            rotation: 0,
            fontFamily: 'Arial',
            fontSize: 3,
            color: '#000000',
            align: 'left',
            bold: false,
            source: { kind: 'script', language, code: language === 'vbscript' ? 'OnGetData = N' : 'return N;' }
          }
        ]
      }
      const begin = runGlobalScriptHook(globalScript, context, 'OnBeginPrint', 2)
      expect(begin.scriptVars?.Flag).toBe(false)
      const state = { sharedVars: { ...begin.sharedVars }, scriptVars: { ...begin.scriptVars } }
      const output: string[] = []
      for (const page of plan.pages) {
        const job = resolvePrintJob(document, begin, undefined, { ...plan, pages: [page] }, { scriptState: state, finishScript: false })
        output.push((job.pages[0].scene.primitives[0] as { value: string }).value)
      }
      expect(output).toEqual(['1', '2', '3'])
      expect(state.scriptVars?.N).toBe(3)
      expect(begin.scriptVars?.N).toBe(0)
    }
  })

  it('matches the seeded arithmetic fuzz corpus', () => {
    let seed = 1729
    const random = () => {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0
      return seed
    }
    type Expr = { code: string; value: number }
    const arithmetic = (depth: number): Expr => {
      if (!depth) {
        const value = random() % 20
        return { code: String(value), value }
      }
      const a = arithmetic(depth - 1)
      const b = arithmetic(depth - 1)
      const op = ['+', '-', '*'][random() % 3]
      return { code: `(${a.code} ${op} ${b.code})`, value: op === '+' ? a.value + b.value : op === '-' ? a.value - b.value : a.value * b.value }
    }
    for (let i = 0; i < 120; i++) {
      const expression = arithmetic(3)
      expect(runScriptSource(`OnGetData = ${expression.code}`, context, 'vbscript')).toBe(String(expression.value))
      expect(runScriptSource(`return ${expression.code};`, context, 'javascript')).toBe(String(expression.value))
    }
  })
})
