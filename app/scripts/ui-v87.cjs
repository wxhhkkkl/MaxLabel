/* Round-53 focused parity smoke: DIFF-24's three required CDP assertions. */
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
    const key = (name, options = {}) => evaluate(`(() => { const e=new KeyboardEvent('keydown',${JSON.stringify({ key:name, code:name, bubbles:true, cancelable:true, ...options })}); window.dispatchEvent(e); document.dispatchEvent(e); return e.defaultPrevented })()`)
    const dragCanvas = (x1, y1, x2, y2) => evaluate(`(() => { const c=document.querySelector('canvas.upper-canvas')||document.querySelector('canvas'); if(!c)return false; const b=c.getBoundingClientRect(); const p=(x,y,buttons=1)=>({bubbles:true,cancelable:true,view:window,clientX:b.left+x,clientY:b.top+y,button:0,buttons}); c.dispatchEvent(new MouseEvent('mousedown',p(${x1},${y1}))); c.dispatchEvent(new MouseEvent('mousemove',p(${x2},${y2}))); c.dispatchEvent(new MouseEvent('mouseup',{...p(${x2},${y2},0),buttons:0})); return true })()`)
    const clickCanvas = (x, y, options = {}) => evaluate(`(() => { const c=document.querySelector('canvas.upper-canvas')||document.querySelector('canvas'); if(!c)return false; const b=c.getBoundingClientRect(); const init={bubbles:true,cancelable:true,view:window,clientX:b.left+${x},clientY:b.top+${y},button:0,buttons:1,shiftKey:${Boolean(options.shiftKey)}}; c.dispatchEvent(new MouseEvent('mousedown',init)); c.dispatchEvent(new MouseEvent('mouseup',{...init,buttons:0})); c.dispatchEvent(new MouseEvent('click',{...init,buttons:0})); return true })()`)

    await sleep(1800)
    await evaluate('document.querySelector("button[aria-label=关闭]")?.click()')
    await key('n', { ctrlKey: true }); await sleep(300)
    if (await evaluate('!!document.querySelector("[data-testid=template-wizard]")')) await click('[data-testid=wizard-next]')
    await sleep(300)
    await click('[data-testid="new-label-select"]'); await sleep(500)
    const dbTitles = ['设置数据库', '定位记录', '更新数据库', '第一条记录', '上一条记录', '下一条记录', '最后一条记录']
    results['DIFF-24 未连库时数据库工具栏七键禁用'] = await evaluate(`(() => { const wanted=${JSON.stringify(dbTitles)}; const buttons=[...document.querySelectorAll('button[title]')]; return wanted.every((title)=>buttons.some((e)=>e.title===title && e.disabled)) })()`)
    results['DIFF-24 未选中对象时组合与取消组合禁用'] = await evaluate('document.querySelector("[data-testid=format-bar]")?.querySelector("button[title^=组合]")?.disabled === true && document.querySelector("[data-testid=format-bar]")?.querySelector("button[title=取消组合]")?.disabled === true')

    await click('[data-tool="rect"]'); await dragCanvas(140, 130, 230, 190); await sleep(160)
    await click('[data-tool="rect"]'); await dragCanvas(300, 130, 390, 190); await sleep(220)
    await clickCanvas(185, 160); await clickCanvas(345, 160, { shiftKey: true }); await sleep(220)
    results['DIFF-24 选中两个对象后组合可用'] = await evaluate('document.querySelector("[data-testid=format-bar]")?.querySelector("button[title^=组合]")?.disabled === false')

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
