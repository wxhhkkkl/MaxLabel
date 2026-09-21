/* Round-49 focused parity smoke: DIFF-24/25/26. */
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
    const clickText = (text) => evaluate(`(() => { const wanted=${JSON.stringify(text)}; const es=[...document.querySelectorAll('button')].filter((e)=>e.offsetParent && (e.textContent||'').trim()===wanted); if(!es.length)return false; es.at(-1).click(); return true })()`)
    const setValue = (selector, value) => evaluate(`(() => { const e=document.querySelector(${JSON.stringify(selector)}); if(!e)return false; const proto=e instanceof HTMLSelectElement?HTMLSelectElement.prototype:HTMLInputElement.prototype; const setter=Object.getOwnPropertyDescriptor(proto,'value').set; setter.call(e,${JSON.stringify(String(value))}); e.dispatchEvent(new Event('input',{bubbles:true})); e.dispatchEvent(new Event('change',{bubbles:true})); return true })()`)
    const waitFor = async (expression, timeout = 2500) => {
      const started = Date.now()
      while (Date.now() - started < timeout) {
        if (await evaluate(expression)) return true
        await sleep(80)
      }
      return false
    }
    const key = (name, options = {}) => evaluate(`(() => { const e=new KeyboardEvent('keydown',${JSON.stringify({ key:name, code:name, bubbles:true, cancelable:true, ...options })}); window.dispatchEvent(e); document.dispatchEvent(e); return e.defaultPrevented })()`)
    const dragCanvas = (x1, y1, x2, y2) => evaluate(`(() => { const c=document.querySelector('canvas.upper-canvas')||document.querySelector('canvas'); if(!c)return false; const b=c.getBoundingClientRect(); const p=(x,y,buttons=1)=>({bubbles:true,cancelable:true,view:window,clientX:b.left+x,clientY:b.top+y,button:0,buttons}); c.dispatchEvent(new MouseEvent('mousedown',p(${x1},${y1}))); c.dispatchEvent(new MouseEvent('mousemove',p(${x2},${y2}))); c.dispatchEvent(new MouseEvent('mouseup',{...p(${x2},${y2},0),buttons:0})); return true })()`)
    const clickCanvas = (x, y, options = {}) => evaluate(`(() => { const c=document.querySelector('canvas.upper-canvas')||document.querySelector('canvas'); if(!c)return false; const b=c.getBoundingClientRect(); const init={bubbles:true,cancelable:true,view:window,clientX:b.left+${x},clientY:b.top+${y},button:0,buttons:1,shiftKey:${Boolean(options.shiftKey)}}; c.dispatchEvent(new MouseEvent('mousedown',init)); c.dispatchEvent(new MouseEvent('mouseup',{...init,buttons:0})); c.dispatchEvent(new MouseEvent('click',{...init,buttons:0})); return true })()`)

    await sleep(1800)
    await evaluate('document.querySelector("button[aria-label=关闭]")?.click()')
    await key('n', { ctrlKey: true }); await sleep(300)
    if (await evaluate('!!document.querySelector("[data-testid=template-wizard]")')) { await click('[data-testid=wizard-next]'); await sleep(300) }
    await click('[data-testid="new-label-select"]')
    if (!await waitFor('!!document.querySelector("canvas.upper-canvas")')) throw new Error('editor did not open')

    const dbTitles = ['设置数据库', '定位记录', '更新数据库', '第一条记录', '上一条记录', '下一条记录', '最后一条记录']
    results['DIFF-24 未连库数据库七键全部禁用'] = await evaluate(`(() => { const wanted=${JSON.stringify(dbTitles)}; const buttons=[...document.querySelectorAll('button[title]')]; return wanted.every((title)=>buttons.some((e)=>e.title===title && e.disabled)) })()`)
    results['DIFF-24 未选中时组合与取消组合均禁用'] = await evaluate('document.querySelector("[data-testid=format-bar]")?.querySelector("button[title^=组合]")?.disabled === true && document.querySelector("[data-testid=format-bar]")?.querySelector("button[title=取消组合]")?.disabled === true')

    await click('[data-tool="rect"]'); await dragCanvas(140, 130, 230, 190); await sleep(180)
    await click('[data-tool="rect"]'); await dragCanvas(300, 130, 390, 190); await sleep(250)
    await clickCanvas(185, 160); await sleep(100)
    await key('Enter', { altKey: true }); await sleep(220)
    await setValue('[data-testid="color-change-mode"]', 'index'); await sleep(120)
    results['DIFF-25 颜色索引表为四列并支持增删编辑'] = await evaluate(`(() => { const table=document.querySelector('[data-testid=color-index-table]'); const heads=[...table?.querySelectorAll('th')||[]].map((e)=>e.textContent.trim()); return JSON.stringify(heads.slice(0,4))===JSON.stringify(['颜色索引','颜色','RGB颜色值','十六进制']) && !!table?.querySelector('[data-testid=color-index-private-add]') })()`)
    await click('[data-testid="color-index-private-add"]'); await sleep(80)
    results['DIFF-25 颜色名与十六进制均解析'] = await setValue('[data-testid="color-index-private-value-0"]', 'red') && await evaluate('document.querySelector("[data-testid=color-index-private-row-0]")?.innerText.includes("rgb(255, 0, 0)")') && await setValue('[data-testid="color-index-private-value-0"]', '#00FF80') && await evaluate('document.querySelector("[data-testid=color-index-private-row-0]")?.innerText.includes("#00FF80")')
    await click('[data-testid="color-index-private-remove-0"]'); await sleep(80)
    results['DIFF-25 颜色索引行可删除'] = await evaluate('!document.querySelector("[data-testid=color-index-private-row-0]")')
    await evaluate('document.querySelector("[data-testid=object-props-dialog] button[aria-label]")?.click()'); await sleep(120)

    await click('[data-menu-title="选项(O)"]'); await sleep(80); await click('[data-menu-item="系统选项(C)..."]'); await sleep(180)
    results['DIFF-26 系统选项存在自动旋转且默认关闭'] = await evaluate('!!document.querySelector("[data-testid=auto-rotate-output-page]") && document.querySelector("[data-testid=auto-rotate-output-page]")?.checked === false')
    await click('[data-testid="auto-rotate-output-page"]'); await clickText('确定'); await sleep(120); await clickText('取消'); await sleep(120)
    await click('[data-menu-title="选项(O)"]'); await sleep(80); await click('[data-menu-item="系统选项(C)..."]'); await sleep(180)
    results['DIFF-26 自动旋转开关保存后保持开启'] = await evaluate('document.querySelector("[data-testid=auto-rotate-output-page]")?.checked === true')

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
