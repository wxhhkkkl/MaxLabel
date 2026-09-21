/* C-90～C-101：标签格式设置四页签、预定义/自定义页面规则与用户格式回存。 */
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
    const click = (selector) => evaluate(`(() => { const e=document.querySelector(${JSON.stringify(selector)}); if(!e||e.disabled)return false; e.click(); return true })()`)
    const key = (name, options = {}) => evaluate(`(() => { const e=new KeyboardEvent('keydown',${JSON.stringify({ key: name, code: name, bubbles: true, cancelable: true, ...options })}); window.dispatchEvent(e); document.dispatchEvent(e); return true })()`)
    const setValue = (selector, value) => evaluate(`(() => { const e=document.querySelector(${JSON.stringify(selector)}); if(!e)return false; const proto=e instanceof HTMLSelectElement?HTMLSelectElement.prototype:HTMLInputElement.prototype; const setter=Object.getOwnPropertyDescriptor(proto,'value').set; setter.call(e,${JSON.stringify(String(value))}); e.dispatchEvent(new Event('input',{bubbles:true})); e.dispatchEvent(new Event('change',{bubbles:true})); return true })()`)

    await sleep(1800)
    await evaluate('document.querySelector("button[aria-label=关闭]")?.click()')
    await key('n', { ctrlKey: true }); await sleep(400)
    if (await evaluate('!!document.querySelector("[data-testid=template-wizard]")')) {
      await click('[data-testid="wizard-next"]'); await sleep(400)
    }
    results['new label format dialog is the new-template entry'] = await evaluate('!!document.querySelector("[data-testid=new-label-dialog]") && !!document.querySelector("[data-testid=new-label-select]")')
    results['preset and custom selection buttons are exposed'] = await evaluate('!!document.querySelector("[data-testid=new-label-custom]") && !!document.querySelector("[data-testid=new-label-cancel]")')
    await click('[data-testid="new-label-select"]'); await sleep(700)
    results['selecting a preset enters the editor'] = await evaluate('!!document.querySelector("[data-testid=canvas-host]") || !!document.querySelector("canvas")')

    await click('button[title="标签格式设置"]'); await sleep(350)
    results['template properties has four tabs and defaults to label'] = await evaluate(`(() => {
      const d=document.querySelector('[data-testid=template-props-dialog]')
      const tabs=[...document.querySelectorAll('[data-testid^="template-props-tab-"]')].map((e)=>e.textContent.trim())
      return !!d && JSON.stringify(tabs)===JSON.stringify(['打印机','页面','标签','其它']) && document.querySelector('[data-testid="template-props-tab-label"]')?.getAttribute('aria-selected')==='true'
    })()`)

    await click('[data-testid="template-props-tab-page"]'); await sleep(120)
    results['preset page settings are read-only'] = await evaluate('document.querySelector("[data-testid=template-page-size]")?.disabled === true && document.querySelector("[data-testid=template-page-width]")?.readOnly === true && document.querySelector("[data-testid=template-page-height]")?.readOnly === true && document.querySelector("[data-testid=template-page-left]")?.readOnly === true && document.querySelector("[data-testid=template-page-top]")?.readOnly === true')
    // 真机「页面」页另有 左空(L)/上空(T)（系统格式下同样灰禁，probe-26-tab-page.png）
    results['page tab exposes 左空/上空 margins (真机页面页)'] = await evaluate(`(() => {
      const left=document.querySelector('[data-testid=template-page-left]')
      const top=document.querySelector('[data-testid=template-page-top]')
      if(!left || !top) return false
      const text=document.querySelector('[data-testid=template-props-dialog]')?.innerText||''
      return text.includes('左空') && text.includes('上空')
    })()`)
    results['page size offers A4 and millimetre fields'] = await evaluate(`(() => { const s=document.querySelector('[data-testid=template-page-size]'); return [...(s?.options||[])].some((o)=>o.textContent.includes('A4') && o.textContent.includes('210')) && !!document.querySelector('[data-testid=template-page-width]') && !!document.querySelector('[data-testid=template-page-height]') })()`)

    await click('[data-testid="template-props-tab-printer"]'); await sleep(120)
    results['printer tab exposes saved output mode'] = await evaluate('document.body.innerText.includes("输出方式") && document.body.innerText.includes("Windows 驱动方式输出") && document.body.innerText.includes("打印机指令方式输出") && document.body.innerText.includes("随模板一起保存")')
    await click('[data-testid="template-props-tab-other"]'); await sleep(120)
    results['other tab exposes four start positions and two directions'] = await evaluate(`(() => {
      const selects=[...document.querySelectorAll('[data-testid=template-props-dialog] select')]
      const optionText=selects.flatMap((s)=>[...s.options].map((o)=>o.textContent.trim()))
      return ['左上角','右上角','左下角','右下角'].every((x)=>optionText.includes(x)) && optionText.includes('先行后列（水平方向）') && optionText.includes('先列后行（垂直方向）')
    })()`)
    results['other tab exposes left/top print offsets'] = await evaluate('document.body.innerText.includes("位置微调：左侧") && document.body.innerText.includes("位置微调：顶部")')
    results['other tab exposes left-to-right and right-to-left directions'] = await evaluate(`(() => {
      const text=document.body.innerText
      return text.includes('标签打印机首选方向') && text.includes('从左到右') && text.includes('从右到左')
    })()`)
    results['custom format save requires and exposes a format name'] = await evaluate('!!document.querySelector("[data-testid=template-format-name]") && !!document.querySelector("[data-testid=template-format-save]")')

    await click('[data-testid="template-format-save"]'); await sleep(500)
    results['saved format can be reopened from the template library path'] = await evaluate(`(async () => {
      const list=await window.maxlabel.listTemplates()
      const item=(list.items||[]).find((x)=>x.name==='未命名标签（格式）' || x.name.includes('（格式）'))
      if(!item) return false
      const opened=await window.maxlabel.openTemplatePath(item.path)
      if(!opened?.content) return false
      const doc=JSON.parse(opened.content)
      return doc.formatKind==='custom' && doc.layout?.pageWidthMm>0 && doc.layout?.pageHeightMm>0
    })()`)

    await click('[data-testid="template-props-tab-label"]'); await sleep(80)
    await evaluate('document.querySelector("[data-testid=template-props-dialog] button[aria-label=关闭]")?.click()')
    await key('n', { ctrlKey: true }); await sleep(350)
    if (await evaluate('!!document.querySelector("[data-testid=template-wizard]")')) {
      await click('[data-testid="wizard-next"]'); await sleep(350)
    }
      await click('[data-testid="new-label-custom"]'); await sleep(100)
      await setValue('[data-testid="new-label-custom-width"]', '80')
      await setValue('[data-testid="new-label-custom-height"]', '50')
      await click('[data-testid="custom-label-confirm"]'); await sleep(600)
    await click('button[title="标签格式设置"]'); await sleep(300)
    await click('[data-testid="template-props-tab-page"]'); await sleep(100)
    results['custom page settings are editable'] = await evaluate('document.querySelector("[data-testid=template-page-size]")?.disabled === false && document.querySelector("[data-testid=template-page-width]")?.readOnly === false && document.querySelector("[data-testid=template-page-left]")?.readOnly === false')
    await setValue('[data-testid="template-page-width"]', '123'); await sleep(100)
    results['custom page width accepts millimetre input'] = await evaluate('document.querySelector("[data-testid=template-page-width]")?.value === "123"')
    await setValue('[data-testid="template-page-left"]', '7.5'); await sleep(100)
    await setValue('[data-testid="template-page-top"]', '3'); await sleep(100)
    results['custom 左空/上空 accepts millimetre input (真机页面页)'] = await evaluate('document.querySelector("[data-testid=template-page-left]")?.value === "7.5" && document.querySelector("[data-testid=template-page-top]")?.value === "3"')
    await setValue('[data-testid="template-page-size"]', 'a4'); await sleep(100)
    results['selecting A4 applies 210 by 297 millimetres'] = await evaluate('document.querySelector("[data-testid=template-page-width]")?.value === "210" && document.querySelector("[data-testid=template-page-height]")?.value === "297"')

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
