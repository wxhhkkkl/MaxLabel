/* B-65/B-66/B-67：文字类型、行宽度/行距与圆形文字参数回归。 */
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
    const key = (name, options = {}) => evaluate(`(() => { const e=new KeyboardEvent('keydown',${JSON.stringify({ key: name, code: name, bubbles: true, cancelable: true, ...options })}); window.dispatchEvent(e); document.dispatchEvent(e); return true })()`)
    const waitFor = async (expression, timeout = 2500) => {
      const started = Date.now()
      while (Date.now() - started < timeout) { if (await evaluate(expression)) return true; await sleep(80) }
      return false
    }
    const setValue = (selector, value) => evaluate(`(() => {
      const e=document.querySelector(${JSON.stringify(selector)}); if(!e)return false
      const proto=e instanceof HTMLSelectElement?HTMLSelectElement.prototype:HTMLInputElement.prototype
      const setter=Object.getOwnPropertyDescriptor(proto,'value').set
      setter.call(e,${JSON.stringify(String(value))})
      e.dispatchEvent(new Event('input',{bubbles:true})); e.dispatchEvent(new Event('change',{bubbles:true})); return true
    })()`)
    const clickCanvas = (x, y) => evaluate(`(() => {
      const c=document.querySelector('canvas.upper-canvas')||document.querySelector('canvas'); if(!c)return false
      const b=c.getBoundingClientRect(); const p={bubbles:true,cancelable:true,view:window,clientX:b.left+${x},clientY:b.top+${y},button:0,buttons:1}
      c.dispatchEvent(new MouseEvent('mousedown',p)); c.dispatchEvent(new MouseEvent('mouseup',{...p,buttons:0})); c.dispatchEvent(new MouseEvent('click',{...p,buttons:0})); return true
    })()`)
    const selectText = () => evaluate(`(() => {
      const row=document.querySelector('[data-testid="layer-object-row"][data-object-type="text"]')
      if(!row)return false; if(row.dataset.selected!=='true')row.click(); return true
    })()`)
    const openTextProps = async () => { if (!await selectText()) return false; await key('Enter', { altKey: true }); return waitFor('!!document.querySelector("[data-testid=object-props-dialog]")') }
    // round-139：底排按真机改成 `确定 / 取消 / 帮助`（probe-44），"点最后一个按钮"不再等于确定。
    // 改成按 testid 精确定位确定按钮（比位置更严：按钮缺失即报错，不会静默点错）。
    const confirmProps = async () => {
      const clicked = await evaluate(`(() => { const b=document.querySelector('[data-testid="object-props-dialog"] [data-testid="object-props-ok"]'); if(!b)return false; b.click(); return true })()`)
      if (!clicked) throw new Error('object-props-ok button missing')
      await sleep(240)
    }

    await sleep(1500)
    await evaluate('document.querySelector("button[aria-label=关闭]")?.click()')
    await key('n', { ctrlKey: true }); await sleep(300)
    if (await evaluate('!!document.querySelector("[data-testid=template-wizard]")')) { await click('[data-testid=wizard-next]'); await sleep(300) }
    await click('[data-testid=new-label-select]')
    if (!await waitFor('!!document.querySelector("canvas.upper-canvas")')) throw new Error('editor did not open')

    await click('[data-tool="text"]'); await clickCanvas(360, 180); await sleep(350)
    if (!await waitFor('!!document.querySelector("[data-testid=layer-object-row][data-object-type=text]")')) throw new Error('text row missing')
    if (!await openTextProps()) throw new Error('text props did not open')
    await click('[data-testid="object-props-tab-text"]'); await sleep(100)

    const typeState = await evaluate(`(() => {
      const s=document.querySelector('[data-testid="text-type"]');
      return { value:s?.value, options:[...(s?.options||[])].map((o)=>o.value), labels:[...(s?.options||[])].map((o)=>o.textContent.trim()), text:document.querySelector('[data-testid="object-props-dialog"]')?.innerText||'' }
    })()`)
    results['B-65 文字类型默认单行且仅有单行/多行/圆形'] = Boolean(typeState && typeState.value === 'single' && JSON.stringify(typeState.options) === JSON.stringify(['single', 'multi', 'circle']) && JSON.stringify(typeState.labels) === JSON.stringify(['单行', '多行', '圆形']) && typeState.text.includes('类型'))

    await setValue('[data-testid="text-type"]', 'multi'); await sleep(120)
    const multiState = await evaluate(`(() => {
      const d=document.querySelector('[data-testid="object-props-dialog"]'); const width=d?.querySelector('[data-testid="text-line-width"]'); const spacing=d?.querySelector('[data-testid="text-line-spacing"]'); const vertical=[...d?.querySelectorAll('select')||[]].find((s)=>[...s.options].some((o)=>o.value==='middle'))
      return { width:{min:width?.min,step:width?.step}, spacing:{min:spacing?.min,step:spacing?.step,value:spacing?.value}, vertical:[...(vertical?.options||[])].map((o)=>o.value), labels:[...(vertical?.options||[])].map((o)=>o.textContent.trim()) }
    })()`)
    results['B-66 多行文字提供行宽度、垂直对齐与毫米行距'] = Boolean(multiState && multiState.width.min === '0.1' && multiState.width.step === '0.1' && multiState.spacing.min === '0' && multiState.spacing.step === '0.1' && multiState.vertical.join(',') === 'top,middle,bottom' && multiState.labels.join(',') === '顶部,中间,底部')
    await setValue('[data-testid="text-line-width"]', '32.5'); await setValue('[data-testid="text-line-spacing"]', '1.5'); await setValue('[data-testid="text-type"]', 'circle'); await sleep(120)
    await confirmProps()

    if (!await openTextProps()) throw new Error('text props did not reopen')
    await click('[data-testid="object-props-tab-text"]'); await sleep(100)
    const circleState = await evaluate(`(() => {
      const d=document.querySelector('[data-testid="object-props-dialog"]');
      const select=(id)=>d?.querySelector('[data-testid="'+id+'"]'); const angle=select('text-arc-angle'); const extent=select('text-arc-extent'); const radius=select('text-arc-radius'); const dir=select('text-arc-direction'); const textDir=select('text-arc-text-direction')
      return { type:select('text-type')?.value, angle:{min:angle?.min,max:angle?.max}, extent:{min:extent?.min,max:extent?.max}, radius:!!radius, dir:[...(dir?.options||[])].map((o)=>o.value), textDir:[...(textDir?.options||[])].map((o)=>o.value), width:select('text-line-width')?.value }
    })()`)
    results['B-67 圆形文字提供角度/弧度/半径/回绕/文字方向参数'] = Boolean(circleState && circleState.type === 'circle' && circleState.angle.min === '0' && circleState.angle.max === '360' && circleState.extent.min === '0' && circleState.extent.max === '360' && circleState.radius && circleState.dir.join(',') === 'cw,ccw' && circleState.textDir.join(',') === 'out,in' && circleState.width === '32.5')
    await setValue('[data-testid="text-arc-angle"]', '270'); await setValue('[data-testid="text-arc-extent"]', '90'); await setValue('[data-testid="text-arc-radius"]', '12.5'); await setValue('[data-testid="text-arc-direction"]', 'ccw'); await setValue('[data-testid="text-arc-text-direction"]', 'in'); await confirmProps()

    if (!await openTextProps()) throw new Error('text props did not reopen after circle commit')
    await click('[data-testid="object-props-tab-text"]'); await sleep(100)
    results['B-67 圆形文字参数确定后重新打开仍保持'] = await evaluate(`(() => {
      const d=document.querySelector('[data-testid="object-props-dialog"]'); const v=(id)=>d?.querySelector('[data-testid="'+id+'"]')?.value
      return v('text-type')==='circle' && v('text-arc-angle')==='270' && v('text-arc-extent')==='90' && v('text-arc-radius')==='12.5' && v('text-arc-direction')==='ccw' && v('text-arc-text-direction')==='in'
    })()`)
    await confirmProps()

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
