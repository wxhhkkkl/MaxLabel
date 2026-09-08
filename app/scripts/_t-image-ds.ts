/* 数据源图片文件名解析单测：node scripts/_t-image-ds.ts */
const path = require('path')
const esbuild = require('esbuild')
const os = require('os')
;(async () => {
  const out = path.join(os.tmpdir(), 'imgds-test-' + Date.now() + '.cjs')
  await esbuild.build({ entryPoints: [path.join(__dirname, '..', 'src', 'shared', 'model.ts')], bundle: true, platform: 'node', format: 'cjs', outfile: out, external: [] })
  const m = require(out)
  let pass = 0, fail = 0
  function check(name, got, exp) {
    const ok = got === exp
    if (ok) { pass++; console.log('PASS', name) } else { fail++; console.log('FAIL', name, '=>', JSON.stringify(got), '(expect', JSON.stringify(exp) + ')') }
  }
  const ctx = {
    labelIndex: 1, recordIndex: 0, copy: 1, count: 1, totalLabels: 1, title: 't', printerName: '',
    datasets: { imgs: { name: 'imgs', columns: ['fname', 'name'], rows: [['photo_a.png', '张三'], ['photo_b.png', '李四']] } },
    sharedVars: {}, keyboardValues: {}, recordRow: ['photo_a.png', '张三'], activeDataset: 'imgs'
  }
  // 数据源图片：database 数据源，文件名来自当前记录
  const img = {
    id: 'i1', type: 'image', x: 0, y: 0, w: 10, h: 10, rotation: 0, src: '',
    imgType: 'datasource', linkPath: 'C:\\imgs',
    source: { kind: 'database', dataset: 'imgs', field: 'fname' }
  }
  const name = m.resolveObjectText(img, ctx)
  check('datasource resolves record fname', name, 'photo_a.png')
  // constant 数据源
  const img2 = { ...img, source: { kind: 'constant', value: 'logo.png' } }
  check('datasource constant', m.resolveObjectText(img2, ctx), 'logo.png')
  // 无 source（link 图片不应触发 datasource 分支）
  const img3 = { ...img, imgType: 'link', linkPath: 'C:\\x\\logo.png', source: undefined }
  // 序列号数据源在图片文件名上也可用
  const img4 = { ...img, source: { kind: 'serial', prefix: 'P', start: 1, step: 1, digits: 3, current: 7 } }
  check('datasource serial', m.resolveObjectText(img4, ctx), 'P007')
  console.log(`\n${pass} passed, ${fail} failed`)
  process.exit(fail ? 1 : 0)
})().catch((e) => { console.error(e); process.exit(1) })
