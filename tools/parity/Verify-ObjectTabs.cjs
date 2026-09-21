/*
 * 复刻版「对象属性」页签验收工装（P1.5 / DIFF-64）
 *
 * 真机取证（parity/reference/labelshop/PROBE-verifier-object-tabs.md）：
 *   文字 = 数据源 / 字体 / 文本 / 常规
 *   条码 = 数据源 / 条码 / 字体 / 常规        （**没有**码制专页；码制专属项在「条码」页内）
 *   矩形/椭圆/直线 = 图形 / 常规
 *   表格 = 表格 / 常规
 *   图片 = 图片 / 常规
 * 本工装逐类型新建对象 → 打开属性对话框 → 读页签数组 → **整数组全等**断言（顺序也要对）。
 *
 * 用法：node tools/parity/Verify-ObjectTabs.cjs [--port 9333] [--types text,barcode,rect,ellipse,line,table]
 * 前置：调用方自己起一个带 --remote-debugging-port 的实例（不占 test:ui 锁）。
 *
 * ⚠️ 校准状态（round-58 验收方实测）：**尚未校准通过**。已修掉的一处是"确定"按钮的 testid
 * （真名是 `new-label-select`，不是 `new-label-confirm`）；仍不对的一处是**建对象那一步**：
 * `element.click()` 打 `[data-tool="barcode"]` **不会create对象**（实测 10s 内图层行始终 0、
 * 属性对话框不出现）。循环自己的 `ui-v109.cjs` 用的是 **CDP 真实鼠标事件**（Input.dispatchMouseEvent
 * 的 press/moveTo/release + 对图层行几何 `[data-testid="layer-object-row"][data-object-*]` 做
 * `sceneToViewport(毫米×10px/mm)` 换算后双击对象）**打开**属性页。要让它可用，需照抄这套：
 *   ① 用 CDP 在按钮中心发 mousePressed/mouseReleased（而不是 DOM click）；
 *   ② 对象建好后，按图层行的 x/y/w/h（毫米，画布 10px/mm）算出视口坐标，发 clickCount=2 的双击。
 * 在未校准前，P1.5 的页签回归**以循环的全量门禁为准**（`ui-v109/ui-v106/...` 里已有整数组全等断言）。
 */
const http = require('http')
const path = require('path')
const WebSocket = require(path.join(__dirname, '..', '..', 'app', 'node_modules', 'ws'))

const EXPECT = {
  text: ['数据源', '字体', '文本', '常规'],
  barcode: ['数据源', '条码', '字体', '常规'],
  rect: ['图形', '常规'],
  ellipse: ['图形', '常规'],
  line: ['图形', '常规'],
  table: ['表格', '常规'],
  image: ['图片', '常规']
}

function getJson(url) {
  return new Promise((resolve, reject) => {
    http.get(url, (res) => { let d = ''; res.on('data', (c) => { d += c }); res.on('end', () => { try { resolve(JSON.parse(d)) } catch (e) { reject(e) } }) }).on('error', reject)
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
    ws.on('open', () => resolve({
      ws,
      send: (method, params = {}) => new Promise((res, rej) => { const i = ++id; pending.set(i, { resolve: res, reject: rej }); ws.send(JSON.stringify({ id: i, method, params })) })
    }))
    ws.on('error', reject)
  })
}
function argOf(name, def) {
  const i = process.argv.indexOf('--' + name)
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : def
}

;(async () => {
  const port = Number(argOf('port', process.env.MAXLABEL_DEBUG_PORT || 9222))
  const types = argOf('types', 'text,barcode,rect,ellipse,line,table').split(',').map((s) => s.trim()).filter(Boolean)
  const pages = await getJson(`http://127.0.0.1:${port}/json/list`)
  const page = pages.find((p) => p.type === 'page')
  if (!page) throw new Error('没有找到页面（实例没起或端口不对）')
  const c = await attach(page.webSocketDebuggerUrl)
  const ev = async (e) => {
    const r = await c.send('Runtime.evaluate', { expression: e, awaitPromise: true, returnByValue: true })
    if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || r.exceptionDetails.text)
    return r.result?.value
  }
  const waitFor = async (expr, timeout = 7000) => { const t0 = Date.now(); while (Date.now() - t0 < timeout) { if (await ev(expr)) return true; await sleep(90) } return false }

  // 进入编辑器：冷启动 → 向导 → 建立文档
  await sleep(1200)
  await ev('document.querySelector("button[aria-label=关闭]")?.click()')
  await ev('document.dispatchEvent(new KeyboardEvent("keydown",{key:"n",code:"KeyN",ctrlKey:true,bubbles:true,cancelable:true}))')
  await sleep(500)
  if (await ev('!!document.querySelector("[data-testid=template-wizard]")')) { await ev('document.querySelector("[data-testid=wizard-next]")?.click()'); await sleep(400) }
  if (await waitFor('!!document.querySelector("[data-testid=new-label-dialog]")')) {
    await ev('document.querySelector("[data-testid=new-label-select]")?.click()')
  }
  if (!(await waitFor('!!document.querySelector("canvas.upper-canvas")', 9000))) throw new Error('没能进入编辑器')

  const results = {}
  for (const t of types) {
    const expect = EXPECT[t]
    if (!expect) { results[`SKIP ${t}（工装无期望值）`] = false; continue }
    const has = await ev(`!!document.querySelector('[data-tool="${t}"]')`)
    if (!has) { results[`SKIP ${t}（工具栏没有该工具）`] = false; continue }
    await ev(`document.querySelector('[data-tool="${t}"]').click()`)
    await sleep(600)
    const opened = await waitFor('!!document.querySelector(\'[data-testid="object-props-dialog"]\')', 5000)
    if (!opened) {
      // 有些对象新建后不自动弹属性页：双击对象再试
      await ev(`(() => { const el=document.querySelector('[data-object-type="${t}"]'); if(el){ el.dispatchEvent(new MouseEvent('dblclick',{bubbles:true})) } })()`)
      await sleep(500)
    }
    const tabs = await ev(`([...document.querySelectorAll('[data-testid="object-props-dialog"] [data-testid^="object-props-tab-"]')].map((e)=>(e.textContent||'').trim()))`)
    results[`${t} 页签 = ${expect.join('/')}`] = Array.isArray(tabs) && JSON.stringify(tabs) === JSON.stringify(expect)
    if (!results[`${t} 页签 = ${expect.join('/')}`]) results[`${t} 实测`] = JSON.stringify(tabs)
    // 关掉对话框 + 删掉刚建的对象，保持画布干净
    await ev(`document.querySelector('[data-testid="object-props-dialog"] button[aria-label]')?.click()`)
    await sleep(200)
    await ev(`(() => { const el=document.querySelector('[data-object-type="${t}"]'); if(el){ el.dispatchEvent(new MouseEvent('mousedown',{bubbles:true})); document.dispatchEvent(new KeyboardEvent('keydown',{key:'Delete',code:'Delete',bubbles:true})) } })()`)
    await sleep(250)
  }

  let pass = 0, total = 0
  for (const [k, v] of Object.entries(results)) {
    if (k.startsWith('SKIP')) { console.log('SKIP ' + k); continue }
    if (k.includes('实测')) { console.log('     ' + k + ' => ' + v); continue }
    total++
    if (v) pass++
    console.log((v ? 'PASS ' : 'FAIL ') + k)
  }
  console.log(`\n${pass}/${total} PASS`)
  c.ws.close()
  process.exit(pass === total ? 0 : 1)
})().catch((e) => { console.error('ERR', e.message); process.exit(2) })
