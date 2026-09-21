/*
 * 验收方工装：真机截图里「标签预览」的圆角矩形角弧量测（**给原始材料，人眼读数**）。
 *
 * 用法：
 *   node tools/parity/measure-corner-radius.cjs <png> <x0> <y0> <x1> <y1> [标签宽度mm] [角区x 角区y [宽 高]]
 * 例：
 *   node tools/parity/measure-corner-radius.cjs parity/reference/labelshop/60-dlg-choose-label.png 200 50 620 540 100 276 80 46 20
 *
 * 输出：
 *   1) 预览区域里的横向/纵向边线位置（暗像素计数峰值）→ 用来定位纸张外框与标签格子
 *   2) 由「间距最大的那对纵线」推出的格子宽 + mm/px 标尺（给了标签宽度时）
 *   3) 指定角区的 1:1 ASCII 图（# 暗 / . 亮）→ 直接数出圆弧跨几像素
 *
 * 为什么不自动拟合半径：真机预览会同时画「纸张外框」和「标签格子」两套近邻描边（相距 2~7px），
 * 还有抗锯齿，自动判角会把外框当成格子（round-104 实测踩过）。逐像素图 + 双图交叉验证更可靠。
 * 只读操作：除读 PNG 外不改任何文件。
 */
const path = require('path')
const { createCanvas, loadImage } = require(path.join(__dirname, '..', '..', 'app', 'node_modules', 'canvas'))

const isDark = (r, g, b) => r < 140 && g < 140 && b < 140

;(async () => {
  const a = process.argv.slice(2)
  if (a.length < 5) {
    console.log('用法：node tools/parity/measure-corner-radius.cjs <png> <x0> <y0> <x1> <y1> [标签宽度mm] [角区x 角区y [宽 高]]')
    process.exit(2)
  }
  const [file] = a
  const x0 = Number(a[1]), y0 = Number(a[2]), x1 = Number(a[3]), y1 = Number(a[4])
  const widthMm = a[5] ? Number(a[5]) : null
  const mx = a[6] !== undefined ? Number(a[6]) : null
  const my = a[7] !== undefined ? Number(a[7]) : null
  const mw = a[8] !== undefined ? Number(a[8]) : 46
  const mh = a[9] !== undefined ? Number(a[9]) : 20

  const img = await loadImage(file)
  const cv = createCanvas(img.width, img.height)
  const ctx = cv.getContext('2d')
  ctx.drawImage(img, 0, 0)
  const W = x1 - x0, H = y1 - y0
  const data = ctx.getImageData(x0, y0, W, H).data
  /** 传入**绝对**图像坐标，内部换算成区域相对下标（曾经因为混用坐标把图读成全亮，round-104 修） */
  const isD = (ax, ay) => {
    const x = ax - x0, y = ay - y0
    if (x < 0 || y < 0 || x >= W || y >= H) return false
    const i = (y * W + x) * 4
    return isDark(data[i], data[i + 1], data[i + 2])
  }

  const rows = [], cols = []
  for (let y = 0; y < H; y++) { let n = 0; for (let x = 0; x < W; x++) if (isD(x0 + x, y0 + y)) n++; if (n > W * 0.25) rows.push(y0 + y) }
  for (let x = 0; x < W; x++) { let n = 0; for (let y = 0; y < H; y++) if (isD(x0 + x, y0 + y)) n++; if (n > H * 0.25) cols.push(x0 + x) }

  console.log('图片：' + path.basename(file) + `  ${img.width}x${img.height}  分析区域 x${x0}..${x1} y${y0}..${y1}`)
  console.log('横线 y = ' + rows.join(' '))
  console.log('竖线 x = ' + cols.join(' '))
  if (cols.length >= 2) {
    let left = cols[0], right = cols[1], gap = right - left
    for (let i = 0; i + 1 < cols.length; i++) {
      const g = cols[i + 1] - cols[i]
      if (g > gap) { gap = g; left = cols[i]; right = cols[i + 1] }
    }
    const line = `格子（间距最大的那对竖线）：x ${left}..${right} = ${right - left}px`
    console.log(line + (widthMm ? `  ⇒ ${(widthMm / (right - left)).toFixed(4)} mm/px（按标签宽 ${widthMm}mm）` : ''))
  }

  if (mx !== null && my !== null) {
    console.log(`\n角区 1:1 ASCII（x${mx}..${mx + mw - 1} y${my}..${my + mh - 1}，# 暗 / . 亮）：`)
    for (let y = my; y < my + mh; y++) {
      let s = ''
      for (let x = mx; x < mx + mw; x++) {
        if (x < 0 || y < 0 || x >= img.width || y >= img.height) { s += '?'; continue }
        s += isD(x, y) ? '#' : '.'
      }
      console.log('  ' + String(y).padStart(4) + ' ' + s)
    }
  }
})().catch((e) => { console.error('ERR', e.message); process.exit(1) })
