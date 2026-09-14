/* P0-C：数据库字段/单标签记录与打印前键盘输入回归 */
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
    const click = async (selector) => evaluate(`(() => { const e = document.querySelector(${JSON.stringify(selector)}); if (!e || !e.isConnected) return false; e.click(); return true })()`)
    const setValue = async (selector, value) => evaluate(`(() => { const e = document.querySelector(${JSON.stringify(selector)}); if (!e) return false; const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set; setter.call(e, ${JSON.stringify(String(value))}); e.dispatchEvent(new Event('input', { bubbles: true })); e.dispatchEvent(new Event('change', { bubbles: true })); return true })()`)
    const clickCanvas = (x, y, double = false) => evaluate(`(() => {
      const host = document.querySelector('[data-testid="canvas-host"], .canvas-container, canvas')
      if (!host) return false
      const box = host.getBoundingClientRect()
      const clientX = box.left + ${Number(x) || 0}
      const clientY = box.top + ${Number(y) || 0}
      const target = document.elementFromPoint(clientX, clientY) || host
      const opts = { bubbles: true, cancelable: true, view: window, clientX, clientY, detail: ${double ? 2 : 1}, pointerId: 1, pointerType: 'mouse', isPrimary: true, button: 0, buttons: 1 }
      try { target.dispatchEvent(new PointerEvent('pointerdown', opts)) } catch {}
      target.dispatchEvent(new MouseEvent('mousedown', opts))
      try { target.dispatchEvent(new PointerEvent('pointerup', { ...opts, buttons: 0 })) } catch {}
      target.dispatchEvent(new MouseEvent('mouseup', { ...opts, buttons: 0 }))
      target.dispatchEvent(new MouseEvent('click', { ...opts, buttons: 0 }))
      ${double ? "target.dispatchEvent(new MouseEvent('dblclick', { ...opts, buttons: 0 }))" : ''}
      return true
    })()`)

    await sleep(1800)
    await evaluate('document.querySelector("button[aria-label=关闭]")?.click()')
    await evaluate('window.dispatchEvent(new KeyboardEvent("keydown", { key: "n", code: "KeyN", ctrlKey: true, bubbles: true, cancelable: true }))')
    await sleep(350)
    await click('[data-testid="wizard-next"]')
    await sleep(450)
    await evaluate(`(() => { const items = [...document.querySelectorAll('button')].filter((e) => e.offsetParent && e.textContent.trim() === '选择'); items.at(-1)?.click(); return !!items.length })()`)
    await sleep(700)
    await click('[data-tool="text"]')
    await clickCanvas(200, 180)
    await sleep(500)
    await clickCanvas(200, 180, true)
    await sleep(900)
    if (!await evaluate('!!document.querySelector("[data-testid=object-props-dialog]")')) throw new Error('object properties dialog did not open')
    if (!await click('[data-testid="object-props-tab-datasource"]')) throw new Error('data source tab missing')
    await sleep(180)

    results['variable type entry remains ordered'] = await evaluate(`JSON.stringify([...document.querySelectorAll('[data-testid="data-source-editor"] [data-testid^="source-kind-"]')].map((e) => e.textContent.trim())) === JSON.stringify(['常量', '序列号', '日期', '时间', '数据库', '键盘输入', '脚本'])`)

    await click('[data-testid="source-kind-database"]')
    await sleep(180)
    results['database field name and record selector are present'] = await evaluate(`(() => { const root = document.querySelector('[data-testid="data-source-editor"]'); const offset = root?.querySelector('[data-testid="database-record-offset"]'); const field = root?.querySelector('[data-testid="database-field"]'); return !!field && !!offset && offset.value === '1' && [...offset.options].some((o) => o.value === '2') && root.textContent.includes('字段名') })()`)
    results['database record selector defaults to first record'] = await evaluate(`document.querySelector('[data-testid="database-record-offset"]')?.value === '1'`)

    await click('[data-testid="source-kind-keyboard"]')
    await sleep(180)
    await setValue('[data-testid="keyboard-label"]', '批次号')
    await sleep(180)
    results['keyboard input defaults and prompt are visible'] = await evaluate(`(() => { const root = document.querySelector('[data-testid="data-source-editor"]'); const device = root?.querySelector('[data-testid="keyboard-input-device"]'); return root?.querySelector('[data-testid="keyboard-label"]')?.value === '批次号' && device?.value === 'keyboard' && [...device.options].some((o) => o.value === 'weigh') && root.textContent.includes('打印作业开始时请求输入') })()`)

    await evaluate(`(() => { const root = document.querySelector('[data-testid="object-props-dialog"]'); const button = [...(root?.querySelectorAll('button') || [])].find((e) => e.textContent.trim() === '确定'); button?.click(); return !!button })()`)
    await sleep(500)
    const printButton = await click('[data-testid="print-submit"]')
    if (!printButton) throw new Error('direct print button missing')
    await sleep(500)
    results['print start opens keyboard input dialog'] = await evaluate(`(() => { const root = document.querySelector('[data-testid="keyboard-input-modal"]'); return !!root && root.textContent.includes('批次号') && !!root.querySelector('[data-testid="keyboard-input-批次号"]') && !!root.querySelector('[data-testid="keyboard-input-submit"]') })()`)
    await evaluate('document.querySelector("[data-testid=keyboard-input-modal] button")?.click()')

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
