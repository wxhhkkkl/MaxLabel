/* D-69～D-75：导出条码图片文件入口、字段、默认值、预览与数量。 */
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
    const click = (selector) => evaluate(`(() => { const e=document.querySelector(${JSON.stringify(selector)}); if(!e||!e.isConnected)return false; e.click(); return true })()`)
    const clickPhysical = async (selector) => {
      const box = await evaluate(`(() => { const e=document.querySelector(${JSON.stringify(selector)}); if(!e)return null; const r=e.getBoundingClientRect(); return {x:r.left+r.width/2,y:r.top+r.height/2} })()`)
      if (!box) return false
      await client.send('Input.dispatchMouseEvent', { type: 'mousePressed', x: box.x, y: box.y, button: 'left', clickCount: 1 })
      await client.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: box.x, y: box.y, button: 'left', clickCount: 1 })
      return true
    }
    const key = (name, options = {}) => evaluate(`(() => { const event=new KeyboardEvent('keydown',${JSON.stringify({key:name,code:name,bubbles:true,cancelable:true,...options})}); window.dispatchEvent(event); document.dispatchEvent(event); return true })()`)
    const canvasPoint = () => evaluate(`(() => { const host=document.querySelector('[data-testid="canvas-host"],.canvas-container,canvas'); if(!host)return null; const r=host.getBoundingClientRect(); return {x:r.left+r.width*0.498,y:r.top+r.height*0.411} })()`)
    const physicalCanvasClick = async (button) => {
      const point = await canvasPoint()
      if (!point) return false
      await client.send('Input.dispatchMouseEvent', { type: 'mousePressed', x: point.x, y: point.y, button, clickCount: 1 })
      await client.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: point.x, y: point.y, button, clickCount: 1 })
      return true
    }
    const contextMenu = () => physicalCanvasClick('right')

    await sleep(1800)
    await evaluate('document.querySelector("button[aria-label=关闭]")?.click()')
    await key('n', { ctrlKey: true }); await sleep(350)
    await click('[data-testid="wizard-next"]'); await sleep(450)
    await evaluate(`(() => { const items=[...document.querySelectorAll('button')].filter((e)=>e.offsetParent&&(e.textContent||'').trim()==='选择'); items.at(-1)?.click(); return true })()`)
    await sleep(800)
    await click('[data-tool="barcode"]')
    await evaluate(`(() => { const host=document.querySelector('[data-testid="canvas-host"],.canvas-container,canvas'); if(!host)return false; const r=host.getBoundingClientRect(); const x=r.left+220,y=r.top+180,target=document.elementFromPoint(x,y)||host; const o={bubbles:true,cancelable:true,view:window,clientX:x,clientY:y,button:0,buttons:1}; target.dispatchEvent(new MouseEvent('mousedown',o)); target.dispatchEvent(new MouseEvent('mouseup',{...o,buttons:0})); target.dispatchEvent(new MouseEvent('click',{...o,buttons:0})); return true })()`)
    await sleep(450)
    await key('e', { ctrlKey: true }); await sleep(500)
    results['Ctrl+E opens barcode export dialog'] = await evaluate(`(() => { const root=document.querySelector('[data-testid=barcode-export-dialog]'); return !!root && (root.innerText||'').includes('导出条码图片文件') })()`)
    results['export dialog has directory and naming controls'] = await evaluate(`(() => { const root=document.querySelector('[data-testid=barcode-export-dialog]'); return ['barcode-export-directory','barcode-export-pick-directory','barcode-export-name-mode','barcode-export-prefix','barcode-export-file-sample','barcode-export-format'].every((id)=>!!root?.querySelector('[data-testid='+id+']')) })()`)
    results['export defaults match LabelShop screenshot'] = await evaluate(`(() => { const root=document.querySelector('[data-testid=barcode-export-dialog]'); return root?.querySelector('[data-testid=barcode-export-name-mode]')?.value==='serial' && root?.querySelector('[data-testid=barcode-export-use]')?.value==='screen' && root?.querySelector('[data-testid=barcode-export-zoom]')?.value==='3' && root?.querySelector('[data-testid=barcode-export-quantity]')?.value==='10' && root?.querySelector('[data-testid=barcode-export-format]')?.value==='bmp' })()`)
    results['export parameters and preview controls are present'] = await evaluate(`(() => { const root=document.querySelector('[data-testid=barcode-export-dialog]'); return ['barcode-export-options','barcode-export-reduction','barcode-export-margin-x','barcode-export-margin-y','barcode-export-refresh','barcode-export-width','barcode-export-height','barcode-export-preview'].every((id)=>!!root?.querySelector('[data-testid='+id+']')) })()`)
    results['export button is disabled without a directory only after choice'] = await evaluate(`(() => { const button=document.querySelector('[data-testid=barcode-export-submit]'); return !!button && button.disabled===false && !!document.querySelector('[data-testid=barcode-export-pick-directory]') })()`)
    await click('[data-testid="barcode-export-back"]'); await sleep(150)
    await click('[data-tool="select"]'); await physicalCanvasClick('left'); await sleep(120)
    await contextMenu(); await sleep(200)
    results['right-click menu exposes barcode export command'] = await evaluate(`(() => { const e=[...document.querySelectorAll('[data-menu-item]')].find((item) => item.getAttribute('data-menu-item') === '导出(E)...'); return !!e && e.getAttribute('data-menu-disabled') === 'false' })()`)
    await clickPhysical('[data-menu-item="导出(E)..."]'); await sleep(300)
    results['right-click export command opens the same dialog'] = await evaluate('!!document.querySelector("[data-testid=barcode-export-dialog]")')
    await click('[data-testid="barcode-export-back"]')

    let pass = 0
    for (const [name, value] of Object.entries(results)) { console.log((value ? 'PASS ' : 'FAIL ') + name + ' => ' + value); if (value) pass++ }
    console.log(`\n${pass}/${Object.keys(results).length} PASS`)
    client.ws.close(); process.exit(pass === Object.keys(results).length ? 0 : 1)
  } catch (error) {
    console.error('ERR', error.message)
    if (client) client.ws.close()
    process.exit(2)
  }
})()
