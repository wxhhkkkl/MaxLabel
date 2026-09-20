/*
 * 「打印机属性 → 端口」对话框，逐项对齐真机取证（round-106）：
 *   parity/reference/labelshop/probe-14-printer-props-combos.txt
 *   （真机 <打印机名> 属性 对话框：类型(T) 下拉 7 项；类型=USB 时「端口(O)」下拉列出
 *     `USB001 (Gprinter GP-1324D)`，并有「刷新USB端口」按钮与提示「请连接USB打印机，并打开打印机电源。」）
 *
 * 修复前：端口类型只有 6 项（缺「蜂打打云盒」），且文字与真机不同
 * （打印机端口（LPT）/打印机端口（COM）/蓝牙（SPP）/Windows 打印机驱动端口）；
 * USB 类型只有一句静态提示，没有「端口(O)」列表、没有刷新按钮。
 */
const http = require('http')
const WebSocket = require('ws')

const EXPECTED_TYPES = ['打印机端口(LPT)', '串行端口(COM)', '标准 TCP/IP 打印机端口', 'USB 打印机端口', '蓝牙', '蜂打打云盒', '打印机驱动程序端口']

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
    const click = (selector) => evaluate(`(() => { const e=document.querySelector(${JSON.stringify(selector)}); if(!e || e.disabled) return false; e.click(); return true })()`)
    const setSelect = (selector, value) => evaluate(`(() => {
      const el=document.querySelector(${JSON.stringify(selector)}); if(!el) return false
      const setter=Object.getOwnPropertyDescriptor(window.HTMLSelectElement.prototype,'value').set
      setter.call(el, ${JSON.stringify(value)})
      el.dispatchEvent(new Event('change',{bubbles:true}))
      return true })()`)
    const waitFor = async (expression, timeout = 8000) => {
      const started = Date.now()
      while (Date.now() - started < timeout) {
        if (await evaluate(expression)) return true
        await sleep(80)
      }
      return false
    }
    const openPortTab = async () => {
      await evaluate('window.dispatchEvent(new KeyboardEvent("keydown",{key:"p",code:"KeyP",ctrlKey:true,bubbles:true,cancelable:true}))')
      await sleep(400)
      await click('[data-testid="print-dialog-printer-properties"]')
      await sleep(320)
      await click('[data-testid="printer-settings-port-tab"]')
      await sleep(200)
    }

    await sleep(1800)
    await evaluate('document.querySelector("button[aria-label=关闭]")?.click()')
    await evaluate('localStorage.removeItem("maxlabel.defaultPrinter")')
    // 新建一个文档进编辑器（打印机属性入口在打印对话框里）
    await evaluate('window.dispatchEvent(new KeyboardEvent("keydown",{key:"n",code:"KeyN",ctrlKey:true,bubbles:true,cancelable:true}))')
    await sleep(400)
    await click('[data-testid="wizard-next"]')
    await sleep(450)
    await evaluate(`(() => { const items=[...document.querySelectorAll('button')].filter((e)=>e.offsetParent&&(e.textContent||'').trim()==='选择'); items.at(-1)?.click(); return !!items.length })()`)
    await waitFor('!!document.querySelector("canvas.upper-canvas")', 9000)
    await sleep(400)
    await openPortTab()

    results['端口页打开（打印机属性 → 端口）'] = await evaluate('!!document.querySelector("[data-testid=printer-settings-port]")')
    const typeLabels = await evaluate(`[...(document.querySelector('[data-testid="printer-port-type"]')?.options||[])].map((o)=>o.textContent.trim())`)
    results['类型(T) 下拉前 7 项文字与顺序同真机（含蜂打打云盒）'] = JSON.stringify(typeLabels.slice(0, 7)) === JSON.stringify(EXPECTED_TYPES)
    results['类型(T) 仍保留「打印到文件」选项'] = Array.isArray(typeLabels) && typeLabels.includes('打印到文件')

    // ---- USB 打印机端口 ----
    await setSelect('[data-testid="printer-port-type"]', 'usb')
    await sleep(260)
    results['选 USB 后出现「端口(O)」下拉 + 「刷新USB端口」按钮'] = await evaluate(`!!document.querySelector('[data-testid="printer-port-usb"]') && document.querySelector('[data-testid="printer-port-refresh-usb"]')?.textContent.trim()==='刷新USB端口'`)
    results['USB 提示文字与真机一致（请连接USB打印机，并打开打印机电源。）'] = await evaluate(`document.querySelector('[data-testid="printer-port-usb-hint"]')?.textContent.trim()==='请连接USB打印机，并打开打印机电源。'`)
    await waitFor(`(() => { const s=document.querySelector('[data-testid="printer-port-usb"]'); return !!s && [...s.options].some((o)=>/^USB\\d+ \\(/.test(o.textContent.trim())) })()`, 8000)
    const usbOptions = await evaluate(`[...(document.querySelector('[data-testid="printer-port-usb"]')?.options||[])].map((o)=>o.textContent.trim()).filter((t)=>t && !t.startsWith('正在检测'))`)
    results['USB 端口列表带出真机同款条目（USB001 (Gprinter GP-1324D)）'] = usbOptions.some((t) => /^USB\d+ \(Gprinter GP-1324D\)$/.test(t))
    // 未选端口时不允许保存
    await setSelect('[data-testid="printer-port-usb"]', '')
    await sleep(220)
    results['USB 未选端口时「保存」禁用（端口校验生效）'] = await evaluate(`document.querySelector('[data-testid="printer-settings-save"]')?.disabled === true`)

    // ---- 其余端口类型 ----
    await setSelect('[data-testid="printer-port-type"]', 'com')
    await sleep(220)
    results['选 串行端口(COM) 后出现 COM 下拉与刷新按钮'] = await evaluate(`!!document.querySelector('[data-testid="printer-port-com"]') && !!document.querySelector('[data-testid="printer-port-refresh"]')`)
    // 真机 COM 的 5 项参数与选项（probe-18-com-port-combos.txt）
    results['COM 的 5 项参数与选项同真机（速率15档/数据位/奇偶/停止位/流控制）'] = await evaluate(`(() => {
      const q=(s)=>document.querySelector(s)
      const opts=(s)=>[...(q(s)?.options||[])].map((o)=>o.textContent.trim())
      return JSON.stringify(opts('[data-testid="printer-port-databits"]'))===JSON.stringify(['7','8'])
        && JSON.stringify(opts('[data-testid="printer-port-parity"]'))===JSON.stringify(['无','奇','偶','标志','空格'])
        && JSON.stringify(opts('[data-testid="printer-port-stopbits"]'))===JSON.stringify(['1','1.5','2'])
        && JSON.stringify(opts('[data-testid="printer-port-flow"]'))===JSON.stringify(['无','硬件（RTS/CTS）','软件（XON/XOFF）'])
        && (q('[data-testid="printer-port-baud"]')?.options.length||0)===15
        && q('[data-testid="printer-port-baud"]')?.value==='9600'
    })()`)
    await setSelect('[data-testid="printer-port-type"]', 'lpt')
    await sleep(220)
    results['选 打印机端口(LPT) 后出现 LPT 输入框'] = await evaluate(`!!document.querySelector('[data-testid="printer-port-lpt"]')`)
    await setSelect('[data-testid="printer-port-type"]', 'cloudbox')
    await sleep(220)
    results['选 蜂打打云盒 后出现 IP/端口输入与云盒说明'] = await evaluate(`!!document.querySelector('[data-testid="printer-port-host"]') && !!document.querySelector('[data-testid="printer-port-number"]') && !!document.querySelector('[data-testid="printer-port-cloudbox-hint"]')`)
    await setSelect('[data-testid="printer-port-type"]', 'driver')
    await sleep(220)
    results['选 打印机驱动程序端口 后出现 Windows 打印机下拉'] = await evaluate(`!!document.querySelector('[data-testid="printer-port-driver-printer"]')`)

    // ---- 保存并回读 USB 端口 ----
    await setSelect('[data-testid="printer-port-type"]', 'usb')
    await sleep(240)
    const chosenUsb = usbOptions.find((t) => /^USB\d+ \(Gprinter GP-1324D\)$/.test(t)) || usbOptions[0]
    await setSelect('[data-testid="printer-port-usb"]', chosenUsb)
    await sleep(200)
    await click('[data-testid="printer-settings-save"]')
    await sleep(400)
    await openPortTab()
    results['保存后重开：USB 端口回读一致'] = await evaluate(`document.querySelector('[data-testid="printer-port-type"]')?.value==='usb' && document.querySelector('[data-testid="printer-port-usb"]')?.value === ${JSON.stringify(chosenUsb)}`)

    let pass = 0
    for (const [name, value] of Object.entries(results)) { console.log((value ? 'PASS ' : 'FAIL ') + name + ' => ' + value); if (value) pass++ }
    console.log(`\n${pass}/${Object.keys(results).length} PASS`)
    client.ws.close()
    process.exit(pass === Object.keys(results).length ? 0 : 1)
  } catch (error) {
    console.error('ERR', error.message)
    for (const [name, value] of Object.entries(results)) console.log((value ? 'PASS ' : 'FAIL ') + name + ' => ' + value)
    if (client) client.ws.close()
    process.exit(2)
  }
})()
