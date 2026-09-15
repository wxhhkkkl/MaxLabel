/* D-55：命令/文件输出时禁用页式打印起始标签选择。 */
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
    const waitFor = async (expression, timeout = 4000) => {
      const started = Date.now()
      while (Date.now() - started < timeout) {
        if (await evaluate(expression)) return true
        await sleep(80)
      }
      return false
    }
    const key = (name, options = {}) => evaluate(`(() => { const event=new KeyboardEvent('keydown',${JSON.stringify({ key: name, code: name, bubbles: true, cancelable: true, ...options })}); window.dispatchEvent(event); document.dispatchEvent(event); return true })()`)
    const setSelect = (selector, value) => evaluate(`(() => { const e=document.querySelector(${JSON.stringify(selector)}); if(!e)return false; const p=Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype,'value').set; p.call(e,${JSON.stringify(value)}); e.dispatchEvent(new Event('change',{bubbles:true})); return true })()`)

    await sleep(1500)
    await evaluate('document.querySelector("button[aria-label=关闭]")?.click()')
    await key('n', { ctrlKey: true }); await sleep(350)
    if (await evaluate('!!document.querySelector("[data-testid=template-wizard]")')) {
      await click('[data-testid="wizard-next"]'); await sleep(350)
      await click('[data-testid="new-label-select"]'); await sleep(1100)
    }
    if (!await waitFor('!!document.querySelector("canvas.upper-canvas")')) throw new Error('editor did not open')

    await key('p', { ctrlKey: true });
    if (!await waitFor('!!document.querySelector("[data-testid=print-dialog]")')) throw new Error('print dialog did not open')
    await click('[data-testid="print-dialog-printer-properties"]');
    if (!await waitFor('!!document.querySelector("[data-testid=printer-settings-dialog]")')) throw new Error('printer settings did not open')
    await click('[data-testid="printer-settings-port-tab"]'); await sleep(100)
    results['D-55 打印机设置提供打印到文件端口'] = await evaluate('!!document.querySelector("[data-testid=printer-port-type] option[value=file]")')
    await setSelect('[data-testid="printer-port-type"]', 'file'); await sleep(120)
    await click('[data-testid="printer-settings-save"]');
    if (!await waitFor('!document.querySelector("[data-testid=printer-settings-dialog]")')) throw new Error('printer settings did not close')
    await key('p', { ctrlKey: true });
    if (!await waitFor('!!document.querySelector("[data-testid=print-dialog]")')) throw new Error('file print dialog did not reopen')

    results['D-55 文件输出显示命令模式'] = await evaluate('document.querySelector("[data-testid=print-dialog-start-labels]")?.dataset.commandOutput === "true" && document.querySelector("[data-testid=print-dialog-printer-position]")?.textContent?.includes("打印到文件")')
    results['D-55 命令输出禁用起始标签和自动跟踪'] = await evaluate('!!document.querySelector("[data-testid=print-dialog-start-disabled]") && ![...document.querySelectorAll("[data-testid^=print-start-label-]")].some((e) => !e.disabled) && document.querySelector("[data-testid=print-option-track-start]")?.disabled === true')
    results['D-55 命令输出仍禁用打印标签边框'] = await evaluate('document.querySelector("[data-testid=print-option-border]")?.disabled === true')

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
