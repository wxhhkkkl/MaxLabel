/* D-43/D-44：新建前选择打印机、分辨率提示与模板打印机绑定回读。 */
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
  const savedPrinter = 'MaxLabel Parity Printer'
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
    const waitFor = async (expression, timeout = 5000) => {
      const start = Date.now()
      while (Date.now() - start < timeout) {
        if (await evaluate(expression)) return true
        await sleep(80)
      }
      return false
    }

    await sleep(1600)
    await evaluate(`localStorage.setItem('maxlabel.defaultPrinter', ${JSON.stringify(JSON.stringify({
      driver: 'tspl', dpi: 203, speed: 4, density: 8, printMode: 'thermal', labelType: 'gap', topOffsetMm: 0,
      mediaHandle: 'tear', backfeedMm: 0, port: { type: 'driver', encoding: 'utf8' }, printerName: savedPrinter
    }))})`)
    await evaluate('document.querySelector("button[aria-label=关闭]")?.click()')
    await evaluate('window.dispatchEvent(new KeyboardEvent("keydown",{key:"n",code:"KeyN",ctrlKey:true,bubbles:true,cancelable:true}))')
    await sleep(350)
    if (await evaluate('!!document.querySelector("[data-testid=template-wizard]")')) {
      await click('[data-testid="wizard-next"]')
      await sleep(450)
    }
    if (!await waitFor('!!document.querySelector("[data-testid=new-label-dialog]")')) throw new Error('new label dialog did not open')

    results['D-43 新建前选择打印机并提示条码密度/标签尺寸影响'] = await evaluate(`(() => {
      const impact = document.querySelector('[data-testid="new-label-printer-impact"]')?.textContent || ''
      const select = document.querySelector('[data-testid="new-label-printer"]')
      return impact.includes('条码密度') && impact.includes('标签尺寸') && select?.value === ${JSON.stringify(savedPrinter)}
    })()`)
    results['D-44 已保存默认打印机在新建对话框中回读'] = await evaluate(`(() => {
      const select = document.querySelector('[data-testid="new-label-printer"]')
      return [...(select?.options || [])].some((option) => option.value === ${JSON.stringify(savedPrinter)} && (option.textContent || '').includes('已保存打印机'))
    })()`)

    await click('[data-testid="new-label-select"]')
    if (!await waitFor('!!document.querySelector("canvas.upper-canvas")')) throw new Error('editor did not open')
    await evaluate('window.dispatchEvent(new KeyboardEvent("keydown",{key:"p",code:"KeyP",ctrlKey:true,bubbles:true,cancelable:true}))')
    if (!await waitFor('!!document.querySelector("[data-testid=print-dialog]")')) throw new Error('print dialog did not open')
    results['D-44 新建模板打印对话框仍绑定所选打印机'] = await evaluate(`document.querySelector('[data-testid="print-dialog-printer"]')?.textContent?.trim() === ${JSON.stringify(savedPrinter)}`)
    await click('[data-testid="print-dialog-printer-properties"]')
    if (!await waitFor('!!document.querySelector("[data-testid=printer-settings-dialog]")')) throw new Error('printer settings did not open')
    results['D-44 打印机属性页回显模板绑定名称'] = await evaluate(`document.querySelector('[data-testid="printer-pref-name"]')?.value === ${JSON.stringify(savedPrinter)}`)

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
