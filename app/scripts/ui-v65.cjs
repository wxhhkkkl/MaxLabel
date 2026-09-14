/* D 模块：高级打印选项中的打印时数据查重入口。 */
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

    await sleep(1800)
    await evaluate('document.querySelector("button[aria-label=关闭]")?.click()')
    await key('n', { ctrlKey: true }); await sleep(350)
    await click('[data-testid="wizard-next"]'); await sleep(450)
    await evaluate(`(() => { const items = [...document.querySelectorAll('button')].filter((e) => e.offsetParent && (e.textContent || '').trim() === '选择'); items.at(-1)?.click(); return true })()`)
    await sleep(900)
    await key('p', { ctrlKey: true }); await sleep(350)
    await click('[data-testid="print-dialog-advanced"]'); await sleep(180)
    await click('[data-testid="print-advanced-tab-database"]'); await sleep(100)

    results['duplicate-check entry and default are visible'] = await evaluate(`(() => {
      const root = document.querySelector('[data-testid=print-advanced-dialog]')
      const check = root?.querySelector('[data-testid=print-option-dupcheck]')
      return !!check && check.checked === false && (root.innerText || '').includes('打印时数据查重')
    })()`)
    await click('[data-testid="print-option-dupcheck"]')
    await click('[data-testid="print-advanced-submit"]'); await sleep(180)
    await click('[data-testid="print-dialog-advanced"]'); await sleep(180)
    await click('[data-testid="print-advanced-tab-database"]'); await sleep(100)
    results['duplicate-check choice persists in print dialog'] = await evaluate('document.querySelector("[data-testid=print-option-dupcheck]")?.checked === true')
    await click('[data-testid="print-advanced-submit"]')
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
