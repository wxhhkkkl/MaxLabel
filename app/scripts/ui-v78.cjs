/* B-46/B-61/B-64/B-71：RFID 分区访问控制、字体字段及条码字段命名回归。 */
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
    const pages = await getJson('http://127.0.0.1:' + port + '/json/list')
    const page = pages.find((item) => item.type === 'page')
    if (!page) throw new Error('no main page')
    client = await attach(page.webSocketDebuggerUrl)
    const evaluate = async (expression) => {
      const result = await client.send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true })
      if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description || result.exceptionDetails.text)
      return result.result?.value
    }
    const click = (selector) => evaluate('(() => { const e=document.querySelector(' + JSON.stringify(selector) + '); if(!e || e.disabled)return false; e.click(); return true })()')
    const setValue = (selector, value) => evaluate('(() => { const e=document.querySelector(' + JSON.stringify(selector) + '); if(!e)return false; const proto=e instanceof HTMLSelectElement?HTMLSelectElement.prototype:HTMLInputElement.prototype; const setter=Object.getOwnPropertyDescriptor(proto,"value").set; setter.call(e,' + JSON.stringify(String(value)) + '); e.dispatchEvent(new Event("input",{bubbles:true})); e.dispatchEvent(new Event("change",{bubbles:true})); return true })()')
    const key = (name, options = {}) => evaluate('(() => { const e=new KeyboardEvent("keydown",' + JSON.stringify({ key:name, code:name, bubbles:true, cancelable:true, ...options }) + '); window.dispatchEvent(e); document.dispatchEvent(e); return true })()')
    const waitFor = async (expression, timeout = 2500) => {
      const started = Date.now()
      const probe = expression.trim().startsWith('[') ? '!!document.querySelector(' + JSON.stringify(expression) + ')' : expression
      while (Date.now() - started < timeout) { if (await evaluate(probe)) return true; await sleep(80) }
      return false
    }
    const clickCanvas = (x, y) => evaluate('(() => { const c=document.querySelector("canvas.upper-canvas")||document.querySelector("canvas"); if(!c)return false; const b=c.getBoundingClientRect(); const p={bubbles:true,cancelable:true,view:window,clientX:b.left+' + x + ',clientY:b.top+' + y + ',button:0,buttons:1}; c.dispatchEvent(new MouseEvent("mousedown",p)); c.dispatchEvent(new MouseEvent("mouseup",{...p,buttons:0})); c.dispatchEvent(new MouseEvent("click",{...p,buttons:0})); return true })()')
    const selectType = (type) => evaluate('(() => { const row=[...document.querySelectorAll("[data-testid=layer-object-row]")].find((e)=>e.dataset.objectType===' + JSON.stringify(type) + '); if(!row)return false; if(row.dataset.selected!=="true")row.click(); return true })()')
    const openProps = async (type) => { if(!await selectType(type)) return false; await key('Enter',{altKey:true}); return waitFor('!!document.querySelector("[data-testid=object-props-dialog]")') }
    const closeProps = async () => { await evaluate('document.querySelector("[data-testid=object-props-dialog] button[aria-label]")?.click()'); await sleep(160) }
    // round-139：底排按真机改成 `确定 / 取消 / 帮助`（probe-44），"点最后一个按钮"不再等于确定。
    // 改成按 testid 精确定位确定按钮（比位置更严：按钮缺失即报错，不会静默点错）。
    const confirmProps = async () => {
      const clicked = await evaluate('(() => { const b=document.querySelector("[data-testid=object-props-dialog] [data-testid=object-props-ok]"); if(!b)return false; b.click(); return true })()')
      if (!clicked) throw new Error('object-props-ok button missing')
      await sleep(240)
    }

    await sleep(1500)
    await evaluate('document.querySelector("button[aria-label=关闭]")?.click()')
    await key('n', { ctrlKey: true }); await sleep(300)
    if (await evaluate('!!document.querySelector("[data-testid=template-wizard]")')) { await click('[data-testid=wizard-next]'); await sleep(300) }
    await click('[data-testid=new-label-select]')
    if (!await waitFor('!!document.querySelector("canvas.upper-canvas")')) throw new Error('editor did not open')

    await click('[data-tool=rfid]'); await clickCanvas(240, 170); await sleep(350)
    results['RFID object is available for property editing'] = await waitFor('[data-testid="layer-object-row"][data-object-type="rfid"]')
    results['RFID modal exposes five named access-control groups'] = await openProps('rfid') && await click('[data-testid=object-props-tab-rfid]') && await evaluate('(() => { const d=document.querySelector("[data-testid=object-props-dialog]"); const keys=["epc","user","tid","accessPassword","killPassword"]; return keys.every((key)=>{const e=d?.querySelector("[data-testid=rfid-access-"+key+"]"); return e && e.tagName==="SELECT" && [...e.options].map((o)=>o.value).join(",")==="none,lock,unlock"}) })()')
    results['RFID data type defaults to hexadecimal'] = await evaluate('document.querySelector("[data-testid=rfid-data-type]")?.value === "hex"')
    await setValue('[data-testid=rfid-access-user]', 'lock')
    results['RFID access-control groups remain independent'] = await evaluate('document.querySelector("[data-testid=rfid-access-user]")?.value === "lock" && document.querySelector("[data-testid=rfid-access-epc]")?.value === "none"')
    await click('[data-testid=rfid-random-access]'); await click('[data-testid=rfid-random-kill]')
    results['RFID random access password is eight uppercase hex digits'] = await evaluate('/^[0-9A-F]{8}$/.test(document.querySelector("[data-testid=rfid-access-password]")?.value||"")')
    results['RFID random kill password is eight uppercase hex digits'] = await evaluate('/^[0-9A-F]{8}$/.test(document.querySelector("[data-testid=rfid-kill-password]")?.value||"")')
    await confirmProps()
    results['RFID modal commit keeps the selected access group'] = await openProps('rfid') && await click('[data-testid=object-props-tab-rfid]') && await evaluate('document.querySelector("[data-testid=rfid-access-user]")?.value === "lock"')
    await closeProps()
    results['RFID inline panel mirrors all five groups and random actions'] = await click('[data-testid=property-panel-tab-appearance]') && await evaluate('(() => { const p=document.querySelector("[data-testid=property-panel]"); if(!p)return false; return ["epc","user","tid","accessPassword","killPassword"].every((key)=>!!p.querySelector("[data-testid=rfid-inline-access-"+key+"]")) && !!p.querySelector("[data-testid=rfid-inline-random-access]") && !!p.querySelector("[data-testid=rfid-inline-random-kill]") })()')

    await click('[data-tool=text]'); await clickCanvas(430, 170); await sleep(300)
    results['text font page uses LabelShop font names and field wording'] = await openProps('text') && await click('[data-testid=object-props-tab-font]') && await evaluate('(() => { const d=document.querySelector("[data-testid=object-props-dialog]"); const options=[...d.querySelectorAll("select")].flatMap((s)=>[...s.options].map((o)=>o.value)); return d.innerText.includes("字体宽度方向缩放倍数(H):") && d.innerText.includes("字间距(J):") && d.innerText.includes("特殊效果") && d.innerText.includes("这是TRUETYPE字体，显示与打印完全相同!") && !d.innerText.includes("&") && ["Symbol","楷体","仿宋"].every((name)=>options.includes(name)) })()')
    await closeProps()

    await click('[data-tool=barcode]'); await clickCanvas(620, 170); await sleep(300)
    // 断言迁移（round-126）：这三项的真机位置是「条码」页的 `供人识读字符` 分组，不是「数据源」页。
    // 断言强度不降 —— 除仍要求三项都在之外，还加了分组框与真机加速键原文（`位置(&P):` 等）。
    results['barcode human-readable fields use the real-machine wording on the barcode page'] = await openProps('barcode') && await click('[data-testid=object-props-tab-barcode]') && await evaluate('(() => { const d=document.querySelector("[data-testid=object-props-dialog]"); const t=d.innerText; return t.includes("供人识读字符") && t.includes("位置(P):") && t.includes("垂直偏移(O):") && t.includes("对齐方式(A):") && t.includes("字符模板(T)") })()')
    await closeProps()

    let pass = 0
    for (const [name, value] of Object.entries(results)) { console.log((value ? 'PASS ' : 'FAIL ') + name + ' => ' + value); if (value) pass++ }
    console.log('\n' + pass + '/' + Object.keys(results).length + ' PASS')
    client.ws.close()
    process.exit(pass === Object.keys(results).length ? 0 : 1)
  } catch (error) {
    console.error('ERR', error.message)
    if (client) client.ws.close()
    process.exit(2)
  }
})()
