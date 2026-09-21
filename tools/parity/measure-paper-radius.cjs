/*
 * 验收方工装：直接对**当前源码**里的纸张几何求值，量出圆角矩形的实际半径（我的"改前/改后"标尺）。
 * 做法与仓库自带测试一致：用 esbuild 把 app/src/shared/domain/paper.ts 打包成 CJS 再 require。
 * 产物写到 %TEMP%，不污染仓库。
 *
 *   node tools/parity/measure-paper-radius.cjs
 */
const { execFileSync } = require('child_process')
const fs = require('fs')
const path = require('path')

const repo = path.resolve(__dirname, '..', '..')
const appDir = path.join(repo, 'app')
const entry = path.join(appDir, 'src', 'shared', 'domain', 'paper.ts')
const outFile = path.join(process.env.TEMP, 'maxlabel-paper-probe.cjs')

const esbuildCli = path.join(appDir, 'node_modules', 'esbuild', 'bin', 'esbuild')
try {
  // Windows 上直接 spawn `.cmd` 会 EINVAL（Node 的 shell 安全策略），所以走 esbuild 自带的 JS CLI
  execFileSync(process.execPath, [esbuildCli, entry, '--bundle', '--platform=node', '--format=cjs', `--outfile=${outFile}`], { stdio: 'ignore', cwd: appDir })
} catch (e) {
  console.error('esbuild 失败：', e.message)
  process.exit(1)
}

const { paperPath } = require(outFile)

/** 从 path 的 d 里取出圆角半径（把半径硬编码进 path 才能被这张表量出来） */
function radiiOf(d) {
  const m = d.match(/A\s+([\d.]+)\s+([\d.]+)/)
  return m ? Number(m[1]) : 0
}

const cases = [
  { w: 100, h: 70, shape: 'roundRect', label: '100×70 圆角（真机 [608053]）' },
  { w: 100, h: 150, shape: 'roundRect', label: '100×150 圆角（真机卷筒）' },
  { w: 60, h: 60, shape: 'roundRect', label: '60×60 圆角' },
  { w: 40, h: 30, shape: 'roundRect', label: '40×30 圆角' },
  { w: 100, h: 70, shape: 'roundRect', cornerRadiusMm: 2, label: '100×70 圆角 + 显式 2mm' },
  { w: 100, h: 70, shape: 'rect', label: '100×70 直角' }
]

console.log('shape      size        显式半径   paperPath 里的半径(mm)   = 短边×?')
for (const c of cases) {
  const d = paperPath(c.w, c.h, { shape: c.shape, cornerRadiusMm: c.cornerRadiusMm })
  const r = radiiOf(d)
  const ratio = (r / Math.min(c.w, c.h)).toFixed(4)
  console.log(
    `${String(c.shape).padEnd(10)} ${String(c.w + '×' + c.h).padEnd(11)} ` +
    `${String(c.cornerRadiusMm ?? '—').padEnd(9)} ${String(r).padEnd(22)} ${ratio}   （${c.label}）`
  )
}

// 顺带确认 disc / ellipse 的孔洞与外形
console.log('')
console.log('disc 100×100 孔洞 15 →', paperPath(100, 100, { shape: 'disc', innerDiameterMm: 15 }).slice(0, 40) + '…')
console.log('ellipse 80×60 →', paperPath(80, 60, { shape: 'ellipse' }).slice(0, 40) + '…')
