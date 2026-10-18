const assert = require('node:assert/strict')
const path = require('node:path')
const { load } = require('./persistence-regression.cjs')

async function run() {
  const { writeBarcodeExport } = await load('src/main/barcodeExport.ts', {
    fs: 'export const existsSync=p=>globalThis.__exportFs.has(p);',
    'fs/promises': `export const mkdir=async()=>{};
      export const writeFile=async(p,data)=>globalThis.__exportFs.set(p,data.toString());
      export const rename=async(a,b)=>{if(globalThis.__exportFailRename && a.includes('.maxlabel-export-') && b.endsWith('b.png'))throw Error('commit failed');if(!globalThis.__exportFs.has(a))throw Error('missing file');globalThis.__exportFs.set(b,globalThis.__exportFs.get(a));globalThis.__exportFs.delete(a)};
      export const rm=async(p,opts)=>{if(opts.recursive){for(const key of globalThis.__exportFs.keys())if(key.startsWith(p))globalThis.__exportFs.delete(key);return}if(globalThis.__exportFailCleanup && p.endsWith('.bak') && p.includes('b.png.'))throw Error('cleanup failed');globalThis.__exportFs.delete(p)};`
  })
  const dir = path.resolve('export-fixture')
  const items = ['a.png', 'b.png'].map((name) => ({ name, dataUrl: `data:image/png;base64,${Buffer.from('new-' + name).toString('base64')}` }))
  const setup = () => { global.__exportFs = new Map(items.map(({ name }) => [path.join(dir, name), 'old-' + name])) }
  setup()
  global.__exportFailCleanup = true
  const result = await writeBarcodeExport(dir, items)
  assert.equal(result.count, 2)
  assert.equal(result.warnings.length, 1)
  for (const { name } of items) assert.equal(global.__exportFs.get(path.join(dir, name)), 'new-' + name)
  global.__exportFailCleanup = false
  global.__exportFailRename = true
  setup()
  await assert.rejects(writeBarcodeExport(dir, items), /commit failed/)
  for (const { name } of items) assert.equal(global.__exportFs.get(path.join(dir, name)), 'old-' + name)
  delete global.__exportFs
  delete global.__exportFailCleanup
  delete global.__exportFailRename

  const { runGlobalScript, runScriptSource } = await load('src/shared/domain/datasource.ts')
  const context = { allowScript: true, labelIndex: 1, recordIndex: 0, copy: 1, count: 3, totalLabels: 3, title: '', printerName: '', datasets: {} }
  for (const code of [
    'function OnBeginPrint(State) { URL = "https://example.com/a"; Value = "A;B"; /* } fake brace */ }',
    'Function OnBeginPrint(State)\nURL = "https://example.com/a"\nValue = "A;B"\nEnd Function'
  ]) {
    const vars = runGlobalScript(code, context, 1).sharedVars
    assert.equal(vars.URL, 'https://example.com/a')
    assert.equal(vars.Value, 'A;B')
  }
  assert.equal(runScriptSource('return "https://example.com/A;B";', context, 'javascript'), 'https://example.com/A;B')
  assert.equal(runScriptSource('OnGetData = "A;B ""quoted"""', context, 'vbscript'), 'A;B "quoted"')

  const { barcodeExportFilename, resolveBarcodeExportScenes } = await load('src/renderer/src/features/exporting/barcodeExport.ts')
  const names = [0, 1].map((objectIndex) => barcodeExportFilename({ text: 'ABC', index: 0, count: 10, naming: 'serial', prefix: '', format: 'bmp', objectIndex, objectCount: 2 }))
  assert.deepEqual(names, ['0001_b1.bmp', '0001_b2.bmp'])
  const doc = { version: 1, name: 'export', widthMm: 50, heightMm: 30,
    objects: [{ id: 'barcode', type: 'barcode', x: 1, y: 1, w: 30, h: 10, rotation: 0, barcodeType: 'CODE128', source: { kind: 'script', code: 'return "ABC123";' } }] }
  assert.equal(resolveBarcodeExportScenes(doc, 1, true)[0].primitives[0].value, 'ABC123')
  assert.equal(resolveBarcodeExportScenes(doc, 1, false)[0].primitives[0].value, '')
  const numbered = { ...doc, globalScript: 'Function OnBeginPrint(State)\nN = 0\nEnd Function\nFunction OnBeginLabel()\nN = CInt(N) + 1\nEnd Function', objects: [{ ...doc.objects[0], source: { kind: 'script', code: 'return N;' } }] }
  assert.deepEqual(resolveBarcodeExportScenes(numbered, 3, true).map((scene) => scene.primitives[0].value), ['1', '2', '3'])
  assert.deepEqual(resolveBarcodeExportScenes(numbered, 26, true, true).map((scene) => scene.primitives[0].value), ['1'])
  console.log('PASS export commit/cleanup isolation, rollback, unique names, quoted script strings and scripted export scenes')
}

run().catch((error) => { console.error(error); process.exitCode = 1 })
