/* P0-D：打印机自定义命令页与安装打印机对话框（print_printer_config.html / print_printer_labelshop.html）。 */
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
    const click = (selector) => evaluate(`(() => { const e=document.querySelector(${JSON.stringify(selector)}); if(!e||!e.isConnected||e.disabled)return false; e.click(); return true })()`)
    const clickExact = (label) => evaluate(`(() => { const e=[...document.querySelectorAll('button')].find((x)=>x.offsetParent&&(x.textContent||'').trim()===${JSON.stringify(label)}); if(!e)return false; e.click(); return true })()`)

    await sleep(1800)
    await evaluate('document.querySelector("button[aria-label=关闭]")?.click()')
    await evaluate('window.dispatchEvent(new KeyboardEvent("keydown",{key:"n",code:"KeyN",ctrlKey:true,bubbles:true,cancelable:true}))')
    await sleep(350)
    await click('[data-testid="wizard-next"]')
    await sleep(450)
    await evaluate(`(() => { const items=[...document.querySelectorAll('button')].filter((e)=>e.offsetParent&&(e.textContent||'').trim()==='选择'); items.at(-1)?.click(); return !!items.length })()`)
    await sleep(800)
    await evaluate('window.dispatchEvent(new KeyboardEvent("keydown",{key:"p",code:"KeyP",ctrlKey:true,bubbles:true,cancelable:true}))')
    await sleep(350)
    await click('[data-testid="print-dialog-printer-properties"]')
    await sleep(220)
    await click('[data-testid="printer-settings-command-tab"]')
    await sleep(100)

    results['D-31 自定义命令页显示开发手册参考说明'] = await evaluate(`(() => {
      const root=document.querySelector('[data-testid="printer-custom-command-section"]')
      const text=root?.innerText||''
      return !!root && text.includes('参考对应打印机开发手册') && text.includes('打印机参数命令') && text.includes('标签内容命令') && text.includes('打印后处理命令')
    })()`)
    results['D-32 打印机设置提供自定义命令入口'] = await evaluate('!!document.querySelector("[data-testid=printer-settings-command-tab]") && document.querySelector("[data-testid=printer-settings-command-tab]").textContent.trim() === "自定义命令" && document.querySelectorAll("[data-testid=printer-custom-command-section] textarea").length === 3')
    results['D-33 三类命令共用开发手册参考口径'] = await evaluate(`(() => {
      const labels=[...document.querySelectorAll('[data-testid="printer-custom-command-section"] label')].map((e)=>(e.textContent||'').trim())
      return labels.includes('打印机参数命令（作业开始前发送）') && labels.includes('标签内容命令（每张标签内容前发送）') && labels.includes('打印后处理命令（作业结束后发送）')
    })()`)

    await click('[data-testid="printer-settings-cancel"]')
    await sleep(120)
    await click('[aria-label="关闭打印对话框"]')
    await sleep(120)
    await evaluate('window.dispatchEvent(new KeyboardEvent("keydown",{key:"n",code:"KeyN",ctrlKey:true,bubbles:true,cancelable:true}))')
    await sleep(350)
    await click('[data-testid="wizard-next"]')
    await sleep(450)
    await click('[data-testid="new-label-install"]')
    await sleep(220)

    results['D-34 安装打印机提供安装与移除入口'] = await evaluate(`(() => {
      const root=document.querySelector('[data-testid="printer-install-dialog"]')
      const install=root?.querySelector('[data-testid="printer-install-submit"]')
      const remove=root?.querySelector('[data-testid="printer-install-remove"]')
      return !!root && install?.textContent.trim() === '安装' && remove?.textContent.trim() === '移除（卸载）'
    })()`)
    results['D-35 安装打印机列出集成品牌'] = await evaluate(`(() => {
      const options=[...document.querySelector('[data-testid="printer-install-brand"]')?.options||[]].map((e)=>(e.textContent||'').trim())
      return options.length >= 8 && options.includes('通用') && options.includes('佳博 Gprinter') && options.includes('斑马 Zebra')
    })()`)
    results['D-36 安装打印机列出指令集并说明其用途'] = await evaluate(`(() => {
      const text=document.querySelector('[data-testid="printer-install-guidance"]')?.innerText||''
      const options=[...document.querySelector('[data-testid="printer-install-driver"]')?.options||[]].map((e)=>(e.textContent||'').trim())
      return text.includes('指令集') && options.join('|').includes('TSPL') && options.join('|').includes('ZPL') && options.join('|').includes('CPCL')
    })()`)
    results['D-37 未收录型号提示尝试三套指令集'] = await evaluate(`(() => {
      const text=document.querySelector('[data-testid="printer-install-guidance"]')?.innerText||''
      return text.includes('未收录') && text.includes('ZPL') && text.includes('TSPL') && text.includes('CPCL') && text.includes('不保证')
    })()`)
    results['D-38 安装打印机分辨率枚举为203/300/600 dpi'] = await evaluate(`JSON.stringify([...document.querySelector('[data-testid="printer-install-dpi"]')?.options||[]].map((e)=>(e.textContent||'').trim())) === JSON.stringify(['203 dpi','300 dpi','600 dpi'])`)
    results['D-39 分辨率不匹配提示包含改选规则'] = await evaluate(`(() => {
      const text=document.querySelector('[data-testid="printer-install-guidance"]')?.innerText||''
      return text.includes('分辨率不匹配') && text.includes('偏大请改小分辨率') && text.includes('偏小请改大分辨率')
    })()`)

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
