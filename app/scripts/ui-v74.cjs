/* DIFF-24/25/26：工具栏禁用规则、颜色索引表格、自动旋转输出选项。 */
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
    const clickText = (text) => evaluate(`(() => { const wanted=${JSON.stringify(text)}; const es=[...document.querySelectorAll('button')].filter((e)=>e.offsetParent && (e.textContent||'').trim()===wanted); if(!es.length)return false; es.at(-1).click(); return true })()`)
    const setValue = (selector, value) => evaluate(`(() => { const e=document.querySelector(${JSON.stringify(selector)}); if(!e)return false; const proto=e instanceof HTMLSelectElement?HTMLSelectElement.prototype:HTMLInputElement.prototype; const setter=Object.getOwnPropertyDescriptor(proto,'value').set; setter.call(e,${JSON.stringify(String(value))}); e.dispatchEvent(new Event('input',{bubbles:true})); e.dispatchEvent(new Event('change',{bubbles:true})); return true })()`)
    const waitFor = async (expression, timeout = 2500) => {
      const started = Date.now()
      while (Date.now() - started < timeout) { if (await evaluate(expression)) return true; await sleep(80) }
      return false
    }
    const key = (name, options = {}) => evaluate(`(() => { const e=new KeyboardEvent('keydown',${JSON.stringify({ key:name, code:name, bubbles:true, cancelable:true, ...options })}); window.dispatchEvent(e); document.dispatchEvent(e); return e.defaultPrevented })()`)
    const dragCanvas = (x1, y1, x2, y2) => evaluate(`(() => { const c=document.querySelector('canvas.upper-canvas')||document.querySelector('canvas'); if(!c)return false; const b=c.getBoundingClientRect(); const p=(x,y,buttons=1)=>({bubbles:true,cancelable:true,view:window,clientX:b.left+x,clientY:b.top+y,button:0,buttons}); c.dispatchEvent(new MouseEvent('mousedown',p(${x1},${y1}))); c.dispatchEvent(new MouseEvent('mousemove',p(${x2},${y2}))); c.dispatchEvent(new MouseEvent('mouseup',{...p(${x2},${y2},0),buttons:0})); return true })()`)
    const clickCanvas = (x, y, options = {}) => evaluate(`(() => { const c=document.querySelector('canvas.upper-canvas')||document.querySelector('canvas'); if(!c)return false; const b=c.getBoundingClientRect(); const init={bubbles:true,cancelable:true,view:window,clientX:b.left+${x},clientY:b.top+${y},button:0,buttons:1,shiftKey:${Boolean(options.shiftKey)}}; c.dispatchEvent(new MouseEvent('mousedown',init)); c.dispatchEvent(new MouseEvent('mouseup',{...init,buttons:0})); c.dispatchEvent(new MouseEvent('click',{...init,buttons:0})); return true })()`)
    const closeModal = async (testId) => { await evaluate(`document.querySelector('[data-testid="${testId}"] button[aria-label]')?.click()`); await sleep(180) }

    await sleep(1800)
    await evaluate('document.querySelector("button[aria-label=关闭]")?.click()')
    await key('n', { ctrlKey: true }); await sleep(300)
    if (await evaluate('!!document.querySelector("[data-testid=template-wizard]")')) { await click('[data-testid=wizard-next]'); await sleep(300) }
    await click('[data-testid="new-label-select"]')
    if (!await waitFor('!!document.querySelector("canvas.upper-canvas")')) throw new Error('editor did not open')

    const dbTitles = ['设置数据库', '定位记录', '更新数据库', '第一条记录', '上一条记录', '下一条记录', '最后一条记录']
    results['未连库时数据库工具栏七键禁用'] = await evaluate(`(() => { const wanted=${JSON.stringify(dbTitles)}; const buttons=[...document.querySelectorAll('button[title]')]; return wanted.every((title)=>buttons.some((e)=>e.title===title && e.disabled)) })()`)
    results['未选中对象时组合与取消组合禁用'] = await evaluate('document.querySelector("[data-testid=format-bar]")?.querySelector("button[title^=组合]")?.disabled === true && document.querySelector("[data-testid=format-bar]")?.querySelector("button[title=取消组合]")?.disabled === true')

    await click('[data-tool="rect"]'); await dragCanvas(150, 140, 250, 210); await sleep(250)
    await click('[data-tool="rect"]'); await dragCanvas(330, 140, 430, 210); await sleep(350)
    await clickCanvas(200, 175); await clickCanvas(380, 175, { shiftKey: true }); await sleep(250)
    results['选中两个对象后组合可用'] = await evaluate('document.querySelector("[data-testid=format-bar]")?.querySelector("button[title^=组合]")?.disabled === false')
    await evaluate('document.querySelector("[data-testid=format-bar]")?.querySelector("button[title^=组合]")?.click()')
    await sleep(350)
    results['组合后取消组合可用'] = await evaluate('document.querySelector("[data-testid=format-bar]")?.querySelector("button[title=取消组合]")?.disabled === false')
    await evaluate('document.querySelector("[data-testid=format-bar]")?.querySelector("button[title=取消组合]")?.click()')
    await sleep(300)

    const optionTitleClicked = await click('[data-menu-title="选项(O)"]'); await sleep(100); const optionItemClicked = await click('[data-menu-item="系统选项(C)..."]'); await sleep(250)
    results['系统选项存在自动旋转输出页面且默认关闭'] = await evaluate('!!document.querySelector("[data-testid=auto-rotate-output-page]") && document.querySelector("[data-testid=auto-rotate-output-page]")?.checked === false && document.querySelector("[data-testid=options-dialog]")?.innerText.includes("自动旋转输出页面")')
    await click('[data-testid="auto-rotate-output-page"]'); await clickText('保存'); await sleep(150); await clickText('取消'); await sleep(150)
    await click('[data-menu-title="选项(O)"]'); await sleep(80); await click('[data-menu-item="系统选项(C)..."]'); await sleep(180)
    results['自动旋转输出页面保存后仍保持开启'] = await evaluate('document.querySelector("[data-testid=auto-rotate-output-page]")?.checked === true')
    await evaluate('(() => { const d=document.querySelector("[data-testid=options-dialog]"); const b=[...(d?.querySelectorAll("button") || [])].find((e)=>e.textContent.trim()==="取消"); b?.click(); return !!b })()'); await sleep(180)

    const rectRow = await evaluate(`(() => { const row=[...document.querySelectorAll('[data-testid=layer-object-row]')].find((e)=>e.getAttribute('data-object-type')==='rect'); row?.click(); return !!row })()`)
    if (!rectRow) throw new Error('rect layer row missing after ungroup')
    await key('Enter', { altKey: true }); await sleep(220)
    await setValue('[data-testid="object-props-dialog"] [data-testid="color-change-mode"]', 'index'); await sleep(180)
    results['颜色索引表格包含四列与增删行'] = await evaluate(`(() => { const table=document.querySelector('[data-testid=color-index-table]'); const heads=[...table?.querySelectorAll('th')||[]].map((e)=>e.textContent.trim()); return JSON.stringify(heads.slice(0,4))===JSON.stringify(['颜色索引','颜色','RGB颜色值','十六进制']) && !!table?.querySelector('[data-testid=color-index-private-add]') })()`)
    await click('[data-testid="color-index-private-add"]'); await sleep(100)
    results['颜色索引表同时支持颜色名与十六进制'] = await setValue('[data-testid="color-index-private-value-0"]', 'red') && await evaluate('document.querySelector("[data-testid=color-index-private-row-0]")?.innerText.includes("rgb(255, 0, 0)")') && await setValue('[data-testid="color-index-private-value-0"]', '#00FF80') && await evaluate('document.querySelector("[data-testid=color-index-private-row-0]")?.innerText.includes("#00FF80")')
    results['颜色索引表可删除行'] = await click('[data-testid="color-index-private-remove-0"]') && await evaluate('!document.querySelector("[data-testid=color-index-private-row-0]")')
    await setValue('[data-testid="color-index-source"]', 'shared'); await sleep(150)
    results['颜色索引表公共表同样可编辑'] = await click('[data-testid="color-index-shared-add"]') && await setValue('[data-testid="color-index-shared-value-0"]', 'blue') && await evaluate('document.querySelector("[data-testid=color-index-shared-row-0]")?.innerText.includes("rgb(0, 0, 255)")')
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
