/* B-15/B-16/B-43：对象把柄缩放、SHIFT 约束、表格合并与直排规则。 */
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
    const clickText = (text) => evaluate(`(() => { const wanted=${JSON.stringify(text)}; const es=[...document.querySelectorAll('button')].filter((e)=>e.offsetParent && (e.textContent||'').trim()===wanted && !e.disabled); if(!es.length)return false; es.at(-1).click(); return true })()`)
    const setValue = (selector, value) => evaluate(`(() => { const e=document.querySelector(${JSON.stringify(selector)}); if(!e)return false; const setter=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set; setter.call(e,${JSON.stringify(String(value))}); e.dispatchEvent(new Event('input',{bubbles:true})); e.dispatchEvent(new Event('change',{bubbles:true})); return true })()`)
    const waitFor = async (expression, timeout = 2500) => {
      const started = Date.now()
      while (Date.now() - started < timeout) { if (await evaluate(expression)) return true; await sleep(80) }
      return false
    }
    const key = (name, options = {}) => evaluate(`(() => { const e=new KeyboardEvent('keydown',${JSON.stringify({ key:name, code:name, bubbles:true, cancelable:true, ...options })}); window.dispatchEvent(e); document.dispatchEvent(e); return e.defaultPrevented })()`)
    const dragCanvas = (x1, y1, x2, y2) => evaluate(`(() => { const c=document.querySelector('canvas.upper-canvas')||document.querySelector('canvas'); if(!c)return false; const b=c.getBoundingClientRect(); const p=(x,y,buttons=1,shiftKey=false)=>({bubbles:true,cancelable:true,view:window,clientX:b.left+x,clientY:b.top+y,button:0,buttons,shiftKey}); c.dispatchEvent(new MouseEvent('mousedown',p(${x1},${y1}))); c.dispatchEvent(new MouseEvent('mousemove',p(${x2},${y2}))); c.dispatchEvent(new MouseEvent('mouseup',{...p(${x2},${y2},0),buttons:0})); return true })()`)
    const rows = () => evaluate(`([...document.querySelectorAll('[data-testid=layer-object-row]')].map((e)=>({id:e.dataset.objectId,type:e.dataset.objectType,x:Number(e.dataset.objectX),y:Number(e.dataset.objectY),w:Number(e.dataset.objectW),h:Number(e.dataset.objectH)})))`)
    const selectType = async (type) => evaluate(`(() => { const row=[...document.querySelectorAll('[data-testid=layer-object-row]')].find((e)=>e.dataset.objectType===${JSON.stringify(type)}); if(!row)return false; if(row.dataset.selected!=='true')row.click(); return true })()`)
    const dragActiveHandle = (corner, dx, dy, shiftKey = false) => evaluate(`(() => {
      const root=document.querySelector('[data-active-fabric-transform]'); const c=document.querySelector('canvas.upper-canvas');
      if(!root || !c)return false;
      const t=JSON.parse(root.getAttribute('data-active-fabric-transform')); const b=c.getBoundingClientRect();
      const zoom=Math.max(.01, Number(t.zoom || b.width / 400)); const w=Math.abs(Number(t.width)*Number(t.scaleX)); const h=Math.abs(Number(t.height)*Number(t.scaleY));
      const cx=t.originX==='center'?Number(t.left):t.originX==='right'?Number(t.left)-w/2:Number(t.left)+w/2;
      const cy=t.originY==='center'?Number(t.top):t.originY==='bottom'?Number(t.top)-h/2:Number(t.top)+h/2;
      const handle=${JSON.stringify(corner)}; const sx=handle==='e'||handle==='ne'||handle==='se'||handle==='br'||handle==='tr'?1:handle==='w'||handle==='nw'||handle==='sw'||handle==='bl'||handle==='tl'?-1:0; const sy=handle==='s'||handle==='sw'||handle==='se'||handle==='br'||handle==='bl'?1:handle==='n'||handle==='nw'||handle==='ne'||handle==='tr'||handle==='tl'?-1:0;
      const start={clientX:b.left+(cx+sx*w/2)*zoom,clientY:b.top+(cy+sy*h/2)*zoom};
      const ev=(type,x,y,buttons)=>new MouseEvent(type,{bubbles:true,cancelable:true,view:window,clientX:x,clientY:y,button:0,buttons,shiftKey:${Boolean(shiftKey)}});
      c.dispatchEvent(ev('mousedown',start.clientX,start.clientY,1)); c.dispatchEvent(ev('mousemove',start.clientX+${dx},start.clientY+${dy},1)); c.dispatchEvent(ev('mouseup',start.clientX+${dx},start.clientY+${dy},0)); return true;
    })()`)
    const closeModal = async (testId) => { await evaluate(`document.querySelector('[data-testid=${JSON.stringify(testId)}] button[aria-label]')?.click()`); await sleep(180) }
    const approx = (a, b, epsilon = 0.011) => Math.abs(a - b) < epsilon
    const onStep = (value) => Math.abs(value * 10 - Math.round(value * 10)) < 0.001

    await sleep(1800)
    await evaluate('document.querySelector("button[aria-label=关闭]")?.click()')
    await key('n', { ctrlKey: true }); await sleep(300)
    if (await evaluate('!!document.querySelector("[data-testid=template-wizard]")')) { await click('[data-testid=wizard-next]'); await sleep(300) }
    await click('[data-testid="new-label-select"]')
    if (!await waitFor('!!document.querySelector("canvas.upper-canvas")')) throw new Error('editor did not open')

    // A barcode is a printer-output object in LabelShop and therefore snaps
    // its dimensions to the tenth-millimetre output step.
    await click('[data-tool="barcode"]'); await dragCanvas(70, 70, 220, 125); await sleep(350)
    if (!await selectType('barcode')) throw new Error('barcode row missing')
    const barcodeBefore = (await rows()).find((item) => item.type === 'barcode')
    if (!barcodeBefore || !await evaluate('!!document.querySelector("[data-active-fabric-transform]")')) throw new Error('barcode selection missing')
    await dragActiveHandle('br', 17, 9); await sleep(350)
    const barcodeAfter = (await rows()).find((item) => item.id === barcodeBefore.id)
    results['B-15 条码把柄缩放按 0.1 毫米步长离散'] = Boolean(barcodeAfter && (barcodeAfter.w > barcodeBefore.w || barcodeAfter.h > barcodeBefore.h) && onStep(barcodeAfter.w) && onStep(barcodeAfter.h))

    // SHIFT on a geometric object's corner makes the two dimensions equal.
    await click('[data-tool="rect"]'); await dragCanvas(300, 90, 390, 135); await sleep(300)
    if (!await selectType('rect')) throw new Error('rect row missing')
    await dragActiveHandle('br', 23, 7, true); await sleep(350)
    const square = (await rows()).find((item) => item.type === 'rect')
    results['B-16 SHIFT 拖动角把柄使矩形成为正方形'] = Boolean(square && approx(square.w, square.h))

    // Text edge and corner handles intentionally differ: the edge stretches
    // one axis, while the corner retains the rendered font ratio.
    await click('[data-tool="text"]'); await dragCanvas(100, 260, 220, 300); await sleep(300)
    await click('[data-tool="select"]')
    if (!await selectType('text')) throw new Error('text row missing')
    const textBefore = (await rows()).find((item) => item.type === 'text')
    await dragActiveHandle('e', 26, 0); await sleep(300)
    const textEdge = (await rows()).find((item) => item.id === textBefore.id)
    const edgeKeepsHeight = Boolean(textEdge && approx(textEdge.h, textBefore.h) && textEdge.w > textBefore.w)
    const edgeRatio = textEdge.w / textEdge.h
    await dragActiveHandle('br', 18, 7); await sleep(300)
    const textCorner = (await rows()).find((item) => item.id === textBefore.id)
    results['B-16 文字中间把柄可长扁、角把柄保持高宽比'] = edgeKeepsHeight && Boolean(textCorner && approx(textCorner.w / textCorner.h, edgeRatio, 0.04))

    // Table properties expose both the documented prohibition and the merge
    // operation; the renderer/print adapters consume the same merges array.
    await click('[data-tool="table"]'); await dragCanvas(260, 360, 420, 470); await sleep(350)
    await click('[data-tool="select"]')
    if (!await selectType('table')) throw new Error('table row missing')
    await evaluate(`(() => { const row=document.querySelector('[data-testid="layer-object-row"][data-object-type="table"]'); const c=document.querySelector('canvas.upper-canvas'); if(!row||!c)return false; const b=c.getBoundingClientRect(); const z=Number(JSON.parse(document.querySelector('[data-active-fabric-transform]')?.getAttribute('data-active-fabric-transform')||'{}').zoom||1); const x=(Number(row.dataset.objectX)+Number(row.dataset.objectW)/2)*10*z; const y=(Number(row.dataset.objectY)+Number(row.dataset.objectH)/2)*10*z; const p={bubbles:true,cancelable:true,view:window,clientX:b.left+x,clientY:b.top+y,button:0,buttons:1}; c.dispatchEvent(new MouseEvent('mousedown',p)); c.dispatchEvent(new MouseEvent('mouseup',{...p,buttons:0})); return true })()`)
    await sleep(180)
    await click('[data-testid="format-props"]'); await sleep(260)
    await click('[data-testid="object-props-tab-table"]'); await sleep(120)
    const tableEditor = '[data-testid="table-property-editor"]'
    const noteBefore = await evaluate(`!!document.querySelector(${JSON.stringify(tableEditor+' [data-testid=table-embedded-object-note]')}) && document.querySelector(${JSON.stringify(tableEditor)})?.innerText.includes('不能直接排入文字、条码')`)
    await setValue('[data-testid="table-merge-end-row"]', 1); await setValue('[data-testid="table-merge-end-col"]', 1); await click('[data-testid="table-merge-apply"]'); await sleep(160)
    const mergeVisible = await evaluate(`document.querySelector(${JSON.stringify(tableEditor)})?.innerText.includes('合并区域：第 1-2 行 × 第 1-2 列')`)
    results['B-43 表格属性提示单元格不可直排文字条码并支持合并'] = noteBefore && mergeVisible
    await clickText('确定'); await sleep(280)
    await closeModal('object-props-dialog')

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
