/* P0-C：脚本数据源、模板级生命周期与文字高级处理 */
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
      const message = JSON.parse(raw.toString()); const item = pending.get(message.id)
      if (!item) return
      pending.delete(message.id); if (message.error) item.rej(new Error(message.error.message)); else item.res(message.result)
    })
    ws.on('open', () => resolve({ ws, send })); ws.on('error', reject)
  })
}

;(async () => {
  let client
  const results = {}
  try {
    const port = process.env.MAXLABEL_DEBUG_PORT || 9222
    const pages = await getJson(`http://127.0.0.1:${port}/json/list`); const page = pages.find((item) => item.type === 'page')
    if (!page) throw new Error('no main page')
    client = await attach(page.webSocketDebuggerUrl)
    const evaluate = async (expression) => {
      const result = await client.send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true })
      if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description || result.exceptionDetails.text)
      return result.result?.value
    }
    const click = (selector) => evaluate(`(() => { const e = document.querySelector(${JSON.stringify(selector)}); if (!e || !e.isConnected) return false; e.click(); return true })()`)
    const clickButton = (token) => evaluate(`(() => { const e = [...document.querySelectorAll('button')].find((x) => x.offsetParent && (x.textContent || '').trim().includes(${JSON.stringify(token)})); if (!e) return false; e.click(); return true })()`)
    const clickMenu = (token) => evaluate(`(() => { const e = [...document.querySelectorAll('[data-menu-item]')].find((x) => x.offsetParent && (x.textContent || '').includes(${JSON.stringify(token)})); if (!e) return false; e.click(); return true })()`)
    const key = (name, options = {}) => evaluate(`(() => { window.dispatchEvent(new KeyboardEvent('keydown', ${JSON.stringify({ key: name, bubbles: true, cancelable: true, ...options })})); return true })()`)
    const clickCanvas = (x, y, double = false) => evaluate(`(() => {
      const host = document.querySelector('[data-testid="canvas-host"], .canvas-container, canvas'); if (!host) return false
      const box = host.getBoundingClientRect(); const clientX = box.left + ${Number(x) || 0}; const clientY = box.top + ${Number(y) || 0}; const target = document.elementFromPoint(clientX, clientY) || host
      const opts = { bubbles: true, cancelable: true, view: window, clientX, clientY, detail: ${double ? 2 : 1}, pointerId: 1, pointerType: 'mouse', isPrimary: true, button: 0, buttons: 1 }
      try { target.dispatchEvent(new PointerEvent('pointerdown', opts)) } catch {}; target.dispatchEvent(new MouseEvent('mousedown', opts)); try { target.dispatchEvent(new PointerEvent('pointerup', { ...opts, buttons: 0 })) } catch {}
      target.dispatchEvent(new MouseEvent('mouseup', { ...opts, buttons: 0 })); target.dispatchEvent(new MouseEvent('click', { ...opts, buttons: 0 })); ${double ? "target.dispatchEvent(new MouseEvent('dblclick', { ...opts, buttons: 0 }))" : ''}; return true
    })()`)
    const closeModal = () => evaluate('window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true })); true')

    await sleep(1800); await evaluate('document.querySelector("button[aria-label=关闭]")?.click()')
    await key('n', { ctrlKey: true }); await sleep(300); await click('[data-testid="wizard-next"]'); await sleep(450)
    await evaluate(`(() => { const items = [...document.querySelectorAll('button')].filter((e) => e.offsetParent && (e.textContent || '').trim() === '选择'); items.at(-1)?.click(); return !!items.length })()`)
    await sleep(700); await click('[data-tool="text"]'); await clickCanvas(200, 180); await sleep(450); await clickCanvas(200, 180, true); await sleep(700)
    if (!await evaluate('!!document.querySelector("[data-testid=object-props-dialog]")')) throw new Error('object properties dialog did not open')
    await click('[data-testid="object-props-tab-datasource"]'); await sleep(150)
    results['script data source remains seventh in ordered entry list'] = await evaluate(`(() => { const items = [...document.querySelectorAll('[data-testid="data-source-editor"] [data-testid^="source-kind-"]')]; return items.length === 7 && items.at(-1)?.textContent.trim() === '脚本' })()`)
    await click('[data-testid="source-kind-script"]'); await sleep(150)
    results['script editor has OnGetData default'] = await evaluate(`document.querySelector('[data-testid="script-code"]')?.value.includes('OnGetData')`)
    results['script editor exposes lifecycle variable hint'] = await evaluate(`document.querySelector('[data-testid="data-source-editor"]')?.textContent.includes('V_PAGE')`)
    await closeModal(); await sleep(250)

    await key('o', { altKey: true }); await sleep(150); await clickMenu('系统选项'); await sleep(250)
    results['allow script is disabled by default'] = await evaluate(`document.querySelector('[data-testid="allow-script"]')?.checked === false`)
    await closeModal(); await sleep(250)

    await key('f', { altKey: true }); await sleep(150); await clickMenu('模板属性设置'); await sleep(300); await clickButton('其它'); await sleep(150)
    results['template properties expose global script field'] = await evaluate(`!!document.querySelector('[data-testid="global-script"]')`)
    results['global script field is empty by default'] = await evaluate(`document.querySelector('[data-testid="global-script"]')?.value === ''`)
    await closeModal(); await sleep(250)

    await key('Enter', { altKey: true }); await sleep(300); await click('[data-testid="object-props-tab-text"]'); await sleep(150)
    results['text properties expose cut and length controls'] = await evaluate(`!!document.querySelector('[data-testid="text-cut-type"]') && !!document.querySelector('[data-testid="text-length-limit"]')`)
    await evaluate(`(() => { const e = document.querySelector('[data-testid="text-cut-type"]'); const s = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set; s.call(e, 'keepRight'); e.dispatchEvent(new Event('change', { bubbles: true })); return true })()`); await sleep(120)
    results['keep-right reveals cut count'] = await evaluate(`!!document.querySelector('[data-testid="text-cut-count"]')`)
    await evaluate(`(() => { const e = document.querySelector('[data-testid="text-length-limit"]'); const s = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set; s.call(e, 'min'); e.dispatchEvent(new Event('change', { bubbles: true })); return true })()`); await sleep(120)
    results['minimum length reveals padding fields'] = await evaluate(`!!document.querySelector('[data-testid="text-length-min"]') && !!document.querySelector('[data-testid="text-pad-direction"]') && !!document.querySelector('[data-testid="text-pad-char"]')`)
    results['minimum padding defaults to left'] = await evaluate(`document.querySelector('[data-testid="text-pad-direction"]')?.value === 'left'`)
    await closeModal()

    let pass = 0; for (const [name, value] of Object.entries(results)) { console.log((value ? 'PASS ' : 'FAIL ') + name + ' => ' + value); if (value) pass++ }
    console.log(`\n${pass}/${Object.keys(results).length} PASS`); client.ws.close(); process.exit(pass === Object.keys(results).length ? 0 : 1)
  } catch (error) { console.error('ERR', error.message); if (client) client.ws.close(); process.exit(2) }
})()
