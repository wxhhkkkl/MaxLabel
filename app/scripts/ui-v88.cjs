/* B-10/B-11/B-12: mouse selection, additive/toggle selection and primary handles. */
const http = require('http')
const WebSocket = require('ws')

function getJson(url) {
  return new Promise((resolve, reject) => {
    http.get(url, (res) => {
      let data = ''
      res.on('data', (chunk) => { data += chunk })
      res.on('end', () => {
        try { resolve(JSON.parse(data)) } catch (error) { reject(error) }
      })
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
    const waitFor = async (expression, timeout = 3000) => {
      const started = Date.now()
      while (Date.now() - started < timeout) {
        if (await evaluate(expression)) return true
        await sleep(80)
      }
      return false
    }
    const dragCanvas = (x1, y1, x2, y2) => evaluate(`(() => {
      const c=document.querySelector('canvas.upper-canvas')||document.querySelector('canvas'); if(!c)return false
      const b=c.getBoundingClientRect(); const p=(x,y,buttons=1)=>({bubbles:true,cancelable:true,view:window,clientX:b.left+x,clientY:b.top+y,button:0,buttons})
      c.dispatchEvent(new MouseEvent('mousedown',p(${x1},${y1}))); c.dispatchEvent(new MouseEvent('mousemove',p(${x2},${y2})))
      c.dispatchEvent(new MouseEvent('mouseup',{...p(${x2},${y2},0),buttons:0})); return true
    })()`)
    const dragWorkspace = (x1, y1, x2, y2) => evaluate(`(() => {
      const v=document.querySelector('[data-testid="workspace-viewport"]'); if(!v)return false
      v.dispatchEvent(new MouseEvent('mousedown',{bubbles:true,cancelable:true,view:window,clientX:${x1},clientY:${y1},button:0,buttons:1}))
      window.dispatchEvent(new MouseEvent('mousemove',{bubbles:true,cancelable:true,view:window,clientX:${x2},clientY:${y2},button:0,buttons:1}))
      window.dispatchEvent(new MouseEvent('mouseup',{bubbles:true,cancelable:true,view:window,clientX:${x2},clientY:${y2},button:0,buttons:0})); return true
    })()`)
    const clickCanvasObject = (row, options = {}) => evaluate(`(() => {
      const c=document.querySelector('canvas.upper-canvas')||document.querySelector('canvas'); if(!c)return false
      const b=c.getBoundingClientRect(); const z=Number(document.querySelector('[data-testid="zoom-level"]')?.value||1)
      const x=b.left+(${Number(row.x)}+${Number(row.w)}/2)*10*z, y=b.top+(${Number(row.y)}+${Number(row.h)}/2)*10*z
      const init={bubbles:true,cancelable:true,view:window,clientX:x,clientY:y,button:0,buttons:1,ctrlKey:${Boolean(options.ctrlKey)},shiftKey:${Boolean(options.shiftKey)}}
      c.dispatchEvent(new MouseEvent('mousedown',init)); c.dispatchEvent(new MouseEvent('mouseup',{...init,buttons:0})); return true
    })()`)
    const rows = () => evaluate(`([...document.querySelectorAll('[data-testid="layer-object-row"][data-object-type="rect"]')].map((e)=>({id:e.dataset.objectId,x:Number(e.dataset.objectX),y:Number(e.dataset.objectY),w:Number(e.dataset.objectW),h:Number(e.dataset.objectH)})).sort((a,b)=>a.x-b.x))`)
    const selection = () => evaluate(`(() => { const root=document.querySelector('[data-active-fabric-selection]'); if(!root)return {ids:[],primaryId:null,cornerColors:[]}; try{return JSON.parse(root.getAttribute('data-active-fabric-selection'))}catch{return {ids:[],primaryId:null,cornerColors:[]}} })()`)

    await sleep(1600)
    await evaluate('document.querySelector("button[aria-label=关闭]")?.click()')
    await evaluate('window.dispatchEvent(new KeyboardEvent("keydown",{key:"n",code:"KeyN",ctrlKey:true,bubbles:true,cancelable:true}))')
    await sleep(350)
    if (await evaluate('!!document.querySelector("[data-testid=template-wizard]")')) await click('[data-testid="wizard-next"]')
    await sleep(350)
    await click('[data-testid="new-label-select"]')
    if (!await waitFor('!!document.querySelector("[data-testid=workspace-viewport]")')) throw new Error('editor did not open')

    await click('[data-tool="rect"]'); await dragCanvas(140, 130, 230, 190); await sleep(250)
    await click('[data-tool="rect"]'); await dragCanvas(300, 130, 390, 190); await sleep(400)
    await click('[data-tool="select"]'); await sleep(180)
    const objects = await rows()
    if (objects.length < 2) throw new Error('two rectangle objects were not created')
    const first = objects[0]
    const second = objects[1]

    await clickCanvasObject(first)
    await sleep(180)
    const one = await selection()
    results['B-10 单击选中单个对象'] = one.ids.length === 1 && one.ids[0] === first.id && await evaluate('!!document.querySelector("[data-active-fabric-transform]")')

    await clickCanvasObject(second, { ctrlKey: true })
    await sleep(180)
    const two = await selection()
    results['B-10 按住 Ctrl 单击追加多个对象'] = two.ids.length === 2 && two.ids[0] === first.id && two.ids[1] === second.id

    results['B-12 多选时首个对象为蓝色主对象'] = two.primaryId === first.id && two.cornerColors[0] === '#1E90FF' && two.cornerColors[1] === '#333333'

    await clickCanvasObject(second, { shiftKey: true })
    await sleep(180)
    const toggled = await selection()
    results['B-11 按住 Shift 单击切换选择'] = toggled.ids.length === 1 && toggled.ids[0] === first.id

    await clickCanvasObject(first, { shiftKey: true })
    await sleep(180)
    const cleared = await selection()
    results['B-11 Shift 单击已选对象可取消选择'] = cleared.ids.length === 0

    const x1 = Math.max(4, first.x * 10 - 24)
    const y1 = Math.max(4, first.y * 10 - 24)
    const x2 = second.x * 10 + second.w * 10 + 24
    const y2 = second.y * 10 + second.h * 10 + 24
    const cb = await evaluate('(()=>document.querySelector("canvas.upper-canvas")?.getBoundingClientRect().toJSON())()')
    await dragWorkspace(cb.left + x1, cb.top + y1, cb.left + x2, cb.top + y2)
    await sleep(300)
    const boxed = await selection()
    results['B-11 在标签空白处拖动可圈选多个对象'] = boxed.ids.length === 2 && boxed.ids.includes(first.id) && boxed.ids.includes(second.id)

    let pass = 0
    for (const [name, value] of Object.entries(results)) {
      console.log((value ? 'PASS ' : 'FAIL ') + name + ' => ' + value)
      if (value) pass++
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
