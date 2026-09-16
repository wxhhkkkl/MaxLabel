/* B-19/B-20/B-24/B-26：排列对齐/相对标签/间距/旋转的实际坐标回归。 */
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
    const setMenuOrButton = (title) => evaluate(`(() => { const es=[...document.querySelectorAll('button[title]')].filter((e)=>e.offsetParent && e.title===${JSON.stringify(title)} && !e.disabled); if(!es.length)return false; es.at(-1).click(); return true })()`)
    const waitFor = async (expression, timeout = 2500) => {
      const started = Date.now()
      while (Date.now() - started < timeout) { if (await evaluate(expression)) return true; await sleep(80) }
      return false
    }
    const key = (name, options = {}) => evaluate(`(() => { const e=new KeyboardEvent('keydown',${JSON.stringify({ key:name, code:name, bubbles:true, cancelable:true, ...options })}); window.dispatchEvent(e); document.dispatchEvent(e); return e.defaultPrevented })()`)
    const dragCanvas = (x1, y1, x2, y2) => evaluate(`(() => { const c=document.querySelector('canvas.upper-canvas')||document.querySelector('canvas'); if(!c)return false; const b=c.getBoundingClientRect(); const p=(x,y,buttons=1)=>({bubbles:true,cancelable:true,view:window,clientX:b.left+x,clientY:b.top+y,button:0,buttons}); c.dispatchEvent(new MouseEvent('mousedown',p(${x1},${y1}))); c.dispatchEvent(new MouseEvent('mousemove',p(${x2},${y2}))); c.dispatchEvent(new MouseEvent('mouseup',{...p(${x2},${y2},0),buttons:0})); return true })()`)
    const rows = () => evaluate(`([...document.querySelectorAll('[data-testid=layer-object-row][data-object-type="rect"]')].map((e)=>({id:e.dataset.objectId,x:Number(e.dataset.objectX),y:Number(e.dataset.objectY),w:Number(e.dataset.objectW),h:Number(e.dataset.objectH),rotation:Number(e.dataset.objectRotation)})))`)
    const selectAll = async () => { await key('a', { ctrlKey: true }); await sleep(180) }
    const closeStart = async () => { await evaluate('document.querySelector("button[aria-label=关闭]")?.click()'); await sleep(120) }
    const approx = (a, b) => Math.abs(a - b) < 0.011

    await sleep(1800)
    await closeStart()
    await key('n', { ctrlKey: true }); await sleep(300)
    if (await evaluate('!!document.querySelector("[data-testid=template-wizard]")')) { await click('[data-testid=wizard-next]'); await sleep(300) }
    await click('[data-testid="new-label-select"]')
    if (!await waitFor('!!document.querySelector("canvas.upper-canvas")')) throw new Error('editor did not open')

    // Create the reference object first, but place it between two peers. This
    // catches implementations that align to the union's outer edge.
    await click('[data-tool="rect"]'); await dragCanvas(360, 110, 430, 160)
    await click('[data-tool="rect"]'); await dragCanvas(120, 230, 210, 275)
    await click('[data-tool="rect"]'); await dragCanvas(600, 350, 710, 420)
    await sleep(400)
    const initial = await rows()
    if (initial.length !== 3) throw new Error(`expected 3 rects, got ${initial.length}`)
    // LayerPanel displays topmost first; the last row is the first-created
    // object and therefore the first/blue reference returned by ActiveSelection.
    const reference = initial.at(-1)
    const refX = reference.x

    await selectAll()
    if (!await setMenuOrButton('左对齐')) throw new Error('left align button unavailable')
    await sleep(280)
    const aligned = await rows()
    results['B-19 左端以首个主对象为参考'] = aligned.every((item) => approx(item.x, refX))

    // A document update restores the model's primary selection, so explicitly
    // reselect the three objects before each multi-object command.
    await selectAll()
    const beforeCenter = await rows()
    if (!await setMenuOrButton('水平居中（相对标签）')) throw new Error('horizontal center button unavailable')
    await sleep(280)
    const afterCenter = await rows()
    const centerDeltas = beforeCenter.map((item) => {
      const next = afterCenter.find((candidate) => candidate.id === item.id)
      return next ? next.x - item.x : NaN
    })
    results['B-20 水平居中按视觉并集整体平移'] = centerDeltas.length === 3 && centerDeltas.every((delta) => approx(delta, centerDeltas[0]))

    await selectAll()
    const beforeH = await rows()
    if (!await setMenuOrButton('水平间距相同')) throw new Error('horizontal distribution button unavailable')
    await sleep(280)
    const afterH = await rows()
    const sortedBeforeH = [...beforeH].sort((a, b) => a.x - b.x || a.id.localeCompare(b.id))
    // Keep the pre-command order by object id.  If source objects overlap,
    // the post-command x positions can temporarily be out of visual order;
    // LabelShop still preserves the selected order for the first/last pair.
    const sortedAfterH = sortedBeforeH.map((item) => afterH.find((candidate) => candidate.id === item.id))
    const gapH = (items) => items.slice(1).map((item, index) => item.x - (items[index].x + items[index].w))
    const beforeFirstH = sortedBeforeH[0]
    const beforeLastH = sortedBeforeH.at(-1)
    const afterFirstH = sortedAfterH[0]
    const afterLastH = sortedAfterH.at(-1)
    const gapsH = gapH(sortedAfterH)
    results['B-24 水平间距保持首尾边界且相等'] = approx(afterFirstH.x, beforeFirstH.x) && approx(afterLastH.x + afterLastH.w, beforeLastH.x + beforeLastH.w) && approx(gapsH[0], gapsH[1])

    await selectAll()
    const beforeV = await rows()
    if (!await setMenuOrButton('垂直间距相同')) throw new Error('vertical distribution button unavailable')
    await sleep(280)
    const afterV = await rows()
    const sortedBeforeV = [...beforeV].sort((a, b) => a.y - b.y || a.id.localeCompare(b.id))
    const sortedAfterV = sortedBeforeV.map((item) => afterV.find((candidate) => candidate.id === item.id))
    const gapV = (items) => items.slice(1).map((item, index) => item.y - (items[index].y + items[index].h))
    const beforeFirstV = sortedBeforeV[0]
    const beforeLastV = sortedBeforeV.at(-1)
    const afterFirstV = sortedAfterV[0]
    const afterLastV = sortedAfterV.at(-1)
    const gapsV = gapV(sortedAfterV)
    results['B-24 垂直间距保持首尾边界且相等'] = approx(afterFirstV.y, beforeFirstV.y) && approx(afterLastV.y + afterLastV.h, beforeLastV.y + beforeLastV.h) && approx(gapsV[0], gapsV[1])

    await selectAll()
    const beforeRotate = await rows()
    const union = beforeRotate.reduce((acc, item) => ({ left: Math.min(acc.left, item.x), top: Math.min(acc.top, item.y), right: Math.max(acc.right, item.x + item.w), bottom: Math.max(acc.bottom, item.y + item.h) }), { left: Infinity, top: Infinity, right: -Infinity, bottom: -Infinity })
    const pivot = { x: (union.left + union.right) / 2, y: (union.top + union.bottom) / 2 }
    if (!await setMenuOrButton('左旋 90°')) throw new Error('rotate button unavailable')
    await sleep(280)
    const afterRotate = await rows()
    const rotatedCorrectly = beforeRotate.every((item) => {
      const next = afterRotate.find((candidate) => candidate.id === item.id)
      if (!next || next.rotation !== 90) return false
      const cx = item.x + item.w / 2
      const cy = item.y + item.h / 2
      const expectedCx = pivot.x - (cy - pivot.y)
      const expectedCy = pivot.y + (cx - pivot.x)
      return approx(next.x + next.w / 2, expectedCx) && approx(next.y + next.h / 2, expectedCy)
    })
    results['B-26 左旋90度绕多选视觉中心'] = rotatedCorrectly

    let pass = 0
    for (const [name, value] of Object.entries(results)) { console.log((value ? 'PASS ' : 'FAIL ') + name + ' => ' + value); if (value) pass++ }
    console.log(`\n${pass}/${Object.keys(results).length} PASS`)
    client.ws.close()
    process.exit(pass === Object.keys(results).length ? 0 : 1)
  } catch (error) {
    console.error('ERR', error.message)
    if (client) client.ws.close()
    process.exit(2)
  }
})()
