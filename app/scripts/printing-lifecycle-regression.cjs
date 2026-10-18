const assert = require('node:assert/strict')
const { load } = require('./persistence-regression.cjs')

async function run() {
  const { runGlobalScriptHook, runGlobalScript, advanceSerial, serialText } = await load('src/shared/domain/datasource.ts')
  const { resolvePrintJob } = await load('src/shared/print/scene.ts')
  const { buildPrintPlan } = await load('src/shared/print/plan.ts')
  const { defaultPrinterConfig } = await load('src/shared/domain/printer.ts')
  const context = { allowScript: true, labelIndex: 1, recordIndex: 0, copy: 1, count: 3, totalLabels: 3, title: '', printerName: '', datasets: {}, sharedVars: { N: '0', Marker: 'original' } }
  for (const [body, expected] of [
    ['If False Then\nIf True Then\nMarker = "wrong"\nEnd If\nEnd If', 'original'],
    ['If False Then\nIf False Then\nMarker = "wrong"\nElse\nMarker = "also wrong"\nEnd If\nElse\nMarker = "outer else"\nEnd If', 'outer else'],
    ['If True Then\nIf False Then\nMarker = "wrong"\nElse\nMarker = "inner else"\nEnd If\nEnd If', 'inner else'],
    ['If False Then\nIf UNKNOWN > 1 Then\nMarker = "wrong"\nEnd If\nEnd If\nMarker = "after"', 'after']
  ]) {
    assert.equal(runGlobalScriptHook(`Function OnBeginPrint(State)\n${body}\nEnd Function`, context, 'OnBeginPrint', 2).sharedVars.Marker, expected)
  }
  const js = 'function OnBeginPrint(State) {\nif (false) {\nif (true) {\nMarker = "wrong";\n}\n} else {\nMarker = "right";\n}\n}'
  assert.equal(runGlobalScriptHook(js, context, 'OnBeginPrint', 2).sharedVars.Marker, 'right')
  const globalScript = 'Function OnBeginPrint(State)\nN = 0\nEnd Function\nFunction OnBeginLabel()\nN = CInt(N) + 1\nEnd Function\nFunction OnEndLabel()\nTail = N\nEnd Function\nFunction OnEndPrint()\nDone = Tail\nEnd Function'
  const doc = { version: 1, name: 'lifecycle', widthMm: 50, heightMm: 30, globalScript,
    objects: [{ id: 'text', type: 'text', x: 1, y: 1, w: 20, h: 5, rotation: 0, fontFamily: 'Arial', fontSize: 3, printerFont: 'Font1', color: '#000000', align: 'left', bold: false, source: { kind: 'script', code: 'return N;' } }] }
  const plan = buildPrintPlan({ test: false, requestedCount: 3, recordStart: 0, cellsPerPage: 1, defaultCopies: 1 })
  const begin = runGlobalScript(globalScript, context, 2)
  const state = { sharedVars: { ...begin.sharedVars } }
  const job = resolvePrintJob(doc, begin, undefined, plan, { scriptState: state })
  assert.deepEqual(job.pages.map((p) => p.scene.primitives[0].value), ['1', '2', '3'])
  assert.equal(state.sharedVars.Done, '3')
  assert.equal(begin.sharedVars.N, '0', 'scene resolution must not mutate the caller context')
  const splitState = { sharedVars: { ...begin.sharedVars } }
  for (let i = 0; i < plan.pages.length; i++) {
    const batch = resolvePrintJob(doc, begin, undefined, { ...plan, pages: [plan.pages[i]] }, { scriptState: splitState, finishScript: i === plan.pages.length - 1 })
    assert.equal(batch.pages[0].scene.primitives[0].value, String(i + 1))
    if (i < plan.pages.length - 1) assert.equal(splitState.sharedVars.Done, undefined)
  }
  assert.equal(splitState.sharedVars.Done, '3')
  const imposed = resolvePrintJob(doc, begin, { rows: 1, cols: 3 }, buildPrintPlan({ test: false, requestedCount: 3, recordStart: 0, cellsPerPage: 3, defaultCopies: 1 }))
  assert.deepEqual(imposed.pages[0].scene.primitives.map((p) => p.value), ['1', '2', '3'])
  for (const total of [1, 3, 4, 5]) {
    const limited = buildPrintPlan({ test: false, requestedCount: total, recordStart: 0, cellsPerPage: 3, defaultCopies: 2, physicalLabelLimit: total })
    assert.equal(limited.physicalLabelCount, total)
    assert.equal(limited.logicalLabelCount, Math.ceil(total / 2))
    assert.equal(limited.serialAdvanceCount, limited.logicalLabelCount)
    assert.ok(limited.pages.every((p) => p.cells.every((c) => c.copies === p.copies)))
  }
  const variableCopies = buildPrintPlan({ test: false, requestedCount: 3, recordStart: 0, cellsPerPage: 2, defaultCopies: 1, physicalLabelLimit: 5,
    dataset: { name: 'db', columns: ['copies'], rows: [['3'], ['4'], ['2']] }, copyField: 'copies' })
  assert.equal(variableCopies.physicalLabelCount, 5)
  assert.deepEqual(variableCopies.pages.flatMap((p) => p.cells.map((c) => c.copies)), [3, 2])
  assert.throws(() => buildPrintPlan({ test: false, requestedCount: 100, recordStart: 0, cellsPerPage: 1, defaultCopies: 99999 }), /超过限制/)

  const transport = await load('src/main/printing/commandTransport.ts', {
    child_process: `export function execFile(){};execFile[Symbol.for('nodejs.util.promisify.custom')]=async(_exe,args)=>{globalThis.__rawScript=args[args.length-1];return {stdout:globalThis.__rawResult,stderr:''}};`,
    'fs/promises': 'export const writeFile=async()=>{};export const rm=async()=>{};'
  })
  if (process.platform === 'win32') {
    for (const output of ['OK:Queue:0', 'OK:Queue:1', 'OK:Queue:5', 'OK:Queue:garbage', 'INCOMPLETE:Queue:4']) {
      global.__rawResult = output
      const result = await transport.sendCommand(Buffer.from('test'), { type: 'usb', usbPort: 'USB001' })
      assert.equal(result.ok, false, output)
      assert.equal(result.status, 'unknown')
    }
    global.__rawResult = 'OK:Queue:with:colon:4'
    assert.equal((await transport.sendCommand(Buffer.from('test'), { type: 'usb', usbPort: 'USB001' })).ok, true)
    assert.match(global.__rawScript, /StartDocPrinter\(.*-eq 0/)
    assert.match(global.__rawScript, /if \(-not \$ok -or -not \$endPageOk -or -not \$endDocOk/)
    const encoded = Buffer.from(global.__rawScript).toString('base64')
    require('node:child_process').execFileSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', `$tokens=$null;$errors=$null;[void][System.Management.Automation.Language.Parser]::ParseInput([System.Text.Encoding]::UTF8.GetString([Convert]::FromBase64String('${encoded}')),[ref]$tokens,[ref]$errors);if($errors.Count){$errors | Out-String | Write-Error;exit 1}`], { windowsHide: true, timeout: 10000 })
  }

  const renderedValues = []
  global.__renderedValues = renderedValues
  const mocks = {
    '../../print/renderLabel': `export const pageSizeMm=()=>({widthMm:50,heightMm:30});export const renderLabelDataUrl=async(_doc,opts)=>{globalThis.__renderedValues.push(opts.scene.primitives[0]?.value);return 'data:image/png;base64,AA=='};`,
    '../../print/bitmapSource': 'export const prepareBitmapsForPrintJob=async x=>x;'
  }
  const { executePrint } = await load('src/renderer/src/features/printing/printExecutor.ts', mocks)
  let driverPayload
  let commandBatches = 0
  let serialCount = 0
  const statuses = []
  global.window = { maxlabel: { printLabel: async (p) => { driverPayload = p; return { ok: true } }, printCommand: async () => { commandBatches++; return { ok: true } } } }
  const printer = { ...defaultPrinterConfig(), driver: 'tspl', dpi: 203, port: { type: 'driver' } }
  const deps = (sourceDoc, count, copies) => ({ sourceDoc, printTab: { key: 'tab', revision: 0, count, copies, recordIdx: 0, startLabel: 1 }, printer,
    options: { allowScript: true, advanced: { autoCount: false, currentOnly: false, firstCopyAsk: false, copyField: false, dupcheck: false, updateSerial: true } },
    refreshAutoDb: async () => ({ doc: sourceDoc, error: null }), bumpSerial: async (_key, n) => { serialCount = n; return { ok: true } }, logPrint: async () => {}, setBusy: () => {}, setStatus: (message) => statuses.push(message) })
  const countDoc = { ...doc, globalScript: 'Function OnBeginPrint(State)\nV_TOTALLABELS = 3\nN = 0\nEnd Function' }
  await executePrint(false, deps(countDoc, 1, 2), {})
  assert.equal(driverPayload.pages.reduce((n, p) => n + p.copies, 0), 3)
  assert.equal(serialCount, 2)
  const unchangedTotalDoc = { ...countDoc, globalScript: 'Function OnBeginPrint(State)\nV_TOTALLABELS = 2\nN = 0\nEnd Function' }
  const unchangedDeps = deps(unchangedTotalDoc, 1, 2)
  unchangedDeps.options.advanced.firstCopyAsk = true
  global.window.prompt = () => '5'
  await executePrint(false, unchangedDeps, {})
  assert.equal(driverPayload.pages.reduce((n, p) => n + p.copies, 0), 2, 'explicit script totals override a larger first-copy count')
  renderedValues.length = 0
  await executePrint(false, deps(doc, 26, 1), {})
  assert.deepEqual(renderedValues, Array.from({ length: 26 }, (_, i) => String(i + 1)))
  const commandDeps = deps(doc, 26, 1)
  commandDeps.printer = { ...printer, port: { type: 'tcp', tcpHost: '127.0.0.1', tcpPort: 9100 } }
  const snapshots = []
  commandDeps.logPrint = async (_mode, _test, data) => snapshots.push(...data)
  await executePrint(false, commandDeps, {})
  assert.equal(commandBatches, 2, statuses.join('\n'))
  assert.deepEqual(snapshots, Array.from({ length: 26 }, (_, i) => String(i + 1)))
  const filePayloads = []
  serialCount = 0
  global.window.maxlabel.printCommand = async (payload) => { filePayloads.push(payload); return { ok: true } }
  await executePrint(false, { ...commandDeps, printer: { ...printer, port: { type: 'file' } } }, {})
  assert.equal(filePayloads.length, 1, 'all file batches must share one save operation')
  assert.equal(serialCount, 26)
  assert.equal(filePayloads[0].segments.filter((segment) => segment.type === 'text').map((segment) => segment.str).join('').match(/PRINT /g).length, 26)
  serialCount = 0
  global.window.maxlabel.printCommand = async () => ({ ok: false, status: 'unknown', message: 'incomplete USB write' })
  await executePrint(false, { ...commandDeps, printTab: { ...commandDeps.printTab, count: 1 } }, {})
  assert.equal(serialCount, 0, 'unconfirmed batches must never advance serial numbers')
  const { renderPrintPreviewPages, buildExportCommand } = await load('src/renderer/src/features/printing/printPreviewService.ts', mocks)
  renderedValues.length = 0
  const preview = await renderPrintPreviewPages({ doc: countDoc, tab: deps(countDoc, 1, 2).printTab, printer, autoCount: false, advanced: {}, keyboardValues: {}, allowScript: true, includeSuppressed: false, autoRotateOutput: false })
  assert.equal(preview.pages.length, 2)
  for (const language of ['vbscript', 'javascript']) {
    for (const hook of ['OnBeginPrint', 'OnBeginLabel', 'OnEndLabel', 'OnEndPrint']) {
      const badScript = language === 'vbscript'
        ? `Function ${hook}(${hook === 'OnBeginPrint' ? 'State' : ''})\nN = 99\nBad = 1 / 0\nEnd Function`
        : `function ${hook}(${hook === 'OnBeginPrint' ? 'State' : ''}) { N = 99; Bad = 1 / 0; }`
      const badDoc = { ...doc, globalScript: badScript }
      assert.throws(() => runGlobalScriptHook(badScript, context, hook), new RegExp(hook))
      assert.equal(context.sharedVars.N, '0', 'failed hooks never publish partial writes')
      for (const port of [{ type: 'driver' }, { type: 'tcp', tcpHost: '127.0.0.1', tcpPort: 9100 }, { type: 'file' }]) {
        let submissions = 0
        let advanced = 0
        let busy = false
        const logs = []
        global.window.maxlabel.printLabel = global.window.maxlabel.printCommand = async () => { submissions++; return { ok: true } }
        const failedDeps = { ...deps(badDoc, 3, 1), printer: { ...printer, port },
          bumpSerial: async (_key, n) => { advanced += n; return { ok: true } },
          logPrint: async (_mode, _test, _data, _doc, summary) => logs.push(summary),
          setBusy: (value) => { busy = value } }
        await executePrint(false, failedDeps, {})
        assert.equal(submissions, 0, `${language} ${hook} must block ${port.type} submission`)
        assert.equal(advanced, 0, 'no serial advancement before a confirmed submission')
        assert.equal(busy, false)
        assert.match(statuses.at(-1), new RegExp(`打印失败：.*${hook}`))
        assert.ok(logs.every((entry) => entry.status === 'failed' && entry.sentCount === 0))
      }
      await assert.rejects(() => renderPrintPreviewPages({ doc: badDoc, tab: deps(badDoc, 3, 1).printTab, printer,
        autoCount: false, advanced: {}, keyboardValues: {}, allowScript: true, includeSuppressed: false, autoRotateOutput: false }), new RegExp(hook))
    }
    for (const hook of ['OnBeginLabel', 'OnEndLabel', 'OnEndPrint']) {
      const badScript = language === 'vbscript'
        ? `Function OnBeginPrint(State)\nN = 0\nEnd Function\nFunction ${hook}()\n${hook === 'OnEndPrint' ? 'Bad = 1 / 0' : 'If V_LABELNO = 25 Then Bad = 1 / 0'}\nEnd Function`
        : `function OnBeginPrint(State) { N = 0; }\nfunction ${hook}() { ${hook === 'OnEndPrint' ? 'Bad = 1 / 0;' : 'if (V_LABELNO === 25) { Bad = 1 / 0; }'} }`
      const badDoc = { ...doc, globalScript: badScript }
      let submissions = 0
      let advanced = 0
      const logs = []
      global.window.maxlabel.printCommand = async () => { submissions++; return { ok: true } }
      await executePrint(false, { ...deps(badDoc, 26, 1), printer: { ...printer, port: { type: 'tcp', tcpHost: '127.0.0.1', tcpPort: 9100 } },
        bumpSerial: async (_key, n) => { advanced += n; return { ok: true } },
        logPrint: async (_mode, _test, data, _doc, summary) => logs.push({ data, ...summary }) }, {})
      assert.equal(submissions, 1, 'a late hook error must not submit its failed batch')
      assert.equal(advanced, 24, 'only the previously confirmed batch advances serials')
      assert.equal(logs.length, 1)
      assert.equal(logs[0].status, 'partial')
      assert.equal(logs[0].sentCount, 24)
      assert.equal(logs[0].data.length, 24)
      assert.match(statuses.at(-1), new RegExp(hook))
    }
  }
  const emptyDataset = { name: 'db', columns: ['id'], rows: [] }
  for (const test of [false, true]) {
    const emptyPlan = buildPrintPlan({ test, requestedCount: 3, recordStart: 0, cellsPerPage: 1, defaultCopies: 2, dataset: emptyDataset })
    assert.equal(emptyPlan.pages.length, 0)
    assert.equal(emptyPlan.physicalLabelCount, 0)
    assert.equal(emptyPlan.serialAdvanceCount, 0)
  }
  const emptyDoc = { ...doc, globalScript: undefined, datasets: { db: emptyDataset },
    objects: doc.objects.map((object) => ({ ...object, source: { kind: 'database', dataset: 'db', field: 'id' } })) }
  for (const autoCount of [false, true]) {
    for (const port of [{ type: 'driver' }, { type: 'tcp', tcpHost: '127.0.0.1', tcpPort: 9100 }, { type: 'file' }]) {
      let submissions = 0
      let advanced = 0
      global.window.maxlabel.printLabel = global.window.maxlabel.printCommand = async () => { submissions++; return { ok: true } }
      const emptyDeps = { ...deps(emptyDoc, 3, 1), printer: { ...printer, port },
        bumpSerial: async (_key, n) => { advanced += n; return { ok: true } } }
      emptyDeps.options.advanced.autoCount = autoCount
      await executePrint(false, emptyDeps, {})
      assert.equal(submissions, 0, 'an empty database cannot fall back to constant-label printing')
      assert.equal(advanced, 0, 'an empty database must never advance serials')
      assert.match(statuses.at(-1), /没有可打印/)
    }
  }
  const emptyPreview = await renderPrintPreviewPages({ doc: emptyDoc, tab: deps(emptyDoc, 3, 1).printTab, printer,
    autoCount: true, advanced: {}, keyboardValues: {}, allowScript: true, includeSuppressed: false, autoRotateOutput: false })
  assert.deepEqual(emptyPreview.pages, [])
  const { advanceDocumentSerials, createPrintContext } = await load('src/renderer/src/features/printing/printJob.ts')
  for (const repeatBasis of ['record', 'label', undefined]) {
    const source = { kind: 'serial', prefix: '', start: 1, current: 1, step: 1, digits: 1, repeat: 2, repeatBasis }
    let serialDoc = { ...doc, globalScript: undefined, objects: doc.objects.map((object) => ({ ...object, source, subSources: [source] })) }
    const values = []
    for (let job = 0; job < 3; job++) {
      const ctx = createPrintContext({ doc: serialDoc, printer, count: 2, copies: 1 })
      values.push(...[1, 2].map((index) => serialText(serialDoc.objects[0].source, index, ctx)))
      serialDoc = advanceDocumentSerials(serialDoc, 2)
    }
    assert.deepEqual(values, ['1', '1', '2', '2', '3', '3'], 'no-database repeat output and persisted advancement agree')
    assert.equal(serialDoc.objects[0].subSources[0].current, 4)
    assert.equal(advanceSerial(source, 0).current, 1)
  }
  const recordSerial = { kind: 'serial', prefix: '', start: 1, current: 1, step: 1, digits: 1, repeat: 2, repeatBasis: 'record' }
  const serialDbDoc = { ...doc, globalScript: undefined, datasets: { empty: emptyDataset, db: { ...emptyDataset, rows: [['A'], ['B']] } },
    objects: doc.objects.map((object) => ({ ...object, source: recordSerial })) }
  assert.equal(advanceDocumentSerials(serialDbDoc, 2, 'db').objects[0].source.current, 3, 'record-based serials retain per-record advancement with a populated database')
  assert.equal(advanceDocumentSerials(serialDbDoc, 2, 'empty').objects[0].source.current, 2, 'advancement uses the selected dataset, not the first populated dataset')
  const seedContext = { ...context, labelIndex: 1, recordIndex: 0, keyboardValues: {}, activeDataset: 'db',
    datasets: { db: { name: 'db', columns: ['seed'], rows: [['']] } } }
  for (const raw of ['', '   ', 'not a number', 'Infinity', undefined]) {
    const initial = { ...recordSerial, current: 100, initialValueSource: 'keyboard', initialValueField: 'seed' }
    assert.equal(serialText(initial, 1, { ...seedContext, keyboardValues: raw === undefined ? {} : { seed: raw } }), '100')
    const database = { ...initial, initialValueSource: 'database' }
    assert.equal(serialText(database, 1, { ...seedContext, datasets: { db: { ...seedContext.datasets.db, rows: raw === undefined ? [] : [[raw]] } } }), '100')
  }
  assert.equal(serialText({ ...recordSerial, current: 100, initialValueSource: 'database', initialValueField: 'missing' }, 1, seedContext), '100')
  for (const raw of ['0', ' 0 ', '-5', '25']) {
    const expected = String(Number(raw))
    assert.equal(serialText({ ...recordSerial, current: 100, initialValueSource: 'keyboard', initialValueField: 'seed' }, 1,
      { ...seedContext, keyboardValues: { seed: raw } }), expected, 'valid zero and negative initial values are retained')
    assert.equal(serialText({ ...recordSerial, current: 100, initialValueSource: 'database', initialValueField: 'seed' }, 1,
      { ...seedContext, datasets: { db: { ...seedContext.datasets.db, rows: [[raw]] } } }), expected)
  }
  for (const globalScript of [
    'Function OnBeginPrint(State)\nV_TOTALLABELS = 0\nEnd Function',
    'function OnBeginPrint(State) { V_TOTALLABELS = 0; }'
  ]) {
    const zeroDoc = { ...doc, globalScript, objects: doc.objects.map((object) => ({ ...object, source: { kind: 'constant', value: 'OK' } })) }
    const input = { doc: zeroDoc, tab: deps(zeroDoc, 1, 1).printTab, printer, keyboardValues: {}, allowScript: true, includeSuppressed: false, autoRotateOutput: false }
    await assert.rejects(() => buildExportCommand(input), /输出标签数量.*未导出/)
    const disabled = await buildExportCommand({ ...input, allowScript: false })
    assert.equal(disabled.labelCount, 1, 'disabled scripts do not suppress exports')
  }
  delete global.window
  delete global.__renderedValues
  delete global.__rawResult
  delete global.__rawScript
  console.log('PASS nested conditions, lifecycle state/totals, hook failures blocking driver/TCP/file/preview, partial-batch serials and USB completion')
}

run().catch((error) => { console.error(error); process.exitCode = 1 })
