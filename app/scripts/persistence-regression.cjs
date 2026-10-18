const assert = require('node:assert/strict')
const esbuild = require('esbuild')

async function load(entry, mocks = {}) {
  const built = await esbuild.build({ entryPoints: [entry], bundle: true, platform: 'node', format: 'cjs', write: false,
    plugins: [{ name: 'test-boundaries', setup(build) {
      build.onResolve({ filter: /.*/ }, (args) => mocks[args.path] === undefined ? undefined : { path: args.path, namespace: 'mock' })
      build.onLoad({ filter: /.*/, namespace: 'mock' }, (args) => ({ contents: mocks[args.path] }))
    } }] })
  const module = { exports: {} }
  new Function('module', 'exports', 'require', built.outputFiles[0].text)(module, module.exports, require)
  return module.exports
}

async function run() {
  const { useDataManagement } = await load('src/renderer/src/features/data/useDataManagement.ts', { react: 'export const useCallback = fn => fn;' })
  const fixture = () => {
    let doc = { version: 1, name: 'test', widthMm: 50, heightMm: 30, objects: [],
      connections: { db: { id: 'db', name: 'db', autoRefresh: true, sql: 'select', datasetName: 'db' } },
      datasets: { db: { name: 'db', columns: ['id'], rows: [[1]] } } }
    const requests = []
    global.window = { maxlabel: { db: { query: () => new Promise((resolve) => requests.push(resolve)), cancel: async () => {} } } }
    const tabsRef = { current: [{ key: 'tab', revision: 0, doc }] }
    const management = useDataManagement({ doc, active: 'tab', tabsRef, dbSecretOperationsRef: { current: new Map() },
      patchDocument: (_key, patch) => { doc = patch(doc); tabsRef.current[0] = { ...tabsRef.current[0], doc, revision: tabsRef.current[0].revision + 1 } },
      applyDocument: () => {}, resetMutationGrouping: () => {}, saveDbSecret: async () => {}, setStatus: () => {} })
    return { management, requests, tabsRef, read: () => doc,
      edit(patch) { doc = patch(doc); tabsRef.current[0] = { ...tabsRef.current[0], doc, revision: tabsRef.current[0].revision + 1 } } }
  }
  for (const mutate of [
    (f) => f.edit((doc) => ({ ...doc, datasets: { ...doc.datasets, imported: { name: 'imported', columns: ['id'], rows: [[3]] } } })),
    (f) => f.edit((doc) => ({ ...doc, datasets: {} })),
    (f) => f.edit((doc) => ({ ...doc, datasets: { db: { ...doc.datasets.db, rows: [[99]] } } })),
    (f) => { f.tabsRef.current = [] }
  ]) {
    const f = fixture()
    const pending = f.management.refreshAutoDb()
    await Promise.resolve()
    mutate(f)
    const expected = f.read()
    f.requests[0]({ ok: true, rows: [{ id: 2 }] })
    assert.match((await pending).error, /取消刷新/)
    assert.strictEqual(f.read(), expected)
  }
  const f = fixture()
  const first = f.management.refreshAutoDb()
  const second = f.management.refreshAutoDb()
  await Promise.resolve()
  f.requests[1]({ ok: true, rows: [{ id: 3 }] })
  assert.equal((await second).error, null)
  f.requests[0]({ ok: true, rows: [{ id: 2 }] })
  assert.match((await first).error, /取消刷新/)
  assert.deepEqual(f.read().datasets.db.rows, [['3']])
  const printing = fixture()
  const printRefresh = printing.management.refreshAutoDb(printing.read(), 'tab', 0)
  await Promise.resolve()
  printing.edit((doc) => ({ ...doc, name: 'edited' }))
  printing.requests[0]({ ok: true, rows: [{ id: 2 }] })
  assert.match((await printRefresh).error, /取消打印/)

  const { normalizeDataset } = await load('src/shared/domain/document.ts')
  for (const columns of [['id', 'id', 'id_2'], ['id', 'id', 'id_2', 'id_3', 'id'], [' id ', 'id', 'id_2'], ['', '列1', '列1_2']]) {
    const dataset = normalizeDataset({ name: 'db', columns, rows: [columns.map((_, index) => String(index))] }, 'db')
    assert.equal(new Set(dataset.columns).size, columns.length, 'normalization must guarantee globally unique column names')
    for (const [index, field] of dataset.columns.entries()) {
      assert.equal(dataset.rows[0][dataset.columns.indexOf(field)], String(index), 'each column stays independently addressable')
    }
    assert.deepEqual(normalizeDataset(dataset, 'db'), dataset, 'column normalization is idempotent')
  }
  assert.deepEqual(normalizeDataset({ name: 'db', columns: ['id', 'id', 'id_2'], rows: [] }, 'db').columns, ['id', 'id_3', 'id_2'])
  let renameDoc = { name: 'rename', datasets: { db: { name: 'db', columns: ['id', 'price'], rows: [['A', '100']] } },
    objects: [{ id: 'text', type: 'text', source: { kind: 'database', dataset: 'db', field: 'price' } }] }
  let renameStatus = ''
  const rename = useDataManagement({ doc: renameDoc, active: 'tab', tabsRef: { current: [] }, dbSecretOperationsRef: { current: new Map() },
    patchDocument: () => {}, applyDocument: (patch) => { renameDoc = patch(renameDoc) }, resetMutationGrouping: () => {},
    saveDbSecret: async () => {}, setStatus: (status) => { renameStatus = status } })
  const beforeRename = renameDoc
  for (const name of ['id', ' id ', '', 'x'.repeat(4097)]) {
    rename.handleRenameField('db', 'price', name)
    assert.strictEqual(renameDoc, beforeRename, 'invalid rename changes neither columns nor object bindings')
    assert.match(renameStatus, /失败/)
  }
  rename.handleRenameField('db', 'price', ' amount ')
  assert.deepEqual(renameDoc.datasets.db.columns, ['id', 'amount'])
  assert.equal(renameDoc.objects[0].source.field, 'amount')
  assert.deepEqual(renameDoc.datasets.db.rows, [['A', '100']])
  // The hook must use the latest document, not its captured render snapshot.
  rename.handleRenameField('db', 'amount', 'total')
  assert.deepEqual(renameDoc.datasets.db.columns, ['id', 'total'])
  assert.equal(renameDoc.objects[0].source.field, 'total')

  global.__saveHandlers = new Map()
  global.__saveWrites = 0
  const { registerTemplateIpc } = await load('src/main/ipc/registerTemplateIpc.ts', {
    electron: `export const app = { getPath: () => 'D:/test' }; export const dialog = { showSaveDialog: async () => ({canceled:false,filePath:'D:/test/a.msdx'}) }; export const ipcMain = {handle: (name, fn) => globalThis.__saveHandlers.set(name, fn)};`,
    'fs/promises': `export const mkdir = async()=>{}; export const readdir = async()=>[]; export const rename = async()=>{}; export const rm = async()=>{}; export const stat = async()=>({}); export const writeFile = async()=>{globalThis.__saveWrites++};`,
    './validation': `export const readBoundedFile = async()=>{}; export const redactTemplateJson = x=>x; export const validateTemplatePath = x=>x;`,
    './pathAccess': `export const assertPathAccess = async x=>x; export const grantPath = async()=>{}; export const grantTemplateDirectory = async()=>{};`,
    './senderGuard': `export const assertKnownIpcChannel = ()=>{}; export const secureIpcHandler = (_window, handler)=>handler;`
  })
  registerTemplateIpc(() => null)
  const select = await global.__saveHandlers.get('template:save')({}, '', 'test', true)
  assert.equal(select.filePath, 'D:/test/a.msdx')
  assert.equal(global.__saveWrites, 0, 'selecting a path must not overwrite a file')
  const saved = await global.__saveHandlers.get('template:saveTo')({}, select.filePath, '{}')
  assert.equal(saved.ok, true)
  assert.equal(global.__saveWrites, 1)
  await global.__saveHandlers.get('template:save')({}, '{}', 'legacy')
  assert.equal(global.__saveWrites, 2, 'legacy save API remains compatible')
  delete global.window
  delete global.__saveHandlers
  delete global.__saveWrites
  console.log('PASS database refresh concurrency, unique import columns, collision-safe field renaming, closed tabs and write-free save path selection')
}

module.exports = { load }
if (require.main === module) run().catch((error) => { console.error(error); process.exitCode = 1 })
