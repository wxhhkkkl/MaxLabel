/* B-01/B-04/B-06/B-07/B-33/B-39/B-108/B-110/B-111/B-112: editor object property parity smoke. */
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
      if (result.exceptionDetails) throw new Error((result.exceptionDetails.exception?.description || result.exceptionDetails.text) + `\nEXPR: ${expression}`)
      return result.result?.value
    }
    const click = (selector) => evaluate(`(() => { const e=document.querySelector(${JSON.stringify(selector)}); if(!e || e.disabled)return false; e.click(); return true })()`)
    const key = (name, options = {}) => evaluate(`(() => { const e=new KeyboardEvent('keydown',${JSON.stringify({ key: name, code: name, bubbles: true, cancelable: true, ...options })}); window.dispatchEvent(e); document.dispatchEvent(e); return true })()`)
    const waitFor = async (expression, timeout = 2500) => {
      const started = Date.now()
      const probe = expression.trim().startsWith('[')
        ? `!!document.querySelector(${JSON.stringify(expression)})`
        : expression
      while (Date.now() - started < timeout) {
        if (await evaluate(probe)) return true
        await sleep(80)
      }
      return false
    }
    const setValue = (selector, value) => evaluate(`(() => {
      const e=document.querySelector(${JSON.stringify(selector)}); if(!e)return false
      const proto=e instanceof HTMLSelectElement?HTMLSelectElement.prototype:HTMLInputElement.prototype
      const setter=Object.getOwnPropertyDescriptor(proto,'value').set
      setter.call(e,${JSON.stringify(String(value))})
      e.dispatchEvent(new Event('input',{bubbles:true})); e.dispatchEvent(new Event('change',{bubbles:true})); return true
    })()`)
    const closeProps = async () => {
      await evaluate(`document.querySelector('[data-testid="object-props-dialog"] button[aria-label]')?.click()`)
      await sleep(160)
    }
    const canvasPoint = (x, y) => evaluate(`(() => {
      const canvas=document.querySelector('canvas.upper-canvas') || document.querySelector('canvas');
      if(!canvas)return false; const b=canvas.getBoundingClientRect(); return { canvas, x:b.left+${x}, y:b.top+${y} }
    })()`)
    const clickCanvas = async (x, y) => evaluate(`(() => {
      const canvas=document.querySelector('canvas.upper-canvas') || document.querySelector('canvas'); if(!canvas)return false
      const b=canvas.getBoundingClientRect(); const clientX=b.left+${x}, clientY=b.top+${y}
      const init={bubbles:true,cancelable:true,view:window,clientX,clientY,button:0,buttons:1}
      canvas.dispatchEvent(new MouseEvent('mousedown',init)); canvas.dispatchEvent(new MouseEvent('mouseup',{...init,buttons:0})); canvas.dispatchEvent(new MouseEvent('click',{...init,buttons:0})); return true
    })()`)
    const dragCanvas = (x1, y1, x2, y2) => evaluate(`(() => {
      const canvas=document.querySelector('canvas.upper-canvas') || document.querySelector('canvas'); if(!canvas)return false
      const b=canvas.getBoundingClientRect(); const p=(x,y)=>({bubbles:true,cancelable:true,view:window,clientX:b.left+x,clientY:b.top+y,button:0,buttons:1})
      canvas.dispatchEvent(new MouseEvent('mousedown',p(${x1},${y1})))
      canvas.dispatchEvent(new MouseEvent('mousemove',p(${x2},${y2})))
      canvas.dispatchEvent(new MouseEvent('mouseup',{...p(${x2},${y2}),buttons:0})); return true
    })()`)
    const selectType = (type) => evaluate(`(() => {
      const row=[...document.querySelectorAll('[data-testid="layer-object-row"]')].find((e)=>e.getAttribute('data-object-type')===${JSON.stringify(type)})
      if(!row)return false; if(row.getAttribute('data-selected')!=='true')row.click(); return true
    })()`)
    const openProps = async (type) => {
      if (!await selectType(type)) return false
      await key('Enter', { altKey: true })
      return waitFor('!!document.querySelector("[data-testid=object-props-dialog]")')
    }
    // 真机取证（PROBE-verifier-object-tabs.md）：矩形/椭圆/直线统一叫「图形」，公共页叫「常规」且在最后
    const tabsOf = () => evaluate(`([...document.querySelectorAll('[data-testid="object-props-dialog"] [data-testid^="object-props-tab-"]')].map((e)=>(e.textContent||'').trim()))`)
    const confirmProps = async () => {
      await evaluate(`(() => { const d=document.querySelector('[data-testid="object-props-dialog"]'); const b=d&&[...d.querySelectorAll('button')].at(-1); b?.click(); return !!b })()`)
      await sleep(240)
    }

    await sleep(1500)
    await evaluate('document.querySelector("button[aria-label=关闭]")?.click()')
    await key('n', { ctrlKey: true }); await sleep(280)
    if (await evaluate('!!document.querySelector("[data-testid=template-wizard]")')) {
      await click('[data-testid="wizard-next"]'); await sleep(300)
    }
    await click('[data-testid="new-label-select"]')
    if (!await waitFor('!!document.querySelector("canvas")')) throw new Error('editor did not open')

    const tools = await evaluate('[...document.querySelectorAll("[data-tool]")].map((e)=>e.getAttribute("data-tool"))')
    results['toolbar object tools match LabelShop set'] = JSON.stringify(tools) === JSON.stringify(['select','barcode','text','line','diagonal','rect','image','table','rfid','data'])

    await click('[data-tool="rect"]'); await dragCanvas(180, 150, 340, 240); await sleep(350)
    results['drag creates a graphic object with a selection row'] = await waitFor('[data-testid="layer-object-row"][data-object-type="rect"]')
    results['graphic handles are represented by the selected row'] = await evaluate('!!document.querySelector("[data-testid=layer-object-row][data-object-type=rect][data-selected=true]")')
    results['graphic modal exposes unified shape fields'] = await openProps('rect') && await click('[data-testid="object-props-tab-shape"]') && await evaluate('!!document.querySelector("[data-testid=shape-kind]") && !!document.querySelector("[data-testid=shape-fill-enabled]")')
    results['矩形属性页签按真机 = 图形 / 常规'] = JSON.stringify(await tabsOf()) === JSON.stringify(['图形', '常规'])
    await setValue('[data-testid="shape-kind"]', 'roundRect'); await sleep(80)
    results['round rectangle exposes corner radius'] = await evaluate('!!document.querySelector("[data-testid=shape-corner-radius]")')
    await setValue('[data-testid="shape-kind"]', 'ellipse'); await confirmProps()
    results['ellipse shape is materialized by the visible renderer'] = await waitFor('document.querySelector("[data-rendered-object-types]")?.getAttribute("data-rendered-object-types")?.includes("ellipse")')

    await click('[data-tool="rfid"]'); await clickCanvas(470, 320); await sleep(350)
    results['RFID click creates an object'] = await waitFor('[data-testid="layer-object-row"][data-object-type="rfid"]')
    results['RFID access page has five independent controls'] = await openProps('rfid') && await click('[data-testid="object-props-tab-rfid"]') && await evaluate('[...document.querySelectorAll("[data-testid^=rfid-access-]")].filter((e)=>e.tagName==="SELECT").length===5')
    await click('[data-testid="rfid-random-access"]')
    results['RFID random access password is eight uppercase hex digits'] = await evaluate('/^[0-9A-F]{8}$/.test(document.querySelector("[data-testid=rfid-access-password]")?.value||"")')
    await closeProps()

    await click('[data-tool="text"]'); await clickCanvas(610, 150); await sleep(350)
    results['text click creates an object'] = await waitFor('[data-testid="layer-object-row"][data-object-type="text"]')
    results['text page exposes line width'] = await openProps('text') && await click('[data-testid="object-props-tab-text"]') && await evaluate('!!document.querySelector("[data-testid=text-line-width]")')
    await evaluate(`(() => { const s=[...document.querySelectorAll('[data-testid="object-props-dialog"] select')].find((e)=>[...e.options].some((o)=>o.value==='multi')); if(!s)return false; const setter=Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype,'value').set; setter.call(s,'multi'); s.dispatchEvent(new Event('change',{bubbles:true})); return true })()`)
    results['multi-line text exposes millimetre line spacing'] = await waitFor('!!document.querySelector("[data-testid=text-line-spacing]")')
    await closeProps()

    await click('[data-tool="line"]'); await dragCanvas(740, 300, 900, 300); await sleep(350)
    results['line drag creates a line object'] = await waitFor('[data-testid="layer-object-row"][data-object-type="line"]')
    results['line page uses the unified line and diagonal wording'] = await openProps('line') && await click('[data-testid="object-props-tab-shape"]') && await evaluate('document.querySelector("[data-testid=object-props-dialog]")?.innerText.includes("长度") && document.querySelector("[data-testid=object-props-dialog]")?.innerText.includes("线宽") && document.querySelector("[data-testid=object-props-dialog]")?.innerText.includes("线条色")')
    // 真机没有「直线和斜线」页签 —— 直线/斜线与矩形同属「图形」页
    results['直线属性页签按真机 = 图形 / 常规'] = JSON.stringify(await tabsOf()) === JSON.stringify(['图形', '常规'])
    await closeProps()

    await click('[data-tool="barcode"]'); await clickCanvas(430, 160); await sleep(350)
    results['barcode click creates an object'] = await waitFor('[data-testid="layer-object-row"][data-object-type="barcode"]')
    // 断言迁移（round-126）：真机「数据源」页**没有**供人识读字符的四项，它们在「条码」页的
    // `供人识读字符` 分组里（probe-60-barcode-props-tree.txt）。原断言查数据源页 -> 现查条码页，强度不降。
    results['barcode page uses human-readable character wording'] = await openProps('barcode') && await click('[data-testid="object-props-tab-barcode"]') && await evaluate('document.querySelector("[data-testid=object-props-dialog]")?.innerText.includes("供人识读字符")')
    results['barcode data page no longer duplicates the human-readable fields'] = await click('[data-testid="object-props-tab-datasource"]') && await evaluate('!document.querySelector("[data-testid=object-props-dialog]")?.innerText.includes("供人识读的字符")')
    await closeProps()

    await click('[data-tool="image"]'); await dragCanvas(470, 420, 650, 520); await sleep(500)
    results['image drag creates a placeholder image frame'] = await waitFor('[data-testid="layer-object-row"][data-object-type="image"]')
    results['image page exposes fit, aspect, percentage and nine-way alignment'] = await openProps('image') && await click('[data-testid="object-props-tab-image"]') && await evaluate(`(() => {
      const fit=document.querySelector('[data-testid=image-fit]'); const align=document.querySelector('[data-testid=image-align]')
      return [...(fit?.options||[])].map((e)=>e.value).join(',')==='original,scale,fit,fitBox' && !!document.querySelector('[data-testid=image-keep-aspect]') && !!document.querySelector('[data-testid=image-width-percent]') && !!document.querySelector('[data-testid=image-height-percent]') && (align?.options.length===9)
    })()`)
    await closeProps()

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
