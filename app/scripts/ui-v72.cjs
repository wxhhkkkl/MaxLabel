/* DIFF-12: choose-label dialog dimensions, dependent library filters and legacy button contract. */
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
    const waitFor = async (expression, timeout = 2500) => {
      const started = Date.now()
      while (Date.now() - started < timeout) {
        if (await evaluate(expression)) return true
        await sleep(80)
      }
      return false
    }
    const click = (selector) => evaluate(`(() => { const e=document.querySelector(${JSON.stringify(selector)}); if(!e || e.disabled)return false; e.click(); return true })()`)
    const setValue = (selector, value) => evaluate(`(() => {
      const e=document.querySelector(${JSON.stringify(selector)}); if(!e)return false
      const setter=Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype,'value')?.set || Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value')?.set
      setter.call(e,${JSON.stringify(String(value))})
      e.dispatchEvent(new Event('input',{bubbles:true})); e.dispatchEvent(new Event('change',{bubbles:true})); return true
    })()`)

    await sleep(1500)
    await evaluate('document.querySelector("button[aria-label=关闭]")?.click()')
    await evaluate('document.dispatchEvent(new KeyboardEvent("keydown",{key:"n",code:"KeyN",ctrlKey:true,bubbles:true}))')
    await sleep(350)
    if (await evaluate('!!document.querySelector("[data-testid=template-wizard]")')) await click('[data-testid="wizard-next"]')
    results['choose-label dialog opens from new document flow'] = await waitFor('!!document.querySelector("[data-testid=new-label-dialog]")')
    results['default record is 608053 with the reference dimensions'] = await evaluate(`(() => {
      const f=document.querySelector('[data-testid="new-label-format"]')
      return f?.value==='608053' && f?.selectedOptions[0]?.textContent.includes('100mm x 70mm 圆角8枚/页 20页/盒') &&
        document.querySelector('[data-testid="new-label-sheet-info"]')?.textContent.includes('纸张：  210 毫米 X  297 毫米') &&
        document.querySelector('[data-testid="new-label-label-info"]')?.textContent.includes('标签：  100.00 毫米 X 70.00 毫米')
    })()`)
    results['preview carries width and height annotations'] = await evaluate(`(() => {
      const text=document.querySelector('[data-testid="new-label-preview"]')?.textContent || ''
      return text.includes('100mm') && text.includes('70mm')
    })()`)
    results['brand and category filters use the imported library'] = await evaluate(`(() => {
      const brand=document.querySelector('[data-testid="new-label-brand"]')
      const type=document.querySelector('[data-testid="new-label-type"]')
      const formats=document.querySelector('[data-testid="new-label-format"]')
      // round-105 起按介质类型过滤目录：平张打印机下品牌 2 项、京成云马标签下类型 1 项、名称 42 项 + 自定义。
      // 修复前平张会混进 7 个卷筒类型（type 8 项），与真机 probe-09 不符。
      return brand?.options.length===2 && type?.options.length===1 && formats?.options.length===43
    })()`)
    results['select-label group contains printer install entry'] = await evaluate(`(() => {
      const group=document.querySelector('[data-testid="new-label-choose-group"]')
      return !!group && group.querySelector('[data-testid="new-label-install"]')?.textContent.trim()==='安装(I)'
    })()`)
    results['button order and accelerators match LabelShop'] = await evaluate(`(() => {
      const ids=['new-label-select','new-label-custom','new-label-cancel','new-label-help']
      const buttons=ids.map((id)=>document.querySelector('[data-testid="'+id+'"]'))
      return buttons.map((e)=>e ? e.textContent.trim() + e.getAttribute('data-access-suffix') : '').join('|')==='选择(O)|自定义(N)|取消(C)|帮助(H)' && buttons[0]?.getAttribute('accesskey')==='o' && buttons[0]?.style.outline.includes('dotted')
    })()`)
    results['choose dialog does not expose shape or hole controls'] = await evaluate(`(() => {
      const text=document.querySelector('[data-testid="new-label-dialog"]')?.innerText || ''
      return !text.includes('外观形状') && !text.includes('孔洞') && !text.includes('中心孔')
    })()`)
    await click('[data-testid="new-label-custom"]')
    results['custom button exposes dimensions without shape controls'] = await waitFor('!!document.querySelector("[data-testid=new-label-custom-fields]")') && await evaluate('!!document.querySelector("[data-testid=new-label-custom-width]") && !document.querySelector("[data-testid=new-label-dialog]")?.innerText.includes("外观形状")')

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
