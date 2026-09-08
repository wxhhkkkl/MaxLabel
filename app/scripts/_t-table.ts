/* 表格几何与合并单元格单测：node scripts/_t-table.ts */
const path = require('path')
const esbuild = require('esbuild')
const fs = require('fs')
const os = require('os')
;(async () => {
  const out = path.join(os.tmpdir(), 'table-test-' + Date.now() + '.cjs')
  await esbuild.build({
    entryPoints: [path.join(__dirname, '..', 'src', 'shared', 'table.ts')],
    bundle: true,
    platform: 'node',
    format: 'cjs',
    outfile: out,
    external: []
  })
  const m = require(out)
  let pass = 0
  let fail = 0
  function check(name, got, exp) {
    const g = JSON.stringify(got)
    const e = JSON.stringify(exp)
    if (g === e) { pass++; console.log('PASS', name, '=>', g) }
    else { fail++; console.log('FAIL', name, '=>', g, '(expect', e + ')') }
  }
  const t3x2 = { w: 60, h: 30, rows: 3, cols: 2 }
  check('colXs equal', m.tableColXs(t3x2), [0, 30, 60])
  check('rowYs equal', m.tableRowYs(t3x2), [0, 10, 20, 30])
  const tRatio = { w: 60, h: 30, rows: 3, cols: 2, colWidths: [1, 2], rowHeights: [1, 2, 3] }
  check('colXs ratio', m.tableColXs(tRatio), [0, 20, 60])
  check('rowYs ratio', m.tableRowYs(tRatio), [0, 5, 15, 30])
  // 合并列0-1、行0-1
  const tMerge = { ...t3x2, merges: [{ r: 0, c: 0, r2: 1, c2: 1 }] }
  check('mergeAt hit', !!m.tableMergeAt(tMerge, 0, 0), true)
  check('mergeAt miss', !!m.tableMergeAt(tMerge, 2, 0), false)
  // 竖线 i=1（列1右边界=合并区右边界）：隐藏
  check('v seg hidden', m.tableSegmentHidden(tMerge, 0, 1, 'v'), true)
  // 行1 段：merge 行0..1 覆盖 j=1？r<r2 即 j<1 才隐藏；j=1 不隐藏
  check('v seg j1 not hidden', m.tableSegmentHidden(tMerge, 1, 1, 'v'), false)
  // 横线边界1（行1下边界=合并区下边界）：隐藏
  check('h seg hidden', m.tableSegmentHidden(tMerge, 1, 0, 'h'), true)
  // 横线边界0：在合并区内（r=0 是上边界，非内部）→ 不隐藏
  check('h seg r0 not hidden', m.tableSegmentHidden(tMerge, 0, 0, 'h'), false)
  console.log(`\n${pass} passed, ${fail} failed`)
  process.exit(fail ? 1 : 0)
})().catch((e) => { console.error(e); process.exit(1) })
