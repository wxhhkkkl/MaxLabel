/* DIFF-13.4：验证非 100% 缩放 + 工作区滚动后，容器级 dblclick 仍能命中对象。 */
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
    const closeDialog = async () => {
      await evaluate(`document.querySelector('[data-testid="object-props-dialog"] button[aria-label="关闭"]')?.click()`)
      await sleep(180)
    }
    const dialog = () => evaluate('!!document.querySelector("[data-testid=object-props-dialog]")')

    await sleep(1800)
    await evaluate('document.querySelector("button[aria-label=关闭]")?.click()')
    await sleep(200)
    await key('n', { ctrlKey: true })
    await sleep(300)
    await click('[data-testid="wizard-next"]')
    await sleep(500)
    await clickText('选择')
    await sleep(750)
    await click('[data-tool="text"]')
    await evaluate(`(() => {
      const host = document.querySelector('[data-testid="canvas-host"], .canvas-container, canvas')
      if (!host) return false
      const b = host.getBoundingClientRect()
      const x = b.left + 220, y = b.top + 200
      const target = document.elementFromPoint(x, y) || host
      const options = { bubbles: true, cancelable: true, view: window, clientX: x, clientY: y, button: 0, buttons: 1 }
      target.dispatchEvent(new MouseEvent('mousedown', options))
      target.dispatchEvent(new MouseEvent('mouseup', { ...options, buttons: 0 }))
      target.dispatchEvent(new MouseEvent('click', { ...options, buttons: 0 }))
      return true
    })()`)
    await sleep(650)

    const setup = await evaluate(`(() => {
      const select = [...document.querySelectorAll('select')].find((item) => [...item.options].some((option) => /%$/.test((option.textContent || '').trim())))
      const zoom = Number(select?.value || 0)
      const viewport = document.querySelector('[data-testid="workspace-viewport"]')
      if (viewport) {
        viewport.scrollLeft = Math.min(120, Math.max(0, viewport.scrollWidth - viewport.clientWidth))
        viewport.scrollTop = Math.min(80, Math.max(0, viewport.scrollHeight - viewport.clientHeight))
        viewport.dispatchEvent(new Event('scroll', { bubbles: true }))
      }
      return { zoom, scroll: [viewport?.scrollLeft || 0, viewport?.scrollTop || 0] }
    })()`)
    await sleep(350)
    results['非100%缩放并滚动后直接向监听容器派发双击'] = Boolean(await evaluate(`(() => {
      const canvas = document.querySelector('canvas.upper-canvas')
      const row = document.querySelector('[data-testid="layer-object-row"]')
      const root = canvas?.parentElement?.parentElement
      if (!canvas || !row || !root) return false
      const b = canvas.getBoundingClientRect()
      const zoom = ${Number(setup?.zoom) || 1}
      const x = b.left + (Number(row.dataset.objectX) * 10 + Number(row.dataset.objectW || 40) * 0.5) * zoom
      const y = b.top + (Number(row.dataset.objectY) * 10 + Number(row.dataset.objectH || 8) * 0.5) * zoom
      root.dispatchEvent(new MouseEvent('dblclick', { bubbles: true, cancelable: true, view: window, clientX: x, clientY: y, detail: 2, button: 0 }))
      return true
    })()`)) && await sleep(350).then(dialog)
    await closeDialog()

    results['关闭后对象仍选中'] = await evaluate('!!document.querySelector("[data-testid=layer-object-row][data-selected=true]")')
    results['Alt+Enter打开同一模态属性对话框'] = await key('Enter', { altKey: true }) && await sleep(300).then(dialog)
    await closeDialog()

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
