/* P0-D：打印机端口六类参数、系统设备发现与保存前校验。 */
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
    const click = (selector) => evaluate(`(() => { const e=document.querySelector(${JSON.stringify(selector)}); if(!e||!e.isConnected)return false; e.click(); return true })()`)
    const setValue = (selector, value) => evaluate(`(() => { const e=document.querySelector(${JSON.stringify(selector)}); if(!e)return false; const proto=e instanceof HTMLSelectElement?HTMLSelectElement.prototype:HTMLInputElement.prototype; const setter=Object.getOwnPropertyDescriptor(proto,'value').set; setter.call(e,${JSON.stringify(String(value))}); e.dispatchEvent(new Event('input',{bubbles:true})); e.dispatchEvent(new Event('change',{bubbles:true})); return true })()`)
    const setPortType = async (value) => { await setValue('[data-testid="printer-port-type"]', value); await sleep(180) }

    await sleep(1800)
    await evaluate('document.querySelector("button[aria-label=关闭]")?.click()')
    await evaluate('window.dispatchEvent(new KeyboardEvent("keydown",{key:"n",code:"KeyN",ctrlKey:true,bubbles:true,cancelable:true}))')
    await sleep(350)
    await click('[data-testid="wizard-next"]'); await sleep(450)
    await evaluate(`(() => { const items=[...document.querySelectorAll('button')].filter((e)=>e.offsetParent&&(e.textContent||'').trim()==='选择'); items.at(-1)?.click(); return true })()`)
    await sleep(900)
    await evaluate('window.dispatchEvent(new KeyboardEvent("keydown",{key:"p",code:"KeyP",ctrlKey:true,bubbles:true,cancelable:true}))')
    await sleep(350)
    await click('[data-testid="print-dialog-printer-properties"]'); await sleep(200)
    await click('[data-testid="printer-settings-port-tab"]'); await sleep(250)

    const labels = await evaluate(`JSON.stringify([...document.querySelector('[data-testid="printer-port-type"]').options].map((e)=>e.textContent.trim()))`)
    // round-106：类型(T) 的文字与顺序照抄真机「<打印机名> 属性 → 端口」（7 项 + 我们原有的「打印到文件」）
    results['port selector follows LabelShop port types'] = labels === JSON.stringify(['打印机端口(LPT)', '串行端口(COM)', '标准 TCP/IP 打印机端口', 'USB 打印机端口', '蓝牙', '蜂打打云盒', '打印机驱动程序端口', '打印到文件'])

    await setPortType('usb')
    results['USB port exposes enumerated port list and refresh (真机 端口(O) + 刷新USB端口)'] = await evaluate(`!!document.querySelector('[data-testid="printer-port-usb"]') && document.querySelector('[data-testid="printer-port-refresh-usb"]')?.textContent.trim()==='刷新USB端口' && document.querySelector('[data-testid="printer-port-usb-hint"]')?.textContent.trim()==='请连接USB打印机，并打开打印机电源。'`)
    await setPortType('tcp')
    results['TCP port exposes host and port with default 9100'] = await evaluate(`!!document.querySelector('[data-testid="printer-port-host"]') && document.querySelector('[data-testid="printer-port-number"]')?.value === '9100'`)
    await setValue('[data-testid="printer-port-host"]', 'bad host')
    results['TCP invalid address blocks save with visible error'] = await evaluate(`!!document.querySelector('[data-testid="printer-port-error"]') && document.querySelector('[data-testid="printer-settings-save"]')?.disabled === true`)
    await setValue('[data-testid="printer-port-host"]', '127.0.0.1')
    await setPortType('com')
    results['COM port exposes detected-port selector and refresh'] = await evaluate(`!!document.querySelector('[data-testid="printer-port-com"]') && !!document.querySelector('[data-testid="printer-port-refresh"]') && !!document.querySelector('[data-testid="printer-port-baud"]') && !!document.querySelector('[data-testid="printer-port-com-hint"]')`)
    await setPortType('bluetooth')
    results['Bluetooth port uses SPP discovery guidance'] = await evaluate(`!!document.querySelector('[data-testid="printer-port-com"]') && !!document.querySelector('[data-testid="printer-port-refresh"]') && !!document.querySelector('[data-testid="printer-port-bluetooth-hint"]') && document.body.innerText.includes('SPP 虚拟 COM')`)
    await setPortType('lpt')
    results['LPT port exposes LPT parameter'] = await evaluate(`document.querySelector('[data-testid="printer-port-lpt"]')?.value === 'LPT1'`)
    await setValue('[data-testid="printer-port-lpt"]', 'USB1')
    results['invalid LPT name blocks save'] = await evaluate(`!!document.querySelector('[data-testid="printer-port-error"]') && document.querySelector('[data-testid="printer-settings-save"]')?.disabled === true`)
    await setValue('[data-testid="printer-port-lpt"]', 'LPT2')
    await setPortType('driver')
    results['Windows driver port exposes installed-printer model selection'] = await evaluate(`!!document.querySelector('[data-testid="printer-port-driver-printer"]') && !!document.querySelector('[data-testid="printer-port-refresh-printers"]') && document.body.innerText.includes('Windows 打印机驱动型号')`)

    await click('[data-testid="printer-settings-cancel"]'); await sleep(100)
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
