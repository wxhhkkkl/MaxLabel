/*
 * 复刻版「条码渲染」验收工装 —— 直接验证用户实测过的那件事：**新建条码不能是一块黑**。
 *
 * 背景：round-63 用户反馈「新建条码全黑」，根因是 bwip-js 不吃 8 位带 alpha 的 backgroundcolor
 * （'FFFFFF00' → 整张 100% 黑）。渲染层的确定性断言已加在 app/scripts/render-regression.ts；
 * 本工装从**界面这一层**再验一次（建对象 → 截该对象区域 → 量黑/白像素比），防止 UI 路径单独出问题。
 *
 * 用法：node tools/parity/Verify-BarcodeRender.cjs [--port 9333] [--out <png>]
 * 前置：调用方自己起一个带 --remote-debugging-port 的实例（不占 test:ui 锁）。
 */
const http = require('http')
const path = require('path')
const fs = require('fs')
const WebSocket = require(path.join(__dirname, '..', '..', 'app', 'node_modules', 'ws'))
const { createCanvas, loadImage } = require(path.join(__dirname, '..', '..', 'app', 'node_modules', 'canvas'))

function getJson(url) {
  return new Promise((resolve, reject) => {
    http.get(url, (res) => { let d = ''; res.on('data', (c) => d += c); res.on('end', () => { try { resolve(JSON.parse(d)) } catch (e) { reject(e) } }) }).on('error', reject)
  })
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
function attach(wsUrl) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(wsUrl)
    let id = 0
    const pending = new Map()
    ws.on('message', (raw) => {
      const m = JSON.parse(raw.toString())
      const it = pending.get(m.id)
      if (!it) return
      pending.delete(m.id)
      if (m.error) it.reject(new Error(m.error.message))
      else it.resolve(m.result)
    })
    ws.on('open', () => resolve({ ws, send: (method, params = {}) => new Promise((res, rej) => { const i = ++id; pending.set(i, { resolve: res, reject: rej }); ws.send(JSON.stringify({ id: i, method, params })) }) }))
    ws.on('error', reject)
  })
}
function argOf(name, def) {
  const i = process.argv.indexOf('--' + name)
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : def
}

;(async () => {
  const port = Number(argOf('port', process.env.MAXLABEL_DEBUG_PORT || 9222))
  const out = argOf('out', path.join(__dirname, '..', '..', 'parity', 'reference', 'maxlabel', 'probe-clone-barcode.png'))
  const pages = await getJson(`http://127.0.0.1:${port}/json/list`)
  const page = pages.find((p) => p.type === 'page')
  if (!page) throw new Error('没有找到页面（实例没起或端口不对）')
  const c = await attach(page.webSocketDebuggerUrl)
  const ev = async (e) => {
    const r = await c.send('Runtime.evaluate', { expression: e, awaitPromise: true, returnByValue: true })
    if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || r.exceptionDetails.text)
    return r.result?.value
  }
  const waitFor = async (expr, timeout = 8000) => { const t0 = Date.now(); while (Date.now() - t0 < timeout) { if (await ev(expr)) return true; await sleep(90) } return false }
  const press = (x, y, n) => c.send('Input.dispatchMouseEvent', { type: 'mousePressed', x: Math.round(x), y: Math.round(y), button: 'left', buttons: 1, clickCount: n })
  const release = (x, y, n) => c.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: Math.round(x), y: Math.round(y), button: 'left', buttons: 0, clickCount: n })
  const canvasRect = () => ev(`(() => { const el=document.querySelector('canvas.upper-canvas'); if(!el) return null; const r=el.getBoundingClientRect(); return { left:r.left, top:r.top, width:r.width, height:r.height } })()`)
  const geomOf = (t) => ev(`(() => {
    const row=[...document.querySelectorAll('[data-testid="layer-object-row"]')].find((e)=>e.getAttribute('data-object-type')===${JSON.stringify(t)})
    if(!row) return null
    return { x:Number(row.getAttribute('data-object-x')), y:Number(row.getAttribute('data-object-y')), w:Number(row.getAttribute('data-object-w')), h:Number(row.getAttribute('data-object-h')) }
  })()`)

  // 进编辑器
  await sleep(1200)
  await ev('document.querySelector("button[aria-label=关闭]")?.click()')
  await ev('document.dispatchEvent(new KeyboardEvent("keydown",{key:"n",code:"KeyN",ctrlKey:true,bubbles:true,cancelable:true}))')
  await sleep(500)
  if (await ev('!!document.querySelector("[data-testid=template-wizard]")')) { await ev('document.querySelector("[data-testid=wizard-next]")?.click()'); await sleep(400) }
  if (await waitFor('!!document.querySelector("[data-testid=new-label-dialog]")')) await ev('document.querySelector("[data-testid=new-label-select]")?.click()')
  if (!(await waitFor('!!document.querySelector("canvas.upper-canvas")', 9000))) throw new Error('没能进入编辑器')
  await sleep(500)

  // 选条码工具 → 点画布落点（round-62 查明：工具只是"选中"，落点才建对象）
  await ev(`(() => { const b=document.querySelector('[data-tool="barcode"]'); if(b && !b.disabled) b.click() })()`)
  await sleep(250)
  const rect = await canvasRect()
  await press(rect.left + rect.width * 0.35, rect.top + rect.height * 0.35, 1)
  await release(rect.left + rect.width * 0.35, rect.top + rect.height * 0.35, 1)
  let geom = null
  for (let i = 0; i < 30; i++) { geom = await geomOf('barcode'); if (geom) break; await sleep(120) }
  if (!geom) throw new Error('没能建出条码对象')
  await sleep(900) // 等 fabric 把条码图片加载/绘制完

  // 截该对象区域：**必须按画布实际缩放换算**（状态栏可能是 79%/261% 等）。
  // round-67 踩坑：先前写死"毫米×10px/mm（＝100% 缩放）"，结果裁到别处、量出来 16.7% 黑还误判 PASS。
  const label = await ev(`(() => { const a=document.querySelector('[data-testid="template-edit-area"]'); return a ? { w:Number(a.getAttribute('data-width-mm')), h:Number(a.getAttribute('data-height-mm')) } : null })()`)
  if (!label || !label.w) throw new Error('读不到标签尺寸（template-edit-area）')
  const scale = rect.width / label.w // px per mm（含缩放）
  const clip = {
    x: Math.max(0, rect.left + geom.x * scale),
    y: Math.max(0, rect.top + geom.y * scale),
    width: Math.max(8, geom.w * scale),
    height: Math.max(8, geom.h * scale),
    scale: 1
  }
  const shot = await c.send('Page.captureScreenshot', { format: 'png', clip })
  fs.mkdirSync(path.dirname(out), { recursive: true })
  fs.writeFileSync(out, Buffer.from(shot.data, 'base64'))

  const img = await loadImage(Buffer.from(shot.data, 'base64'))
  const cnv = createCanvas(img.width, img.height)
  const g = cnv.getContext('2d')
  g.drawImage(img, 0, 0)
  const d = g.getImageData(0, 0, img.width, img.height).data
  let dark = 0, light = 0, other = 0
  for (let i = 0; i < d.length; i += 4) {
    const r = d[i], gg = d[i + 1], b = d[i + 2]
    if (r < 64 && gg < 64 && b < 64) dark++
    else if (r > 200 && gg > 200 && b > 200) light++
    else other++
  }
  const total = img.width * img.height
  const darkRatio = dark / total
  const lightRatio = light / total
  // 关键判据：沿对象**水平中线**数"黑↔白"跳变次数。真条码有几十次；一整块黑只有 0~2 次。
  const midY = Math.floor(img.height * 0.4)
  let transitions = 0, prev = null
  for (let x = 0; x < img.width; x++) {
    const i = (midY * img.width + x) * 4
    const isDark = d[i] < 128
    if (prev !== null && isDark !== prev) transitions++
    prev = isDark
  }
  console.log(`条码对象区域：${img.width}x${img.height}px（缩放 ${(scale / 10 * 100).toFixed(0)}%）  黑=${(darkRatio * 100).toFixed(1)}%  白=${(lightRatio * 100).toFixed(1)}%  中线跳变=${transitions}`)
  console.log(`截图：${out}`)
  const pass = transitions >= 10 && darkRatio > 0.05 && darkRatio < 0.8
  console.log(pass ? 'PASS 条码区域是"黑白相间"的条码（跳变≥10），不是整块黑' : 'FAIL 条码区域疑似全黑/空白/裁歪（用户反馈过的那类问题）')
  c.ws.close()
  process.exit(pass ? 0 : 1)
})().catch((e) => { console.error('ERR', e.message); process.exit(2) })
