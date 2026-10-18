const assert = require('node:assert/strict')
const { load } = require('./persistence-regression.cjs')

async function run() {
  const domain = await load('src/shared/domain/datasource.ts')
  const { checkScriptSyntax, runScriptSource, runGlobalScriptHook, resolveSourceText, PREDEFINED_SCRIPTS } = domain
  const context = { allowScript: true, labelIndex: 3, recordIndex: 1, copy: 1, count: 3, totalLabels: 3, title: 'Title', printerName: 'Printer', datasets: {}, sharedVars: { N: '0', Mixed: 'shared' }, keyboardValues: {} }
  let checks = 0
  const verify = (condition, message) => { assert.ok(condition, message); checks++ }
  const equal = (actual, expected, message) => { assert.deepEqual(actual, expected, message); checks++ }
  const vb = (body) => `Function OnGetData()\n${body}\nEnd Function`
  const js = (body) => `function OnGetData() {\n${body}\n}`
  const good = (code, language, expected) => {
    verify(checkScriptSyntax(code, language).ok, JSON.stringify({ code, result: checkScriptSyntax(code, language) }))
    equal(runScriptSource(code, context, language), expected, code)
  }
  for (const [code, expected] of [
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
  ]) good(code, 'vbscript', expected)
  for (const [code, expected] of [
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
  ]) good(code, 'javascript', expected)
  equal(context.sharedVars, { N: '0', Mixed: 'shared' }, 'object-local writes never change the caller context')
  for (const [code, language] of [
    ['', 'vbscript'], [vb('OnGetData = (1 + 2'), 'vbscript'], [vb('OnGetData = "bad'), 'vbscript'],
    ['Option Explicit\n' + vb('x = 1\nOnGetData = x'), 'vbscript'],
    ['Option Explicit\n' + vb('OnGetData = unknown'), 'vbscript'],
    [vb('OnGetData = UNKNOWN_FN(1)'), 'vbscript'], [vb('If True Then\nOnGetData = 1'), 'vbscript'],
    [vb('Else\nOnGetData = 1'), 'vbscript'], [vb('Dim x\nDim X\nOnGetData = 1'), 'vbscript'],
    [vb('OnGetData = 1 garbage'), 'vbscript'], [vb('OnGetData = Left("a")'), 'vbscript'],
    [vb('For i = 1 To 9\nOnGetData = i\nNext'), 'vbscript'], [vb('OnGetData = window'), 'vbscript'],
    [js('return "bad\\q";'), 'javascript'], [js('return 1; /* unclosed'), 'javascript'],
    [js('while(true) {} return 1;'), 'javascript'], [js('return globalThis;'), 'javascript'],
    [js('return "a".constructor;'), 'javascript'], [js('return "a".unknown();'), 'javascript'],
    [js('let x = 1; let x = 2; return x;'), 'javascript'], [js('const x = 1; x = 2; return x;'), 'javascript'],
    [js('if (false) { return UNKNOWN_FN(1); } return 1;'), 'javascript'],
    ['function OnGetData() { return 1; }\nfunction OnGetData() { return 2; }', 'javascript'],
    ['function Helper() { return 1; }', 'javascript'], ['return ' + '('.repeat(80) + '1' + ')'.repeat(80), 'javascript'],
    ['return ' + Array(200).fill('1').join('+') + ';', 'javascript'],
    ['return "' + 'a'.repeat(256 * 1024) + '";', 'javascript']
  ]) {
    verify(!checkScriptSyntax(code, language).ok, `must reject ${code.slice(0, 150)}`)
    equal(runScriptSource(code, context, language), '', 'rejected syntax must not execute')
  }
  for (const code of [js('return 1 / 0;'), js('return UNKNOWN;'), vb('OnGetData = String(1000000000, "x")'), vb('OnGetData = CDbl("bad")')]) {
    verify(checkScriptSyntax(code).ok, 'valid syntax with a runtime error')
    equal(runScriptSource(code, context), '', 'runtime errors return empty without throwing')
  }
  equal(runScriptSource(js('return "disabled";'), { ...context, allowScript: false }), '')
  const global = 'Function OnBeginPrint(State)\nDim Temporary\nTemporary = 99\nn = CInt(N) + 1\nv_totallabels = 4\nEnd Function'
  verify(checkScriptSyntax(global, 'vbscript', 'global').ok, 'global mode recognizes lifecycle hooks')
  verify(!checkScriptSyntax(global, 'vbscript').ok, 'object mode requires OnGetData')
  verify(!checkScriptSyntax(vb('OnGetData = 1'), 'vbscript', 'global').ok, 'global mode requires a lifecycle hook')
  const next = runGlobalScriptHook(global, context, 'OnBeginPrint', 2)
  equal(next.sharedVars.N, '1')
  equal(next.sharedVars.Temporary, undefined, 'Dim locals do not escape the lifecycle function')
  equal(next.totalLabels, 4)
  equal(next.totalLabelsOverridden, true)
  equal(runGlobalScriptHook(global, context, 'OnEndPrint'), context, 'missing hook must not execute another function')
  equal(runGlobalScriptHook('N = 100', context, 'OnBeginLabel'), context, 'bare code is not repeated for every lifecycle hook')
  const malformed = 'Function OnBeginPrint(State)\nN = 99\nUNKNOWN_CALL(1)\nEnd Function'
  assert.throws(() => runGlobalScriptHook(malformed, context, 'OnBeginPrint'), /OnBeginPrint/); checks++
  equal(context.sharedVars.N, '0', 'invalid global scripts leave context unchanged')
  const withLocal = 'function OnBeginPrint(State) { let Mixed = "local"; N = CInt(N) + 1; }'
  equal(runGlobalScriptHook(withLocal, context, 'OnBeginPrint').sharedVars.Mixed, 'shared')
  const shared = { ...context, sharedVars: { ...context.sharedVars } }
  equal(resolveSourceText({ kind: 'script', code: vb('Dim x\nx = 8\nOnGetData = x'), language: 'vbscript', sharedName: 'Published' }, shared), '8')
  equal(shared.sharedVars.Published, '8', 'only explicitly named object output is published')
  equal(shared.sharedVars.x, undefined)
  for (const preset of PREDEFINED_SCRIPTS) verify(checkScriptSyntax(preset.code, 'vbscript').ok, preset.name)
  equal(runScriptSource(PREDEFINED_SCRIPTS[0].code, context), '1')
  equal(runScriptSource(PREDEFINED_SCRIPTS[1].code, context), '2.00')
  equal(runScriptSource(PREDEFINED_SCRIPTS[2].code, context), '3-2-1')
  good(js('return "compatible";'), 'vbscript', 'compatible')
  good(vb('OnGetData = "compatible"'), 'javascript', 'compatible')
  good(vb('If False Then OnGetData = "wrong": OnGetData = "also wrong"'), 'vbscript', '')
  good(vb('If True Then OnGetData = "first": OnGetData = "last"'), 'vbscript', 'last')
  good(vb('If False Then OnGetData = "wrong": OnGetData = "wrong2" Else OnGetData = "right": OnGetData = "last"'), 'vbscript', 'last')
  good(vb('If False Then OnGetData = "wrong": OnGetData = "wrong2"\nOnGetData = "after"'), 'vbscript', 'after')
  good(vb('If True Then OnGetData = "URL:A;B"'), 'vbscript', 'URL:A;B')
  good(vb('x = 2\nDim x\nOnGetData = x'), 'vbscript', '2')
  good('Option Explicit\n' + vb('x = 2\nDim x\nOnGetData = x'), 'vbscript', '2')
  good(js('x = 2; var x; return x;'), 'javascript', '2')
  good(js('if (false) { var Mixed = "local"; }\nreturn Mixed;'), 'javascript', '')
  for (const code of [js('Mixed = "leak"; let Mixed = "local"; return Mixed;'), js('let Mixed = Mixed; return Mixed;')]) {
    equal(runScriptSource(code, context, 'javascript'), '', 'block-local bindings cannot read or write the shared value before initialization')
  }
  for (const localScript of [
    'function OnBeginPrint(State) { N = 9; var N = 0; }',
    'Function OnBeginPrint(State)\nN = 9\nDim N\nEnd Function'
  ]) equal(runGlobalScriptHook(localScript, context, 'OnBeginPrint').sharedVars.N, '0', 'function-local writes before declarations do not leak')
  for (const comment of ["' function Example() {}", 'Rem function Example() {}']) {
    const code = `${comment}\nFunction OnBeginPrint(State)\nV_TOTALLABELS = 0\nEnd Function`
    verify(checkScriptSyntax(code, 'vbscript', 'global').ok)
    equal(runGlobalScriptHook(code, context, 'OnBeginPrint').totalLabels, 0, 'comments never override VB function syntax')
  }
  good("' function Example() {}\n" + vb('OnGetData = "VB"'), 'javascript', 'VB')
  good('/* Function Example() End Function */\n' + js('return "JS";'), 'vbscript', 'JS')
  const published = runGlobalScriptHook('function OnBeginPrint(State) { N = 1; Flag = false; }', context, 'OnBeginPrint')
  resolveSourceText({ kind: 'script', sharedName: 'N', code: 'return "1";', language: 'javascript' }, published)
  equal(published.scriptVars.N, '1', 'publishing text replaces an equal-looking numeric value')
  equal(runScriptSource('return N + 1;', published, 'javascript'), '11')
  resolveSourceText({ kind: 'script', sharedName: 'Flag', code: 'return "false";', language: 'javascript' }, published)
  equal(published.scriptVars.Flag, 'false')
  equal(runScriptSource('return Flag ? "text" : "boolean";', published, 'javascript'), 'text')
  const { compileScript, executeScript } = await load('src/shared/domain/scriptRuntime.ts')
  const largeState = 'function OnBeginPrint(State) {' + Array.from({ length: 1000 }, (_, i) => `A${i}=UCase(String(1048576,"x"));`).join('') + '}'
  const largeProgram = compileScript(largeState)
  verify(checkScriptSyntax(largeState, 'javascript', 'global').ok, 'large output has valid syntax; runtime must enforce its quota')
  assert.throws(() => executeScript(largeProgram, {}, 'OnBeginPrint'), /字符串总量/); checks++
  assert.throws(() => runGlobalScriptHook(largeState, context, 'OnBeginPrint'), /OnBeginPrint.*字符串总量/); checks++
  equal(context.sharedVars.A0, undefined, 'quota failures do not publish partial state')
  const retained = Array.from({ length: 4 }, (_, i) => `A${i}=String(1048576,"x");`).join('')
  equal(Object.keys(executeScript(compileScript(`function OnBeginPrint(State) {${retained}}`), {}, 'OnBeginPrint').values).length, 4, 'exactly four MB characters of retained strings is allowed')
  const replacement = 'function OnBeginPrint(State) {' + Array(10).fill('A=String(1048576,"x");').join('') + '}'
  equal(executeScript(compileScript(replacement), {}, 'OnBeginPrint').values.A.length, 1048576, 'replacements release the previous retained-string charge')
  const expensive = 'function OnBeginPrint(State) {' + Array(17).fill('A=String(1048576,"x");').join('') + '}'
  assert.throws(() => executeScript(compileScript(expensive), {}, 'OnBeginPrint'), /处理总量/); checks++
  const { resolvePrintJob } = await load('src/shared/print/scene.ts')
  const { buildPrintPlan } = await load('src/shared/print/plan.ts')
  const plan = buildPrintPlan({ test: false, requestedCount: 3, recordStart: 0, cellsPerPage: 1, defaultCopies: 1 })
  for (const language of ['vbscript', 'javascript']) {
    const globalScript = language === 'vbscript'
      ? 'Function OnBeginPrint(State)\nN = 0\nFlag = False\nEnd Function\nFunction OnBeginLabel()\nIf Flag Then\nN = 99\nElse\nN = N + 1\nEnd If\nEnd Function'
      : 'function OnBeginPrint(State) { N = 0; Flag = false; }\nfunction OnBeginLabel() { if (Flag) { N = 99; } else { N = N + 1; } }'
    const doc = { version: 1, name: 'typed variables', widthMm: 50, heightMm: 30, globalScript,
      objects: [{ id: 'text', type: 'text', x: 1, y: 1, w: 20, h: 5, rotation: 0, fontFamily: 'Arial', fontSize: 3, color: '#000000', align: 'left', bold: false, source: { kind: 'script', language, code: language === 'vbscript' ? 'OnGetData = N' : 'return N;' } }] }
    const begin = runGlobalScriptHook(globalScript, context, 'OnBeginPrint', 2)
    equal(begin.scriptVars.Flag, false)
    const state = { sharedVars: { ...begin.sharedVars }, scriptVars: { ...begin.scriptVars } }
    const output = []
    for (const page of plan.pages) {
      const job = resolvePrintJob(doc, begin, undefined, { ...plan, pages: [page] }, { scriptState: state, finishScript: false })
      output.push(job.pages[0].scene.primitives[0].value)
    }
    equal(output, ['1', '2', '3'], `${language} preserves numeric/boolean values across batches`)
    equal(state.scriptVars.N, 3)
    equal(begin.scriptVars.N, 0, 'job resolution must not mutate the input typed variables')
  }
  const emptyPublished = { ...context, sharedVars: { N: 'OLD' }, scriptVars: { N: 'OLD' } }
  resolveSourceText({ kind: 'script', sharedName: 'N', code: 'return "";', language: 'javascript' }, emptyPublished)
  equal(emptyPublished.sharedVars.N, '', 'successful empty output clears the old shared text')
  equal(emptyPublished.scriptVars.N, '', 'successful empty output clears the typed mirror')
  equal(runScriptSource('return N;', emptyPublished, 'javascript'), '')
  for (const code of ['return 1 / 0;', 'return UNKNOWN;', 'broken source']) {
    const failed = { ...context, sharedVars: { N: 'OLD' }, scriptVars: { N: 'OLD' } }
    resolveSourceText({ kind: 'script', sharedName: 'N', code, language: 'javascript' }, failed)
    equal(failed.sharedVars.N, 'OLD', 'failed object execution must not publish an empty value')
    equal(failed.scriptVars.N, 'OLD')
  }
  const disabled = { ...emptyPublished, allowScript: false, sharedVars: { N: 'OLD' }, scriptVars: { N: 'OLD' } }
  resolveSourceText({ kind: 'script', sharedName: 'N', code: 'return "";', language: 'javascript' }, disabled)
  equal(disabled.sharedVars.N, 'OLD', 'disabled scripts never publish')
  const aliases = { ...context, sharedVars: { N: '1' }, scriptVars: { N: 1 } }
  for (const [name, value] of [['n', '2'], ['N', '3'], ['n', '']]) {
    resolveSourceText({ kind: 'script', sharedName: name, code: vb(`OnGetData = "${value}"`), language: 'vbscript' }, aliases)
    equal(aliases.sharedVars, { N: value }, 'VB publication preserves one spelling only')
    equal(aliases.scriptVars, { N: value })
    equal(runScriptSource('OnGetData = N', aliases, 'vbscript'), value)
  }
  const duplicateAliases = { ...context, sharedVars: { N: '1', n: '2' }, scriptVars: { N: 1, n: 2 } }
  resolveSourceText({ kind: 'script', sharedName: 'n', code: vb('OnGetData = "3"'), language: 'javascript' }, duplicateAliases)
  equal(duplicateAliases.sharedVars, { N: '3' }, 'legacy language fallback uses the parsed language for publication')
  equal(duplicateAliases.scriptVars, { N: '3' })
  equal(runGlobalScriptHook('Function OnBeginLabel()\nN = 4\nEnd Function', { ...context, sharedVars: { N: '1', n: '2' }, scriptVars: { N: 1, n: 2 } }, 'OnBeginLabel').sharedVars, { N: '4' }, 'lifecycle publication also removes duplicate aliases')
  const caseSensitive = { ...context, sharedVars: { N: '1' }, scriptVars: { N: 1 } }
  resolveSourceText({ kind: 'script', sharedName: 'n', code: 'return "2";', language: 'javascript' }, caseSensitive)
  equal(caseSensitive.sharedVars, { N: '1', n: '2' }, 'JavaScript publication remains case-sensitive')
  const { Script } = require('node:vm')
  for (const body of [
    'if (true) { let x = 1; var x = 2; } return x;',
    'if (true) { var x = 2; let x = 1; } return x;',
    'if (true) { const x = 1; if (false) { var x = 2; } } return x;',
    'let x = 1; if (false) { var x = 2; } return x;',
    'if (false) { return 1; }; else { return 2; }',
    'if (false) { return 1; }\n;\nelse { return 2; }'
  ]) {
    const code = js(body)
    assert.throws(() => new Script(code), SyntaxError); checks++
    verify(!checkScriptSyntax(code, 'javascript').ok, 'checker agrees with native declaration and else boundaries: ' + code)
    equal(runScriptSource(code, context, 'javascript'), '')
  }
  for (const [body, expected] of [
    ['if (true) { return 1; } return 2;', '1'],
    ['if (false) { return 1; } return 2;', '2'],
    ['if (false) { return 1; } else { N = 2; } return N;', '2'],
    ['if (false) { return 1; }\nelse if (true) { N = 3; } return N;', '3'],
    ['if (true) { if (false) { return 1; } N = 4; } return N;', '4'],
    ['var x = 2; if (true) { let x = 1; } return x;', '2'],
    ['if (true) { let x = 1; } else { var x = 2; } return x;', ''],
    ['if (true) { let x = 1; } if (true) { var x = 2; } return x;', '2']
  ]) {
    new Script(js(body)); checks++
    good(js(body), 'javascript', expected)
  }
  let seed = 1729
  const random = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed }
  const arithmetic = (depth) => {
    if (!depth) { const value = random() % 20; return { code: String(value), value } }
    const a = arithmetic(depth - 1)
    const b = arithmetic(depth - 1)
    const op = ['+', '-', '*'][random() % 3]
    return { code: `(${a.code} ${op} ${b.code})`, value: op === '+' ? a.value + b.value : op === '-' ? a.value - b.value : a.value * b.value }
  }
  for (let i = 0; i < 120; i++) {
    const expression = arithmetic(3)
    good(`OnGetData = ${expression.code}`, 'vbscript', String(expression.value))
    good(`return ${expression.code};`, 'javascript', String(expression.value))
  }
  const esbuild = require('esbuild')
  const uiMocks = {
    react: 'export const useState=initial=>[typeof initial === "function" ? initial() : initial,value=>globalThis.__scriptUiUpdates.push(value)]; export const useEffect=()=>{};',
    'react/jsx-runtime': 'export const Fragment="fragment";export const jsx=(type,props)=>({type,props});export const jsxs=jsx;'
  }
  const ui = async (entry) => {
    const built = await esbuild.build({ entryPoints: [entry], bundle: true, platform: 'node', format: 'cjs', jsx: 'automatic', write: false,
      plugins: [{ name: 'ui-hooks', setup(build) {
        build.onResolve({ filter: /.*/ }, (args) => uiMocks[args.path] === undefined ? undefined : { path: args.path, namespace: 'ui-mock' })
        build.onLoad({ filter: /.*/, namespace: 'ui-mock' }, (args) => ({ contents: uiMocks[args.path] }))
      } }] })
    const module = { exports: {} }
    new Function('module', 'exports', 'require', built.outputFiles[0].text)(module, module.exports, require)
    return module.exports.default
  }
  const nodes = (tree) => !tree ? [] : Array.isArray(tree) ? tree.flatMap(nodes) : typeof tree === 'object' ? [tree, ...nodes(tree.props?.children)] : []
  globalThis.__scriptUiUpdates = []
  const Editor = await ui('src/renderer/src/dialogs/DataSourceEditor.tsx')
  const custom = { kind: 'script', language: 'vbscript', code: vb('OnGetData = "custom"') }
  let edited
  const tree = Editor({ source: custom, datasets: {}, onChange: (source) => { edited = source } })
  const scriptFields = nodes(tree).find((node) => node.type?.name === 'ScriptFields')
  verify(Boolean(scriptFields), 'script editor mounts the script fields')
  const controls = nodes(scriptFields.type(scriptFields.props))
  controls.find((node) => node.props?.['data-testid'] === 'script-language').props.onChange({ target: { value: 'javascript' } })
  equal(edited.code, custom.code, 'language changes must not erase user-written function bodies')
  controls.find((node) => node.props?.['data-testid'] === 'script-code').props.onChange({ target: { value: 'broken source' } })
  equal(globalThis.__scriptUiUpdates.at(-1), null, 'editing code invalidates the previous syntax-check result')
  const Properties = await ui('src/renderer/src/dialogs/TemplatePropsDialog.tsx')
  const propertiesTree = Properties({ doc: { version: 1, name: 'test', widthMm: 50, heightMm: 30, objects: [], globalScript: global }, onPatch: () => {}, onClose: () => {} })
  const propertyControls = nodes(propertiesTree)
  propertyControls.find((node) => node.props?.['data-testid'] === 'global-script-syntax-check').props.onClick()
  verify(globalThis.__scriptUiUpdates.at(-1).ok, 'template script check uses global mode')
  propertyControls.find((node) => node.props?.['data-testid'] === 'global-script').props.onChange({ target: { value: 'broken source' } })
  equal(globalThis.__scriptUiUpdates.at(-1), null, 'global script edits invalidate previous diagnostics')
  delete globalThis.__scriptUiUpdates
  console.log(`PASS ${checks} script parser/interpreter checks (VB/JS, diagnostics, isolation, lifecycle, safety and presets)`)
}

run().catch((error) => { console.error(error); process.exitCode = 1 })
