/* 创建对象交互：光标、表格尺寸/完整性、斜线点对点方向。
   复现并锁定三个真实缺陷（2026-09-17 用户报）：
   ① 使用对象工具时鼠标没有十字指针（fabric 默认 hoverCursor=move 覆盖）；
   ② 表格渲染错位/不完整（fabric 7 的 Group 重排把表格画到错误位置）；
   ③ 斜线不按拖拽方向绘制（模型只有包围盒，缺少对角线方向）。 */
const http = require('http')
const WebSocket = require('ws')

function getJson(url) {
  return new Promise((resolve, reject) => {
    http.get(url, (res) => {
      let data = ''
      res.on('data', (chunk) => { data += chunk })
      res.on('end', () => { try { resolve(JSON.parse(data)) } catch (error) { reject(error) } })
    }).on('error', reject)
  })
}
function sleep(ms) { return new Promise((resolve) => setTimeout(resolve, ms)) }
function attach(wsUrl) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(wsUrl)
    let id = 0
    const pending = new Map()
    const send = (method, params = {}) => new Promise((res, rej) => {
      const messageId = ++id
      pending.set(messageId, { res, rej })
      ws.send(JSON.stringify({ id: messageId, method, params }))
    })
    ws.on('message', (raw) => {
      const message = JSON.parse(raw.toString())
      const item = pending.get(message.id)
      if (!item) return
      pending.delete(message.id)
      if (message.error) item.rej(new Error(message.error.message))
      else item.res(message.result)
    })
    ws.on('open', () => resolve({ ws, send }))
    ws.on('error', reject)
  })
}

;(async () => {
  let client
  const results = {}
  try {
    const port = process.env.MAXLABEL_DEBUG_PORT || 9222
    const pages = await getJson(`http://127.0.0.1:${port}/json/list`)
    const page = pages.find((item) => item.type === 'page')
    if (!page) throw new Error('no main page')
    client = await attach(page.webSocketDebuggerUrl)
    const evaluate = async (expression) => {
      const result = await client.send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true })
      if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description || result.exceptionDetails.text)
      return result.result?.value
    }
    const click = (selector) => evaluate(`(() => { const e=document.querySelector(${JSON.stringify(selector)}); if(!e || e.disabled)return false; e.click(); return true })()`)
    const waitFor = async (expression, timeout = 5000) => {
      const started = Date.now()
      while (Date.now() - started < timeout) { if (await evaluate(expression)) return true; await sleep(80) }
      return false
    }
    const clickTitle = (title) => evaluate(`(() => {
      const b=[...document.querySelectorAll('[data-testid=toolbar] button[title]')].find((e)=>e.getAttribute('title')===${JSON.stringify(title)})
      if(!b) return false; b.click(); return true })()`)
    /** 真实鼠标事件（Chromium 会转成 pointer 事件，fabric 7 监听的就是 pointer） */
    const mouse = (type, x, y, buttons = 1) => client.send('Input.dispatchMouseEvent', {
      type, x, y, button: 'left', buttons, clickCount: type === 'mousePressed' ? 1 : 0
    })
    const moveTo = async (x, y) => { await mouse('mouseMoved', x, y, 0); await sleep(120) }
    const drag = async (x1, y1, x2, y2) => {
      await moveTo(x1, y1)
      await mouse('mousePressed', x1, y1, 1)
      const steps = 6
      for (let i = 1; i <= steps; i++) {
        await mouse('mouseMoved', x1 + (x2 - x1) * i / steps, y1 + (y2 - y1) * i / steps, 1)
        await sleep(30)
      }
      await mouse('mouseReleased', x2, y2, 0)
      await sleep(500)
    }
    /** 画布坐标（页面坐标）处的暗像素判定；返回该点附近 3x3 是否含深色像素 */
    const darkNear = (x, y) => evaluate(`(() => {
      const c=document.querySelector('canvas.lower-canvas'); if(!c) return null
      const r=c.getBoundingClientRect(); const sx=c.width/r.width, sy=c.height/r.height
      const px=Math.round((${x}-r.left)*sx), py=Math.round((${y}-r.top)*sy)
      const ctx=c.getContext('2d'); const d=ctx.getImageData(Math.max(0,px-2),Math.max(0,py-2),5,5).data
      let dark=0
      for(let i=0;i<d.length;i+=4){ if(d[i]<170 && d[i+1]<170 && d[i+2]<170) dark++ }
      return dark
    })()`)
    /** 沿水平/垂直扫描线统计「深色段」数量（3×3 邻域判定，避免抗锯齿漏检） */
    const darkRuns = (x1, y1, x2, y2) => evaluate(`(() => {
      const c=document.querySelector('canvas.lower-canvas'); if(!c) return null
      const r=c.getBoundingClientRect(); const sx=c.width/r.width, sy=c.height/r.height
      const xa=Math.round((${x1}-r.left)*sx), ya=Math.round((${y1}-r.top)*sy)
      const xb=Math.round((${x2}-r.left)*sx), yb=Math.round((${y2}-r.top)*sy)
      const ctx=c.getContext('2d'); const n=Math.max(Math.abs(xb-xa),Math.abs(yb-ya))
      const isDark=(i)=>{ const t=n?i/n:0; const px=Math.round(xa+(xb-xa)*t), py=Math.round(ya+(yb-ya)*t)
        const d=ctx.getImageData(Math.max(0,px-1),Math.max(0,py-1),3,3).data
        for(let k=0;k<d.length;k+=4){ if(d[k]<170&&d[k+1]<170&&d[k+2]<170) return true }
        return false }
      let runs=0, prev=false
      for(let i=0;i<=n;i++){ const cur=isDark(i); if(cur&&!prev) runs++; prev=cur }
      return runs
    })()`)

    // ---- 打开编辑态（与其它 UI 用例一致：Ctrl+N → 向导 → 选择标签格式）----
    await sleep(1600)
    await evaluate('document.querySelector("button[aria-label=关闭]")?.click()')
    await sleep(400)
    const key = (name, options = {}) => evaluate(`(() => { const e=new KeyboardEvent('keydown',${JSON.stringify({ key: name, code: name, bubbles: true, cancelable: true, ...options })}); window.dispatchEvent(e); document.dispatchEvent(e); return e.defaultPrevented })()`)
    await key('n', { ctrlKey: true })
    await sleep(600)
    if (await evaluate('!!document.querySelector("[data-testid=template-wizard]")')) { await click('[data-testid=wizard-next]'); await sleep(500) }
    await click('[data-testid="new-label-select"]')
    if (!await waitFor('!!document.querySelector("canvas.upper-canvas")')) throw new Error('editor did not open')
    await sleep(600)

    const cursor = () => evaluate('getComputedStyle(document.querySelector("canvas.upper-canvas")).cursor')
    const canvasBox = await evaluate(`(() => { const r=document.querySelector('canvas.upper-canvas').getBoundingClientRect(); return { left:r.left, top:r.top, width:r.width, height:r.height } })()`)
    const emptyA = { x: canvasBox.left + 120, y: canvasBox.top + 90 }

    // ---- ① 每个对象工具在空白处都应是十字指针 ----
    const tools = ['选择工具：文字', '选择工具：表格', '选择工具：线条', '选择工具：斜线', '选择工具：条码', '选择工具：图片', '选择工具：RFID']
    const cursors = {}
    for (const t of tools) {
      await clickTitle(t)
      await sleep(260)
      await moveTo(emptyA.x, emptyA.y)
      cursors[t] = await cursor()
    }
    results['对象工具在空白处显示十字指针'] = Object.values(cursors).every((c) => c === 'crosshair')
    results['选择工具恢复默认指针'] = await (async () => { await clickTitle('选择工具：选取'); await sleep(260); await moveTo(emptyA.x, emptyA.y); return (await cursor()) !== 'crosshair' })()

    // ---- ② 用文字工具先建一个对象，工具模式下鼠标经过对象仍应是十字指针 ----
    await clickTitle('选择工具：文字')
    await sleep(200)
    const textPt = { x: canvasBox.left + 150, y: canvasBox.top + 150 }
    await drag(textPt.x, textPt.y, textPt.x + 120, textPt.y + 50)
    await sleep(400)
    await clickTitle('选择工具：表格')
    await sleep(200)
    await moveTo(textPt.x + 20, textPt.y + 20)
    results['工具模式下鼠标经过已有对象仍是十字指针'] = (await cursor()) === 'crosshair'

    // ---- ③ 表格：拖拽尺寸即表格大小，且是「完整表格」（竖线 cols+1 条、横线 rows+1 条）----
    const t1 = { x: canvasBox.left + 150, y: canvasBox.top + 300 }
    const t2 = { x: t1.x + 180, y: t1.y + 120 }
    // 先读拖拽起止点的毫米坐标，推导期望尺寸
    await moveTo(t1.x, t1.y)
    const mmA = await evaluate('document.querySelector("[data-testid=status-cursor]").innerText')
    await moveTo(t2.x, t2.y)
    const mmB = await evaluate('document.querySelector("[data-testid=status-cursor]").innerText')
    await drag(t1.x, t1.y, t2.x, t2.y)
    const info = await evaluate('document.querySelector("[data-testid=status-object-info]").innerText')
    const nums = (s) => (String(s).match(/-?\d+(\.\d+)?/g) || []).map(Number)
    const [ax, ay] = nums(mmA); const [bx, by] = nums(mmB)
    const objInfo = nums(info) // X, Y, W, H
    const expW = Math.abs(bx - ax); const expH = Math.abs(by - ay)
    results['表格尺寸跟随拖拽（宽）'] = Math.abs(objInfo[2] - expW) <= 1.2
    results['表格尺寸跟随拖拽（高）'] = Math.abs(objInfo[3] - expH) <= 1.2
    // 表格内部竖线：扫描表格中线，应命中 cols+1=3 条竖线
    const midY = t1.y + (t2.y - t1.y) / 2
    const vRuns = await darkRuns(t1.x - 2, midY, t2.x + 2, midY)
    results['表格竖线完整（外框+内线共 3 条）'] = vRuns === 3
    // 横向扫描线取 1/4 处（避开列分隔线，否则会沿着竖线扫出单段）
    const midX = t1.x + (t2.x - t1.x) * 0.25
    const hRuns = await darkRuns(midX, t1.y - 2, midX, t2.y + 2)
    results['表格横线完整（外框+内线共 4 条）'] = hRuns === 4
    // 表格不应被画到标签左上角（旧缺陷：组定位错位到画布原点）
    results['表格未错位到标签左上角'] = (await darkNear(canvasBox.left + 6, canvasBox.top + 6)) === 0

    // ---- ④ 斜线：点对点方向（右下拖 = ↘；右上拖 = ↗）----
    // 判定方式：沿这条对角线方向内缩 12% 取点应命中线条；另一条对角线同位置应留白。
    const inset = (a, b, t) => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t })
    const d1a = { x: canvasBox.left + 420, y: canvasBox.top + 300 }
    const d1b = { x: d1a.x + 140, y: d1a.y + 110 }
    await clickTitle('选择工具：斜线'); await sleep(200)
    await drag(d1a.x, d1a.y, d1b.x, d1b.y)
    await sleep(300)
    const onNwse = await darkNear(inset(d1a, d1b, 0.12).x, inset(d1a, d1b, 0.12).y)
    const offNwse = await darkNear(inset(d1b, { x: d1a.x, y: d1b.y }, 0.12).x, inset(d1b, { x: d1a.x, y: d1b.y }, 0.12).y)
    results['右下拖的斜线沿 ↘ 绘制'] = onNwse > 0 && offNwse === 0

    const d2a = { x: canvasBox.left + 620, y: canvasBox.top + 410 }
    const d2b = { x: d2a.x + 140, y: d2a.y - 110 }
    await clickTitle('选择工具：斜线'); await sleep(200)
    await drag(d2a.x, d2a.y, d2b.x, d2b.y)
    await sleep(300)
    // 右上拖：真正的两个角是 (d2b.x, d2b.y)=右上 与 (d2a.x, d2a.y)=左下
    const onNesw = await darkNear(inset(d2a, d2b, 0.12).x, inset(d2a, d2b, 0.12).y)
    const offNesw = await darkNear(inset({ x: d2a.x, y: d2b.y }, { x: d2b.x, y: d2a.y }, 0.12).x, inset({ x: d2a.x, y: d2b.y }, { x: d2b.x, y: d2a.y }, 0.12).y)
    results['右上拖的斜线沿 ↗ 绘制'] = onNesw > 0 && offNesw === 0

    // ---- ⑨ 真机「系统设置 → 常规」的「新建对象后自动打开属性页」 ----
    // 默认未勾选（65-dlg-options.png）→ 新建对象不弹属性；勾选后新建对象立即弹属性
    const openOptions = async () => {
      await key('o', { altKey: true }); await sleep(320)
      await evaluate(`[...document.querySelectorAll('[data-menu-item]')].find((e)=>(e.getAttribute('data-menu-item')||'').startsWith('系统选项'))?.click()`)
      await sleep(320)
    }
    await openOptions()
    results['系统设置含「新建对象后自动打开属性页」且默认未勾选（真机同）'] = await evaluate(`(() => {
      const box=document.querySelector('[data-testid="auto-open-object-props"]')
      if(!box) return false
      return box.checked === false && (document.body.innerText||'').includes('新建对象后自动打开属性页')
    })()`)
    await click('[data-testid="auto-open-object-props"]'); await sleep(120)
    await evaluate(`[...document.querySelectorAll('[data-testid=options-dialog] button')].find((b)=>(b.textContent||'').includes('确定'))?.click()`)
    await sleep(360)
    await clickTitle('选择工具：矩形'); await sleep(240)
    const autoA = { x: canvasBox.left + 260, y: canvasBox.top + 210 }
    await drag(autoA.x, autoA.y, autoA.x + 70, autoA.y + 40)
    await sleep(600)
    results['勾选后新建对象会自动打开属性对话框'] = await evaluate('!!document.querySelector("[data-testid=object-props-dialog]")')
    await evaluate(`[...document.querySelectorAll('[data-testid=object-props-dialog] button')].find((b)=>(b.textContent||'').includes('取消')||(b.textContent||'').includes('关闭'))?.click()`)
    await sleep(240)
    await openOptions()
    await click('[data-testid="auto-open-object-props"]'); await sleep(120)
    await evaluate(`[...document.querySelectorAll('[data-testid=options-dialog] button')].find((b)=>(b.textContent||'').includes('确定'))?.click()`)
    await sleep(320)

    let pass = 0
    for (const [name, value] of Object.entries(results)) {
      console.log((value ? 'PASS ' : 'FAIL ') + name + ' => ' + value)
      if (value === true) pass++
    }
    console.log(`\n${pass}/${Object.keys(results).length} PASS`)
    client.ws.close()
    process.exit(pass === Object.keys(results).length ? 0 : 1)
  } catch (error) {
    console.error('ERR', error.message)
    if (client) client.ws.close()
    process.exit(2)
  }
})()
