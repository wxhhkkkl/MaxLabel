/* P0-D：打印对话框对齐 LabelShop 63-dlg-print / 64a / 64b。 */
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
    const key = (name, options = {}) => evaluate(`(() => { window.dispatchEvent(new KeyboardEvent('keydown', ${JSON.stringify({ key: name, code: name, bubbles: true, cancelable: true, ...options })})); return true })()`)
    const visibleButtons = () => evaluate(`[...document.querySelectorAll('[data-testid=print-dialog] button')].filter((e) => e.offsetParent).map((e) => (e.textContent || '').trim())`)

    await sleep(1800)
    await evaluate('document.querySelector("button[aria-label=关闭]")?.click()')
    await key('n', { ctrlKey: true }); await sleep(350)
    await click('[data-testid="wizard-next"]'); await sleep(450)
    await evaluate(`(() => { const items = [...document.querySelectorAll('button')].filter((e) => e.offsetParent && (e.textContent || '').trim() === '选择'); items.at(-1)?.click(); return !!items.length })()`)
    await sleep(900)
    await key('p', { ctrlKey: true }); await sleep(350)

    results['print dialog groups follow printer-range-settings'] = await evaluate(`(() => {
      const keys = [...document.querySelectorAll('[data-testid^="print-dialog-group-"]')].map((e) => e.getAttribute('data-testid'))
      return JSON.stringify(keys) === JSON.stringify(['print-dialog-group-printer', 'print-dialog-group-range', 'print-dialog-group-settings'])
    })()`)
    results['printer information has position and properties'] = await evaluate('!!document.querySelector("[data-testid=print-dialog-printer-position]") && !!document.querySelector("[data-testid=print-dialog-printer-properties]")')
    results['print range has current-record-only and start-record'] = await evaluate('!!document.querySelector("[data-testid=print-option-current-only]") && !!document.querySelector("[data-testid=print-dialog-start-record]")')
    results['settings labels and disabled border match LabelShop'] = await evaluate('!!document.querySelector("[data-testid=print-option-update-vars]") && !!document.querySelector("[data-testid=print-option-rotate180]") && document.querySelector("[data-testid=print-option-border]")?.disabled === true')
    results['dialog defaults use one page of labels and one copy'] = await evaluate('document.querySelector("[data-testid=print-dialog-count]")?.value === "8" && document.querySelector("[data-testid=print-dialog-copies]")?.value === "1"')
    const buttons = await visibleButtons()
    results['dialog button set includes preview-print-test-cancel-help'] = ['预览', '打印', '测试打印', '取消', '帮助'].every((label) => buttons.includes(label))

    await click('[data-testid="print-start-label-3"]'); await sleep(100)
    results['start label grid changes selected label'] = await evaluate('document.querySelector("[data-testid=print-start-label-3]")?.style.background === "rgb(228, 239, 247)"')
    await click('[data-testid="print-dialog-advanced"]'); await sleep(150)
    results['advanced dialog exposes header-crop-database tabs'] = await evaluate(`(() => {
      const labels = [...document.querySelectorAll('[data-testid^="print-advanced-tab-"]')].map((e) => (e.textContent || '').trim())
      return JSON.stringify(labels) === JSON.stringify(['页眉页脚', '定位裁切标记', '数据库打印高级选项'])
    })()`)
    const headerDefaults = await evaluate('document.querySelector("[data-testid=print-advanced-header-enabled]")?.checked === false && document.querySelector("[data-testid=print-advanced-header-template]")?.value === "&D &T &F - &P"')
    await click('[data-testid="print-advanced-tab-crop"]'); await sleep(60)
    const cropDefaults = await evaluate('document.querySelector("[data-testid=print-advanced-crop-enabled]")?.checked === true && document.querySelector("[data-testid=print-advanced-crop-offset]")?.value === "-5"')
    results['advanced defaults match LabelShop'] = headerDefaults && cropDefaults
    await click('[data-testid="print-advanced-tab-database"]'); await sleep(80)
    results['database advanced labels use help wording'] = await evaluate(`(() => { const text = document.querySelector('[data-testid=print-advanced-dialog]')?.innerText || ''; return text.includes('打印时自动设置数据库记录数量') && text.includes('拷贝数量从数据库字段引入') && text.includes('允许打印时输入第一个标签的拷贝数量') })()`)
    await click('[data-testid="print-advanced-submit"]'); await sleep(100)
    await click('[data-testid="print-dialog-printer-properties"]'); await sleep(180)
    results['printer properties opens configuration modal'] = await evaluate('!!document.querySelector("[data-testid=printer-settings-port-tab]")')
    await click('[data-testid="printer-settings-port-tab"]'); await sleep(80)
    results['printer port tab exposes LabelShop port choices'] = await evaluate(`(() => {
      const root = document.querySelector('[data-testid=printer-settings-port]')
      const text = root?.innerText || ''
      return !!root && ['打印机端口(LPT)', '串行端口(COM)', '标准 TCP/IP 打印机端口', 'USB 打印机端口', '蓝牙', '蜂打打云盒', '打印机驱动程序端口'].every((label) => text.includes(label))
    })()`)
    await click('[aria-label="关闭"]'); await sleep(100)
    await click('[aria-label="关闭打印对话框"]'); await sleep(100)

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
