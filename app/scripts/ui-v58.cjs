/* P0-C：数据源类型入口、序列号、日期/时间默认值与序列预览。 */
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
    const key = (name, options = {}) => evaluate(`(() => { const e = new KeyboardEvent('keydown', ${JSON.stringify({ key: name, bubbles: true, cancelable: true, ...options })}); window.dispatchEvent(e); return e.defaultPrevented })()`)
    const setValue = async (selector, value) => evaluate(`(() => { const e = document.querySelector(${JSON.stringify(selector)}); if (!e) return false; const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set; setter.call(e, ${JSON.stringify(String(value))}); e.dispatchEvent(new Event('input', { bubbles: true })); e.dispatchEvent(new Event('change', { bubbles: true })); return true })()`)
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

    await sleep(1800)
    await evaluate('document.querySelector("button[aria-label=关闭]")?.click()')
    await key('n', { ctrlKey: true })
    await sleep(300)
    await click('[data-testid="wizard-next"]')
    await sleep(450)
    await evaluate(`(() => { const items = [...document.querySelectorAll('button')].filter((e) => e.offsetParent && e.textContent.trim() === '选择'); items.at(-1)?.click(); return !!items.length })()`)
    await sleep(700)
    await click('[data-tool="text"]')
    await clickCanvas(200, 180)
    await sleep(500)
    await doubleClickCanvas(200, 180)
    await sleep(350)
    await sleep(350)
    if (!await evaluate('!!document.querySelector("[data-testid=object-props-dialog]")')) throw new Error('对象属性对话框未打开')
    const datasourceTab = await click('[data-testid="object-props-tab-datasource"]')
    await sleep(180)
    if (!datasourceTab) throw new Error('数据源页签未找到')
    if (!await evaluate('!!document.querySelector("[data-testid=data-source-editor]")')) {
      const state = await evaluate(`JSON.stringify({ dialog: !!document.querySelector('[data-testid="object-props-dialog"]'), tabs: [...document.querySelectorAll('[data-testid^="object-props-tab-"]')].map((e) => e.textContent.trim()), body: document.querySelector('[data-testid="object-props-dialog"]')?.textContent?.slice(0, 160) || '' })`)
      throw new Error('数据源编辑器未呈现：' + state)
    }

    const order = await evaluate(`JSON.stringify([...document.querySelectorAll('[data-testid="data-source-editor"] [data-testid^="source-kind-"]')].map((e) => e.textContent.trim()))`)
    results['变量类型入口顺序对齐'] = order === JSON.stringify(['常量', '序列号', '日期', '时间', '数据库', '键盘输入', '脚本'])
    results['常量默认显示数据可直接编辑'] = await evaluate(`(() => { const e = document.querySelector('[data-testid="data-source-editor"] input'); return !!e && e.value === '文字内容' })()`)

    await click('[data-testid="source-kind-serial"]')
    await sleep(180)
    results['序列号默认类型重复和基准'] = await evaluate(`(() => { const root = document.querySelector('[data-testid="data-source-editor"]'); const selects = [...root.querySelectorAll('select')]; return selects.some((e) => [...e.options].some((o) => o.textContent.trim() === '10进制(数字)') && e.value === '') && selects.some((e) => e.value === 'record') && [...root.querySelectorAll('input')].some((e) => e.value === '1') && root.textContent.includes('初始值来源') })()`)
    results['序列号推进一次的实际预览'] = await evaluate(`document.querySelector('[data-testid="serial-preview"]')?.textContent.includes('1 → 2')`)
    await setValue('[data-testid="serial-current"]', 9)
    results['序列号起始数据显示为连续值'] = await evaluate(`document.querySelector('[data-testid="serial-preview"]')?.textContent.includes('9 → 10')`)

    await click('[data-testid="source-kind-date"]')
    await sleep(180)
    results['日期默认格式和偏移'] = await evaluate(`(() => { const root = document.querySelector('[data-testid="data-source-editor"]'); return root.querySelector('[data-testid="date-format"]')?.value === 'yyyy-MM-dd' && root.querySelector('[data-testid="date-offset"]')?.value === '0' && root.textContent.includes('日期格式') && root.textContent.includes('日期偏移') })()`)
    await click('[data-testid="source-kind-time"]')
    await sleep(180)
    results['时间默认格式区域和偏移'] = await evaluate(`(() => { const root = document.querySelector('[data-testid="data-source-editor"]'); return root.querySelector('[data-testid="time-format"]')?.value === 'HH:mm:ss' && root.querySelector('[data-testid="time-region"]')?.value === 'default' && root.querySelector('[data-testid="time-offset"]')?.value === '0' })()`)

    await evaluate('document.querySelector("[data-testid=object-props-dialog] button[aria-label=关闭]")?.click()')
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
