/* DIFF-13：双击与 Alt+Enter 共用模态对象属性入口，关闭后保留对象选中。 */
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
    const click = (selector) => evaluate(`(() => { const e = document.querySelector(${JSON.stringify(selector)}); if (!e || !e.offsetParent) return false; e.click(); return true })()`)
    const clickText = (text) => evaluate(`(() => {
      const wanted = ${JSON.stringify(text)}
      const elements = [...document.querySelectorAll('button')].filter((element) => element.offsetParent && (element.textContent || '').trim() === wanted)
      if (!elements.length) return false
      elements[elements.length - 1].click(); return true
    })()`)
    const key = (name, options = {}) => evaluate(`(() => { const e = new KeyboardEvent('keydown', ${JSON.stringify({ key: name, bubbles: true, cancelable: true, ...options })}); window.dispatchEvent(e); return e.defaultPrevented })()`)
    const clickCanvas = (x, y) => evaluate(`(() => {
      const host = document.querySelector('[data-testid="canvas-host"], .canvas-container, canvas')
      if (!host) return false
      const box = host.getBoundingClientRect()
      const clientX = box.left + ${Number(x) || 0}
      const clientY = box.top + ${Number(y) || 0}
      const target = document.elementFromPoint(clientX, clientY) || host
      const opts = { bubbles: true, cancelable: true, view: window, clientX, clientY, pointerId: 1, pointerType: 'mouse', isPrimary: true, button: 0, buttons: 1 }
      try { target.dispatchEvent(new PointerEvent('pointerdown', opts)) } catch {}
      target.dispatchEvent(new MouseEvent('mousedown', opts))
      try { target.dispatchEvent(new PointerEvent('pointerup', { ...opts, buttons: 0 })) } catch {}
      target.dispatchEvent(new MouseEvent('mouseup', { ...opts, buttons: 0 }))
      target.dispatchEvent(new MouseEvent('click', { ...opts, buttons: 0 }))
      return true
    })()`)
    const doubleClickCanvas = (x, y) => evaluate(`(() => {
      const host = document.querySelector('[data-testid="canvas-host"], .canvas-container, canvas')
      if (!host) return false
      const box = host.getBoundingClientRect()
      const clientX = box.left + ${Number(x) || 0}
      const clientY = box.top + ${Number(y) || 0}
      const target = document.elementFromPoint(clientX, clientY) || host
      const opts = { bubbles: true, cancelable: true, view: window, clientX, clientY, detail: 2, pointerId: 1, pointerType: 'mouse', isPrimary: true, button: 0, buttons: 1 }
      try { target.dispatchEvent(new PointerEvent('pointerdown', opts)) } catch {}
      target.dispatchEvent(new MouseEvent('mousedown', opts))
      try { target.dispatchEvent(new PointerEvent('pointerup', { ...opts, buttons: 0 })) } catch {}
      target.dispatchEvent(new MouseEvent('mouseup', { ...opts, buttons: 0 }))
      target.dispatchEvent(new MouseEvent('click', { ...opts, buttons: 0 }))
      target.dispatchEvent(new MouseEvent('dblclick', { ...opts, buttons: 0 }))
      return true
    })()`)
    const selected = () => evaluate(`!!document.querySelector('[data-testid="layer-object-row"][data-selected="true"]')`)
    const dialog = () => evaluate(`!!document.querySelector('[data-testid="object-props-dialog"]')`)
    const closeDialog = async () => { await click('[data-testid="object-props-dialog"] button[aria-label="关闭"]'); await sleep(220) }

    await sleep(1800)
    await evaluate('document.querySelector("button[aria-label=关闭]")?.click()')
    await sleep(200)
    await key('n', { ctrlKey: true })
    await sleep(300)
    await click('[data-testid="wizard-next"]')
    await sleep(450)
    await clickText('选择')
    await sleep(700)
    await click('[data-tool="text"]')
    await clickCanvas(200, 180)
    await sleep(500)
    results['双击对象打开模态属性对话框'] = await doubleClickCanvas(200, 180) && await sleep(300).then(dialog)
    results['模态属性页签顺序对齐原文'] = JSON.stringify(await evaluate(`([...document.querySelectorAll('[data-testid="object-props-dialog"] [data-testid^="object-props-tab-"]')].map((e) => (e.textContent || '').trim()))`)) === JSON.stringify(['通用', '文字', '字体', '数据'])
    await closeDialog()
    results['关闭属性对话框后对象仍选中'] = !await dialog() && await selected()
    results['Alt+Enter打开同一模态属性对话框'] = await key('Enter', { altKey: true }) && await sleep(300).then(dialog)

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
