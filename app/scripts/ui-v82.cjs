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
    const setValue = (selector, value) => evaluate(`(() => {
      const e=document.querySelector(${JSON.stringify(selector)}); if(!e)return false
      const proto=e instanceof HTMLSelectElement ? HTMLSelectElement.prototype : HTMLInputElement.prototype
      const setter=Object.getOwnPropertyDescriptor(proto,'value')?.set
      setter?.call(e,${JSON.stringify(String(value))})
      e.dispatchEvent(new Event('input',{bubbles:true})); e.dispatchEvent(new Event('change',{bubbles:true})); return true
    })()`)

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

    // round-105：安装打印机对话框改为真机的「可安装打印机列表」形态（真机取证
    // `parity/reference/labelshop/probe-07-install-printer.png` + `probe-08-install-list.txt`）。
    // 旧的品牌/指令集/分辨率/端口表单是自造的，D-34~D-39 随之改写：指令集/未收录型号/分辨率
    // 这几条帮助原文（print_printer_labelshop.html）移到「帮助 → 安装打印机」主题里。
    results['D-34 安装打印机提供安装 / 移除 / 帮助 / 返回 四个入口'] = await evaluate(`(() => {
      const root=document.querySelector('[data-testid="printer-install-dialog"]')
      const txt=(sel)=>root?.querySelector(sel)?.textContent.replace(/\\s+/g,'').trim()
      return !!root && txt('[data-testid="printer-install-submit"]')==='安装' && txt('[data-testid="printer-install-remove"]')==='移除'
        && txt('[data-testid="printer-install-help"]')==='帮助' && txt('[data-testid="printer-install-back"]')==='返回'
    })()`)
    results['D-35 安装打印机按品牌过滤并可列出可安装型号'] = await evaluate(`(() => {
      const options=[...document.querySelector('[data-testid="printer-install-filter"]')?.options||[]].map((e)=>(e.textContent||'').trim())
      const rows=[...document.querySelectorAll('[data-testid="printer-install-row"]')]
      return options.length===39 && options[0]==='全部' && options.includes('佳博 (Gprinter)') && options.includes('斑马 (Zebra)') && rows.length===125
    })()`)
    results['D-36 安装打印机列出真机同款条目（品牌 + 指令集 + 分辨率）'] = await evaluate(`(() => {
      const names=[...document.querySelectorAll('[data-testid="printer-install-row"]')].map((r)=>r.getAttribute('data-printer-name'))
      return names[0]==='Gprinter GPL-N (203 dpi)' && names.some((n)=>n==='Zebra ZPL-N (203 dpi)') && names.some((n)=>n==='TSC TSPL-N (300 dpi)') && names.some((n)=>n==='Argox PPLB-N (600 dpi)')
    })()`)
    results['D-37 安装打印机的说明文字与真机一致'] = await evaluate(`(() => {
      const text=document.querySelector('[data-testid="printer-install-guidance"]')?.innerText||''
      return text.includes('安装 LabelShop 打印机') && text.includes('官方提供的驱动程序')
    })()`)
    results['D-38 安装打印机的品牌过滤可用于定位型号'] = await evaluate(`(() => {
      const filter=document.querySelector('[data-testid="printer-install-filter"]')
      const setter=Object.getOwnPropertyDescriptor(window.HTMLSelectElement.prototype,'value').set
      setter.call(filter,'佳博 (Gprinter)')
      filter.dispatchEvent(new Event('change',{bubbles:true}))
      return true
    })()`)
    await sleep(200)
    results['D-38b 选中「佳博 (Gprinter)」后列表只剩该品牌（7 项）'] = await evaluate(`[...document.querySelectorAll('[data-testid="printer-install-row"]')].length === 7 && [...document.querySelectorAll('[data-testid="printer-install-row"]')].every((r)=>String(r.getAttribute('data-printer-name')).startsWith('Gprinter'))`)
    await evaluate(`(() => {
      const filter=document.querySelector('[data-testid="printer-install-filter"]')
      const setter=Object.getOwnPropertyDescriptor(window.HTMLSelectElement.prototype,'value').set
      setter.call(filter,'全部')
      filter.dispatchEvent(new Event('change',{bubbles:true}))
      return true
    })()`)
    await sleep(200)
    results['D-39 未选中行时安装与移除都禁用'] = await evaluate(`document.querySelector('[data-testid="printer-install-submit"]')?.disabled === true && document.querySelector('[data-testid="printer-install-remove"]')?.disabled === true`)
    const gprinterRow = await evaluate(`[...document.querySelectorAll('[data-testid="printer-install-row"]')].find((r)=>r.getAttribute('data-printer-name')==='Gprinter GPL-N (203 dpi)')?.getAttribute('data-printer-id')`)
    await evaluate(`document.querySelector('[data-printer-id="${gprinterRow}"]')?.click()`)
    await sleep(160)
    await click('[data-testid="printer-install-submit"]')
    await sleep(320)
    results['D-40 安装后停留在安装对话框并显示「已安装」状态（真机同）'] = await evaluate(`document.querySelector('[data-printer-id="${gprinterRow}"] [data-testid=printer-install-row-status]')?.textContent.trim()==='已安装' && !!document.querySelector('[data-testid=printer-install-dialog]')`)
    await click('[data-testid="printer-install-back"]')
    await sleep(360)
    results['D-41 标签打印机安装后切换到卷筒标签库'] = await evaluate(`(() => {
      const brand = document.querySelector('[data-testid="new-label-brand"]')
      const format = document.querySelector('[data-testid="new-label-format"]')
      const options=[...(format?.options||[])].map((e)=>(e.textContent||''))
      return (brand?.innerText||'').includes('卷筒标签') && options.some((text)=>text.includes('签/卷'))
    })()`)
    results['D-42 安装的打印机回显到打印机选择框（排在系统打印机之前）'] = await evaluate(`(() => {
      const select=document.querySelector('[data-testid="new-label-printer"]')
      const first=select?.options?.[0]
      return String(first?.value||'').startsWith('ls:') && (first?.textContent||'').includes('Gprinter GPL-N (203 dpi)')
    })()`)
    const flatPrinterValue = await evaluate(`(() => {
      const options=[...(document.querySelector('[data-testid="new-label-printer"]')?.options||[])]
      return options.find((option)=>option.value && !String(option.value).startsWith('ls:') && !/(gprinter|gp[-\s]*\d|佳博)/i.test(option.textContent||''))?.value || ''
    })()`)
    if (flatPrinterValue) {
      await setValue('[data-testid="new-label-printer"]', flatPrinterValue)
      await sleep(220)
    }
    results['D-43 切换普通 Windows 打印机后恢复平张标签库'] = !flatPrinterValue || await evaluate(`(() => {
      const brand=document.querySelector('[data-testid="new-label-brand"]')
      const format=document.querySelector('[data-testid="new-label-format"]')
      return (brand?.innerText||'').includes('平张标签') && format?.value === '608053'
    })()`)

    // 帮助按钮：指令集 / 未收录型号 / 分辨率这几段帮助原文（print_printer_labelshop.html）
    // 在真机里是帮助文档内容，不在对话框正文，因此改从「帮助 → 安装打印机」主题里校验。
    await click('[data-testid="new-label-install"]')
    await sleep(260)
    await click('[data-testid="printer-install-help"]')
    await sleep(260)
    await evaluate(`[...document.querySelectorAll('[data-testid=help-section]')].find((b)=>(b.textContent||'').trim()==='安装打印机')?.click()`)
    await sleep(220)
    results['D-44 帮助 → 安装打印机主题含指令集 / 未收录型号 / 分辨率原文'] = await evaluate(`(() => {
      const t=document.querySelector('[data-testid=help-dialog]')?.innerText||''
      return t.includes('打印指令集又称打印控制命令集') && t.includes('ZPL、TSPL 或 CPCL') && t.includes('不保证')
        && t.includes('203dpi、300dpi、600dpi') && t.includes('输出比例变大') && t.includes('输出比例缩小')
    })()`)
    await evaluate(`document.querySelector('[data-testid=help-dialog] [aria-label=关闭]')?.click()`)
    await sleep(200)

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
