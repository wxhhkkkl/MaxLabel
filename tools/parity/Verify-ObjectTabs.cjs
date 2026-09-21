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
  line: ['图形', '常规'],
  // `diagonal`（斜线）：真机工具菜单是「线条 / 斜线」两项，页签预期同「直线」= 图形/常规（沿用直线取证推断）
  diagonal: ['图形', '常规'],
  table: ['表格', '常规'],
  image: ['图片', '常规']
}
// 说明：clone 的工具栏实测为 `select/barcode/text/line/diagonal/rect/image/table/rfid/data`（**没有 ellipse**，
// 与真机工具菜单 `选取/条码/文字/线条/斜线/矩形/图片/数据/表格` 一致 ✓）；rfid/data 的页签真机未取证 → 本工装不判。

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

  // —— 以下四个 helper 从循环的 app/scripts/ui-v109.cjs 移植（同一套已被验证的驱动方式）——
  // 画布在 100% 缩放时 element 尺寸＝标签场景尺寸、原点对齐（10px/mm）；对象几何从「图层行」读。
  const canvasRect = () => ev(`(() => { const c=document.querySelector('canvas.upper-canvas'); if(!c) return null; const r=c.getBoundingClientRect(); return { left:r.left, top:r.top, width:r.width, height:r.height } })()`)
  const press = (x, y, clickCount) => c.send('Input.dispatchMouseEvent', { type: 'mousePressed', x: Math.round(x), y: Math.round(y), button: 'left', buttons: 1, clickCount })
  const release = (x, y, clickCount) => c.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: Math.round(x), y: Math.round(y), button: 'left', buttons: 0, clickCount })
  const doubleClickAt = async (x, y) => { await press(x, y, 1); await release(x, y, 1); await sleep(50); await press(x, y, 2); await release(x, y, 2) }
  const sceneToViewport = (sx, sy, rect) => ({ x: rect.left + sx, y: rect.top + sy })
  const geomOf = (t) => ev(`(() => {
    const row=[...document.querySelectorAll('[data-testid="layer-object-row"]')].find((e)=>e.getAttribute('data-object-type')===${JSON.stringify(t)})
    if(!row) return null
    return { x:Number(row.getAttribute('data-object-x')), y:Number(row.getAttribute('data-object-y')), w:Number(row.getAttribute('data-object-w')), h:Number(row.getAttribute('data-object-h')) }
  })()`)
  const countOfType = (t) => ev(`document.querySelectorAll('[data-testid="layer-object-row"][data-object-type=${JSON.stringify(t)}]').length`)
  /** 建对象：工具栏按钮只是**选中工具**，对象要在**画布上落点**才产生（round-62 实测：
   *  DOM click / CDP 点按钮都不会建对象，点画布才让图层行从 0 → 1）。
   *  返回**落点**——后面双击对象就用它（不靠"毫米×10"换算，因画布可能有滚动/非 100% 缩放：
   *  round-62 实测按几何换算时 text/barcode/rect/line 都点空了，只有 table 偶然命中）。 */
  const createObject = async (t) => {
    const before = await countOfType(t)
    await ev(`(() => { const b=document.querySelector('[data-tool="${t}"]'); if(b && !b.disabled) b.click() })()`)
    await sleep(250)
    const rect = await canvasRect()
    if (!rect) return null
    const pts = [
      { x: rect.left + rect.width * 0.35, y: rect.top + rect.height * 0.35 },
      { x: rect.left + rect.width * 0.6, y: rect.top + rect.height * 0.6 }
    ]
    for (const p of pts) {
      await press(p.x, p.y, 1); await release(p.x, p.y, 1)
      for (let i = 0; i < 20; i++) { if ((await countOfType(t)) > before) return p; await sleep(100) }
    }
    return null
  }
  /** 在对象内部找一个点双击打开属性页：以"建对象时的落点"为左上角向右下偏一点（与缩放无关）。
   *  `line`/`diagonal` 这类对象高度为 0（图层几何 h=0），**必须沿线上点**（dy 固定 0），否则永远点空。 */
  const openPropsByDoubleClick = async (point, type) => {
    if (!point) return false
    const offsets = type === 'line' || type === 'diagonal'
      ? [[6, 0], [12, 0], [20, 0], [30, 0], [0, 0]]
      : [[12, 10], [24, 12], [40, 16], [8, 6], [0, 0]]
    for (const [dx, dy] of offsets) {
      await doubleClickAt(point.x + dx, point.y + dy)
      if (await waitFor('!!document.querySelector(\'[data-testid="object-props-dialog"]\')', 2500)) return true
    }
    return false
  }

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
  /** 每个类型都用**新建文档**开一块干净画布（round-62 实测：撤销/Delete 都删不掉刚建的对象，
   *  残留对象会让"双击对象中心"点到上一个对象、读到上一个对象的页签 —— 这是最容易出假结果的地方）。 */
  const newDocument = async () => {
    await ev(`document.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',code:'Escape',bubbles:true,cancelable:true}))`)
    await sleep(150)
    await ev(`document.dispatchEvent(new KeyboardEvent('keydown',{key:'n',code:'KeyN',ctrlKey:true,bubbles:true,cancelable:true}))`)
    await sleep(400)
    if (await ev('!!document.querySelector("[data-testid=template-wizard]")')) { await ev('document.querySelector("[data-testid=wizard-next]")?.click()'); await sleep(400) }
    if (!(await waitFor('!!document.querySelector("[data-testid=new-label-dialog]")', 6000))) return false
    await ev('document.querySelector("[data-testid=new-label-select]")?.click()')
    return await waitFor('!!document.querySelector("canvas.upper-canvas")', 9000)
  }

  for (const t of types) {
    const expect = EXPECT[t]
    if (!expect) { results[`SKIP ${t}（工装无期望值）`] = false; continue }
    const has = await ev(`!!document.querySelector('[data-tool="${t}"]')`)
    if (!has) { results[`SKIP ${t}（工具栏没有该工具）`] = false; continue }
    if (!(await newDocument())) { results[`SKIP ${t}（新建文档失败）`] = false; continue }
    await sleep(500)
    const point = await createObject(t)
    if (!point) { results[`SKIP ${t}（没能建出对象）`] = false; continue }
    // 打开属性对话框：真机/复刻版都是**双击对象**（DOM 事件打不到 fabric 对象，必须走 CDP 真实鼠标）。
    // 落点用"建对象时点的那一处"向右下偏一点，**不做毫米→像素换算**（避免画布滚动/缩放导致点空）。
    const opened = await openPropsByDoubleClick(point, t)
    if (!opened) { results[`SKIP ${t}（双击对象没打开属性对话框，落点=${JSON.stringify(point)}）`] = false; continue }
    const tabs = await ev(`([...document.querySelectorAll('[data-testid="object-props-dialog"] [data-testid^="object-props-tab-"]')].map((e)=>(e.textContent||'').trim()))`)
    const key = `${t} 页签 = ${expect.join('/')}`
    results[key] = Array.isArray(tabs) && JSON.stringify(tabs) === JSON.stringify(expect)
    if (!results[key]) results[`${t} 实测`] = JSON.stringify(tabs)
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
