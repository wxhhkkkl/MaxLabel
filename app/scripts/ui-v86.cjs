/* A-31/A-248~A-252: space+wheel zoom and Tools-menu zoom commands. */
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
    const setZoom = (value) => evaluate(`(() => { const e=document.querySelector('[data-testid="zoom-level"]'); if(!e)return false; const setter=Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype,'value').set; setter.call(e,${JSON.stringify(String(value))}); e.dispatchEvent(new Event('change',{bubbles:true})); return true })()`)
    const clickToolsItem = (label) => click(`[data-menu-item=${JSON.stringify(label)}]`)

    await sleep(1600)
    await evaluate('document.querySelector("button[aria-label=关闭]")?.click()')
    await evaluate('window.dispatchEvent(new KeyboardEvent("keydown",{key:"n",code:"KeyN",ctrlKey:true,bubbles:true,cancelable:true}))')
    await sleep(300)
    if (await evaluate('!!document.querySelector("[data-testid=template-wizard]")')) await click('[data-testid=wizard-next]')
    await sleep(300)
    await click('[data-testid="new-label-select"]')
    if (!await waitFor('!!document.querySelector("[data-testid=workspace-viewport]")')) throw new Error('editor did not open')
    await setZoom(1)
    await sleep(180)

    const before = await evaluate('Number(document.querySelector("[data-testid=zoom-level]")?.value)')
    await evaluate(`(() => { const e=new KeyboardEvent('keydown',{key:' ',code:'Space',bubbles:true,cancelable:true}); window.dispatchEvent(e); const v=document.querySelector('[data-testid="workspace-viewport"]'); if(!v)return false; v.dispatchEvent(new WheelEvent('wheel',{bubbles:true,cancelable:true,deltaY:-100,deltaMode:0,ctrlKey:false})); window.dispatchEvent(new KeyboardEvent('keyup',{key:' ',code:'Space',bubbles:true})); return true })()`)
    await sleep(220)
    const after = await evaluate('Number(document.querySelector("[data-testid=zoom-level]")?.value)')
    results['A-31 空格加滚轮改变缩放比例'] = Number.isFinite(before) && Number.isFinite(after) && after > before && await evaluate('document.querySelector("[data-testid=zoom-control]")?.getAttribute("data-zoom-mode") === "manual"')

    const toolMenu = '[data-menu-title="工具(T)"]'
    results['A-248 工具菜单放大与快捷缩放回调一致'] = await click(toolMenu) && await clickToolsItem('放大(I)') && await waitFor('Number(document.querySelector("[data-testid=zoom-level]")?.value) > 1.4')
    results['A-249 工具菜单缩小与快捷缩放回调一致'] = await click(toolMenu) && await clickToolsItem('缩小(O)') && await waitFor('Number(document.querySelector("[data-testid=zoom-level]")?.value) === 1.5')
    results['A-250 工具菜单适应宽度进入宽度适应模式'] = await click(toolMenu) && await clickToolsItem('适应宽度') && await waitFor('document.querySelector("[data-testid=zoom-control]")?.getAttribute("data-zoom-mode") === "w"')
    results['A-251 工具菜单适应高度进入高度适应模式'] = await click(toolMenu) && await clickToolsItem('适应高度') && await waitFor('document.querySelector("[data-testid=zoom-control]")?.getAttribute("data-zoom-mode") === "h"')
    results['A-252 工具菜单适合窗口进入窗口适应模式'] = await click(toolMenu) && await clickToolsItem('适合窗口(W)') && await waitFor('document.querySelector("[data-testid=zoom-control]")?.getAttribute("data-zoom-mode") === "win"')

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
