/*
 * 打印机属性 →「工具」页，逐项对齐真机取证（round-107）：
 *   parity/reference/labelshop/probe-16-props-tools-tab.png（操作=发送打印机命令）
 *   parity/reference/labelshop/probe-17-tools-sendfile.png（操作=发送文件到打印机）
 *   parity/reference/labelshop/probe-16-tools-tab-combos.txt（操作下拉 2 项）
 *
 * 真机：属性对话框第 4 个页签「工具」，分组「常用」，`操作：` 下拉 2 项
 * （发送打印机命令 / 发送文件到打印机）+ `执行` 按钮 + 下方输出区；
 * 点「执行」在「发送文件到打印机」模式下会弹 Windows「打开」对话框选文件。
 *
 * 修复前：复刻版只有 首选项 / 端口 / 自定义命令 三个页签，整页缺失。
 */
const http = require('http')
const WebSocket = require('ws')

const EXPECTED_ACTIONS = ['发送打印机命令', '发送文件到打印机']

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
    const setValue = (selector, value) => evaluate(`(() => {
      const el=document.querySelector(${JSON.stringify(selector)}); if(!el) return false
      const proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : el instanceof HTMLSelectElement ? HTMLSelectElement.prototype : HTMLInputElement.prototype
      const setter=Object.getOwnPropertyDescriptor(proto,'value').set
      setter.call(el, ${JSON.stringify(String(value))})
      el.dispatchEvent(new Event('input',{bubbles:true})); el.dispatchEvent(new Event('change',{bubbles:true})); return true })()`)
    const waitFor = async (expression, timeout = 8000) => {
      const started = Date.now()
      while (Date.now() - started < timeout) {
        if (await evaluate(expression)) return true
        await sleep(80)
      }
      return false
    }
    const outputText = () => evaluate(`document.querySelector('[data-testid="printer-tools-output"]')?.innerText || ''`)
    const openProps = async () => {
      await evaluate('window.dispatchEvent(new KeyboardEvent("keydown",{key:"p",code:"KeyP",ctrlKey:true,bubbles:true,cancelable:true}))')
      await sleep(400)
      await click('[data-testid="print-dialog-printer-properties"]')
      await sleep(320)
    }

    await sleep(1800)
    await evaluate('document.querySelector("button[aria-label=关闭]")?.click()')
    await evaluate('localStorage.removeItem("maxlabel.defaultPrinter")')
    await evaluate('window.dispatchEvent(new KeyboardEvent("keydown",{key:"n",code:"KeyN",ctrlKey:true,bubbles:true,cancelable:true}))')
    await sleep(400)
    await click('[data-testid="wizard-next"]')
    await sleep(450)
    await evaluate(`(() => { const items=[...document.querySelectorAll('button')].filter((e)=>e.offsetParent&&(e.textContent||'').trim()==='选择'); items.at(-1)?.click(); return !!items.length })()`)
    await waitFor('!!document.querySelector("canvas.upper-canvas")', 9000)
    await sleep(400)

    // 先把端口设成 TCP/IP（127.0.0.1:9，无监听 → 发送必定失败但链路可判定），便于「执行」在无打印机下也能跑通
    await openProps()
    await click('[data-testid="printer-settings-port-tab"]'); await sleep(200)
    await setValue('[data-testid="printer-port-type"]', 'tcp'); await sleep(200)
    // round-111：TCP/IP 用四段 IP 输入（SysIPAddress32 形态）
    await setValue('[data-testid="printer-port-ip-1"]', '127'); await sleep(90)
    await setValue('[data-testid="printer-port-ip-2"]', '0'); await sleep(90)
    await setValue('[data-testid="printer-port-ip-3"]', '0'); await sleep(90)
    await setValue('[data-testid="printer-port-ip-4"]', '1'); await sleep(120)
    await setValue('[data-testid="printer-port-number"]', '9'); await sleep(150)
    await click('[data-testid="printer-settings-save"]'); await sleep(350)

    // ---------- 工具页 ----------
    await openProps()
    results['属性对话框有第 4 个页签「工具」（真机同）'] = await evaluate(`document.querySelector('[data-testid="printer-settings-tools-tab"]')?.textContent.trim() === '工具'`)
    await click('[data-testid="printer-settings-tools-tab"]'); await sleep(220)
    results['工具页打开且分组标题为「常用」'] = await evaluate(`(() => { const root=document.querySelector('[data-testid="printer-settings-tools"]'); return !!root && (root.innerText||'').includes('常用') })()`)
    const actions = await evaluate(`[...(document.querySelector('[data-testid="printer-tools-action"]')?.options||[])].map((o)=>o.textContent.trim())`)
    results['操作下拉 2 项且文字同真机'] = JSON.stringify(actions) === JSON.stringify(EXPECTED_ACTIONS)
    results['有「执行」按钮'] = await evaluate(`document.querySelector('[data-testid="printer-tools-run"]')?.textContent.trim()==='执行'`)

    // 空命令 → 提示
    await click('[data-testid="printer-tools-run"]'); await sleep(300)
    results['命令为空时「执行」提示请输入命令'] = (await outputText()).includes('请输入要发送的打印机命令')

    // 输入命令 → 执行 → 输出含字节数与结果
    await setValue('[data-testid="printer-tools-command"]', 'SIZE 100 mm,150 mm')
    await sleep(150)
    await click('[data-testid="printer-tools-run"]')
    await waitFor(`(document.querySelector('[data-testid="printer-tools-output"]')?.innerText||'').includes('发送命令')`, 12000)
    const cmdOut = await outputText()
    results['发送打印机命令：输出含发送字节数与结果'] = cmdOut.includes('发送命令') && /发送命令（\d+ 字节）→ (成功|失败)/.test(cmdOut)
    results['发送打印机命令走的是当前端口（TCP 127.0.0.1:9）'] = await evaluate(`(document.querySelector('[data-testid="printer-settings-tools"]')?.innerText||'').includes('输出端口：tcp')`)

    // 切到发送文件
    await setValue('[data-testid="printer-tools-action"]', 'send-file'); await sleep(220)
    results['选「发送文件到打印机」后出现文件输入与选择文件按钮'] = await evaluate(`!!document.querySelector('[data-testid="printer-tools-file"]') && !!document.querySelector('[data-testid="printer-tools-browse"]')`)
    await click('[data-testid="printer-tools-run"]'); await sleep(300)
    results['文件为空时「执行」提示先选择文件'] = (await outputText()).includes('请先选择要发送的文件')
    await setValue('[data-testid="printer-tools-file"]', 'D:\\__maxlabel_missing__\\nope.prn')
    await sleep(150)
    await click('[data-testid="printer-tools-run"]')
    await waitFor(`(document.querySelector('[data-testid="printer-tools-output"]')?.innerText||'').includes('发送文件')`, 12000)
    results['发送文件：不存在的文件被拒绝并给出失败原因'] = /发送文件 .* → 失败/.test(await outputText())

    // ---------- USB 端口：走打印后台（spooler）raw 写入 ----------
    await click('[data-testid="printer-settings-cancel"]')  // 关掉属性对话框
    await sleep(300)
    await openProps()
    await click('[data-testid="printer-settings-port-tab"]'); await sleep(220)
    await setValue('[data-testid="printer-port-type"]', 'usb'); await sleep(260)
    await waitFor(`/^USB\\d+ \\(/.test(document.querySelector('[data-testid="printer-port-usb"]')?.value || '')`, 8000)
    const usbValue = await evaluate(`document.querySelector('[data-testid="printer-port-usb"]')?.value || ''`)
    await click('[data-testid="printer-settings-save"]'); await sleep(360)
    await openProps()
    await click('[data-testid="printer-settings-tools-tab"]'); await sleep(240)
    await setValue('[data-testid="printer-tools-action"]', 'send-command'); await sleep(200)
    await setValue('[data-testid="printer-tools-command"]', 'SIZE 100 mm,150 mm'); await sleep(150)
    await click('[data-testid="printer-tools-run"]')
    await waitFor(`(document.querySelector('[data-testid="printer-tools-output"]')?.innerText||'').includes('发送命令')`, 15000)
    const usbOut = await outputText()
    results['USB 端口已选中枚举到的设备（USB00x (…)）'] = /^USB\d+ \(/.test(usbValue)

    // 期望值取自**环境本身**，不再写死某一条分支。
    //
    // 原来这里断言的是「输出里必须有『没有找到 Windows 打印队列』」——它把
    // 「本机所选 USB 端口上恰好没有打印队列」当成了恒定前提。2026-09-23 本机给
    // Gprinter GP-1324D 装上了 Generic/Text Only 驱动，USB001 上出现队列，
    // 打印后台于是走了**另一条同样正确**的分支（RAW 写入队列），这条断言就变成了假红
    // （round-140 门禁；单跑复现的实测输出是
    //  `发送命令（18 字节）→ 成功：已通过打印队列 Gprinter GP-1324D (USB) 发送 18 字节（RAW）`）。
    // 产品两条分支的行为都是对的（见 commandTransport.ts 的 writeRawToWindowsQueue 注释），
    // 所以修的是**断言的取期望方式**：用 listPrinters() 的 port 列（DIFF-91 增补的真实端口，
    // 与打印后台查的同一个 Win32_Printer.PortName）判断该端口上有没有队列，再据此要求对应输出。
    // 这比原来那条更严：它现在把**两条分支**都钉住了，而不是只覆盖有无队列里的一种。
    const usbPort = (usbValue.match(/^(USB\d+)/) || [])[1] || ''
    const printers = await evaluate(`window.maxlabel.listPrinters().then((r) => (r.printers ?? []).map((p) => ({ name: p.name, displayName: p.displayName || p.name, port: p.port || '' })))`)
    const usbQueue = (Array.isArray(printers) ? printers : []).find((p) => (p.port || '').toUpperCase() === usbPort.toUpperCase()) || null

    results['USB 已解析出端口名（判定走哪条分支的依据）'] = /^USB\d+$/.test(usbPort)
    results['USB 发送走打印后台：输出与「该端口上有没有打印队列」一致（有队列→RAW 写入并列队列名与字节数；无队列→提示装官方驱动）'] =
      usbQueue
        ? usbOut.includes(`已通过打印队列 ${usbQueue.displayName}`) && usbOut.includes('RAW') && /发送 \d+ 字节/.test(usbOut)
        : usbOut.includes('没有找到 Windows 打印队列') && usbOut.includes('请先安装该打印机的官方驱动')
    results['USB 发送没退化成静默失败（必须是成功发送或明确的装驱动提示，不能是其它错误）'] =
      usbOut.includes('发送命令') && (/→ 成功/.test(usbOut) || usbOut.includes('没有找到 Windows 打印队列'))

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
