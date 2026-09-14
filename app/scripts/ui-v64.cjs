/* D 模块：打印机首选项的字段、枚举、边界和默认值持久化。 */
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
    const click = (selector) => evaluate(`(() => { const e = document.querySelector(${JSON.stringify(selector)}); if (!e || !e.isConnected) return false; e.click(); return true })()`)
    const key = (name, options = {}) => evaluate(`(() => { const o = ${JSON.stringify({ key: name, code: name, bubbles: true, cancelable: true, ...options })}; document.dispatchEvent(new KeyboardEvent('keydown', o)); window.dispatchEvent(new KeyboardEvent('keydown', o)); return true })()`)
    const setValue = (selector, value) => evaluate(`(() => { const e = document.querySelector(${JSON.stringify(selector)}); if (!e) return false; const proto = e instanceof HTMLSelectElement ? HTMLSelectElement.prototype : HTMLInputElement.prototype; const setter = Object.getOwnPropertyDescriptor(proto, 'value')?.set; setter?.call(e, ${JSON.stringify(String(value))}); e.dispatchEvent(new Event('input', { bubbles: true })); e.dispatchEvent(new Event('change', { bubbles: true })); return e.value })()`)

    await sleep(1800)
    await evaluate('document.querySelector("button[aria-label=关闭]")?.click()')
    await key('n', { ctrlKey: true }); await sleep(350)
    await click('[data-testid="wizard-next"]'); await sleep(450)
    await evaluate(`(() => { const items = [...document.querySelectorAll('button')].filter((e) => e.offsetParent && (e.textContent || '').trim() === '选择'); items.at(-1)?.click(); return true })()`)
    await sleep(900)
    await key('p', { ctrlKey: true }); await sleep(350)
    const printerPropertiesClicked = await click('[data-testid="print-dialog-printer-properties"]'); await sleep(450)
    if (!printerPropertiesClicked) throw new Error('无法打开打印机属性')

    results['printer preference dialog is reachable'] = await evaluate('!!document.querySelector("[data-testid=printer-settings-dialog]")')
    results['preference fields and help wording'] = await evaluate(`(() => {
      const root = document.querySelector('[data-testid=printer-settings-dialog]')
      const text = root?.innerText || ''
      return ['打印速度', '打印浓度', '打印方式', '标签类型', '顶部偏移', '介质处理', '出纸回退', '保存为默认值'].every((item) => text.includes(item))
    })()`)
    results['preference defaults and numeric bounds'] = await evaluate(`(() => {
      const speed = document.querySelector('[data-testid=printer-pref-speed]')
      const density = document.querySelector('[data-testid=printer-pref-density]')
      const offset = document.querySelector('[data-testid=printer-pref-top-offset]')
      const backfeed = document.querySelector('[data-testid=printer-pref-backfeed]')
      return speed?.value === '4' && speed?.min === '1' && speed?.max === '6' && density?.value === '8' && density?.min === '1' && density?.max === '15' && offset?.step === '0.5' && offset?.min === '-1000' && backfeed?.min === '0'
    })()`)
    results['label type order follows help'] = await evaluate(`(() => { const e = document.querySelector('[data-testid=printer-pref-label-type]'); return !!e && JSON.stringify([...e.options].map((o) => o.text)) === JSON.stringify(['打印机默认', '连续纸', '间隔定位的标签', '标记定位的标签']) })()`)
    results['media handling enum follows help'] = await evaluate(`(() => { const e = document.querySelector('[data-testid=printer-pref-media-handle]'); if (!e) return false; const values = [...e.options].map((o) => o.text); return values.slice(0, 3).join('|') === '撕纸|剥离|切纸' })()`)

    await setValue('[data-testid="printer-pref-speed"]', 6)
    await setValue('[data-testid="printer-pref-density"]', 12)
    await setValue('[data-testid="printer-pref-print-mode"]', 'transfer')
    await setValue('[data-testid="printer-pref-label-type"]', 'mark')
    await setValue('[data-testid="printer-pref-top-offset"]', -2.5)
    await setValue('[data-testid="printer-pref-media-handle"]', 'cut')
    await setValue('[data-testid="printer-pref-backfeed"]', 3.5)
    await click('[data-testid="printer-pref-save-default"]')
    await click('[data-testid="printer-settings-save"]'); await sleep(250)
    results['saved preference is applied to template and default store'] = await evaluate(`(() => {
      const stored = JSON.parse(localStorage.getItem('maxlabel.defaultPrinter') || '{}')
      return stored.speed === 6 && stored.density === 12 && stored.printMode === 'transfer' && stored.labelType === 'mark' && stored.topOffsetMm === -2.5 && stored.mediaHandle === 'cut' && stored.backfeedMm === 3.5
    })()`)
    await click('[data-testid="print-dialog-printer-properties"]'); await sleep(250)
    results['saved values survive reopening properties'] = await evaluate(`document.querySelector('[data-testid=printer-pref-speed]')?.value === '6' && document.querySelector('[data-testid=printer-pref-density]')?.value === '12' && document.querySelector('[data-testid=printer-pref-print-mode]')?.value === 'transfer' && document.querySelector('[data-testid=printer-pref-label-type]')?.value === 'mark' && document.querySelector('[data-testid=printer-pref-top-offset]')?.value === '-2.5' && document.querySelector('[data-testid=printer-pref-backfeed]')?.value === '3.5'`)
    await click('[data-testid="printer-settings-cancel"]')
    await click('[aria-label="关闭打印对话框"]')

    let pass = 0
    for (const [name, value] of Object.entries(results)) { console.log((value ? 'PASS ' : 'FAIL ') + name + ' => ' + value); if (value) pass++ }
    console.log(`\n${pass}/${Object.keys(results).length} PASS`)
    client.ws.close(); process.exit(pass === Object.keys(results).length ? 0 : 1)
  } catch (error) {
    console.error('ERR', error.message)
    if (client) client.ws.close()
    process.exit(2)
  }
})()
