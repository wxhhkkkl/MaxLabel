/* round-105 P0：选择标签格式的自定义入口与统一圆角规则。 */
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
    ws.on('message', (raw) => {
      const message = JSON.parse(raw.toString())
      const item = pending.get(message.id)
      if (!item) return
      pending.delete(message.id)
      if (message.error) item.reject(new Error(message.error.message))
      else item.resolve(message.result)
    })
    ws.on('open', () => resolve({ ws, send: (method, params = {}) => new Promise((resolveSend, rejectSend) => {
      const messageId = ++id
      pending.set(messageId, { resolve: resolveSend, reject: rejectSend })
      ws.send(JSON.stringify({ id: messageId, method, params }))
    }) }))
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
    const setValue = (selector, value) => evaluate(`(() => {
      const e=document.querySelector(${JSON.stringify(selector)}); if(!e)return false
      const proto=e instanceof HTMLSelectElement?HTMLSelectElement.prototype:HTMLInputElement.prototype
      Object.getOwnPropertyDescriptor(proto,'value').set.call(e,${JSON.stringify(String(value))})
      e.dispatchEvent(new Event('input',{bubbles:true})); e.dispatchEvent(new Event('change',{bubbles:true})); return true
    })()`)
    const waitFor = async (expression, timeout = 7000) => {
      const started = Date.now()
      while (Date.now() - started < timeout) {
        if (await evaluate(expression)) return true
        await sleep(80)
      }
      return false
    }

    await sleep(1500)
    await evaluate('document.querySelector("button[aria-label=关闭]")?.click()')
    await evaluate('document.dispatchEvent(new KeyboardEvent("keydown",{key:"n",code:"KeyN",ctrlKey:true,bubbles:true,cancelable:true}))')
    await sleep(420)
    if (await evaluate('!!document.querySelector("[data-testid=template-wizard]")')) await click('[data-testid="wizard-next"]')
    if (!await waitFor('!!document.querySelector("[data-testid=new-label-dialog]")')) throw new Error('choose-label dialog did not open')

    const chooseOptions = await evaluate(`[...document.querySelector('[data-testid="new-label-format"]')?.options||[]].map((o)=>o.textContent.trim())`)
    results['C-76 标签名称下拉共 42 项且没有自定义项'] = Array.isArray(chooseOptions) && chooseOptions.length === 42 && !chooseOptions.includes('自定义')
    results['C-76 预览圆角使用共享 1mm 弧半径'] = await evaluate(`([...document.querySelectorAll('[data-testid="new-label-preview"] path')].map((e)=>e.getAttribute('d')||'').some((d)=>d.includes('A 1 1')))`)

    await click('[data-testid="new-label-custom"]')
    if (!await waitFor('!!document.querySelector("[data-testid=custom-label-dialog]")')) throw new Error('custom dialog did not open')
    results['C-81 自定义入口标题与四页签顺序匹配真机'] = await evaluate(`(() => {
      const d=document.querySelector('[data-testid="custom-label-dialog"]')
      const tabs=[...document.querySelectorAll('[data-testid^="custom-label-tab-"]')].map((e)=>e.textContent.trim())
      return d?.getAttribute('aria-label')==='标签格式设置' && JSON.stringify(tabs)===JSON.stringify(['打印机','页面','标签','其它']) && document.querySelector('[data-testid="custom-label-tab-label"]')?.getAttribute('aria-selected')==='true'
    })()`)
    results['C-81 自定义初始值沿用当前格式且无圆角半径字段'] = await evaluate(`(() => {
      const d=document.querySelector('[data-testid="custom-label-dialog"]')
      return document.querySelector('[data-testid="new-label-custom-width"]')?.value==='100' && document.querySelector('[data-testid="new-label-custom-height"]')?.value==='70' && document.querySelector('[data-testid="new-label-custom-cols"]')?.value==='2' && document.querySelector('[data-testid="new-label-custom-rows"]')?.value==='4' && document.querySelector('[data-testid="custom-label-shape"]')?.value==='roundRect' && !d?.innerText.includes('圆角半径') && !d?.querySelector('[data-testid="template-label-corner-radius"]')
    })()`)
    results['追加2 标签页五个分组框与加速键名称匹配真机'] = await evaluate(`(() => {
      const root=document.querySelector('[data-testid="custom-label-fields"]')
      const legends=[...root.querySelectorAll('fieldset legend')].map(e=>e.textContent.trim())
      const text=root.innerText||''
      return JSON.stringify(legends)===JSON.stringify(['标签','间距','行列','形状','孔洞']) && ['宽度(W):','高度(H):','列距(P):','行距(L):','列数(C):','行数(R):'].every(x=>text.includes(x))
    })()`)
    results['追加2 孔洞下拉三项、无初始尺寸且应用禁用'] = await evaluate(`(() => {
      const hole=document.querySelector('[data-testid="custom-label-hole"]')
      const apply=document.querySelector('[data-testid="custom-label-apply"]')
      return JSON.stringify([...hole.options].map(o=>o.textContent.trim()))===JSON.stringify(['无','圆洞','矩形']) && document.querySelector('[data-testid="custom-label-hole-size"]')?.disabled===true && apply?.disabled===true && apply?.textContent.trim()==='应用(A)'
    })()`)
    results['追加2 预览行逐字匹配真机'] = await evaluate('document.querySelector("[data-testid=custom-label-preview-info]")?.textContent.trim() === "100.00 x 70.00 毫米 [4行 2列]"')
    await click('[data-testid="custom-label-tab-printer"]')
    results['追加2 打印机页控件文案匹配真机'] = await evaluate(`(() => {
      const text=document.querySelector('[data-testid="custom-label-printer-page"]')?.innerText||''
      return ['标准驱动(S)','设置(S)','高级设置(A)','安装(I)','整页反相打印','镜像输出','单页任务模式'].every(x=>text.includes(x))
    })()`)
    await click('[data-testid="custom-label-tab-page"]')
    results['追加2 纸张颜色在页面页'] = await evaluate('!!document.querySelector("[data-testid=custom-label-page-color]")')
    await click('[data-testid="custom-label-tab-label"]')
    await setValue('[data-testid="new-label-custom-col-gap"]', '3.5')
    await setValue('[data-testid="new-label-custom-row-gap"]', '4.5')
    await click('[data-testid="custom-label-confirm"]')
    if (!await waitFor('!!document.querySelector("canvas.upper-canvas")')) throw new Error('custom confirm did not enter editor')
    await sleep(420)
    results['C-84 自定义确定后回到编辑器'] = await evaluate('!document.querySelector("[data-testid=custom-label-dialog]") && !!document.querySelector("canvas.upper-canvas")')
    results['B/C 圆角编辑器 clipPath 使用 1mm（按当前缩放换算）'] = await evaluate(`(() => {
      const svg=document.querySelector('[data-testid="paper-outline"]')
      const path=svg?.querySelector('clipPath path')
      const d=path?.getAttribute('d') || ''
      const width=svg?.viewBox?.baseVal?.width || 0
      const radius=Number(/^M ([0-9.]+) 0 /.exec(d)?.[1] || 0)
      return width===792 && radius>0 && Math.abs(radius - width/100)<0.01 && d.includes('A '+radius+' '+radius)
    })()`)

    await click('button[title="标签格式设置"]')
    if (!await waitFor('!!document.querySelector("[data-testid=template-props-dialog]")')) throw new Error('template properties did not open')
    await click('[data-testid="template-props-tab-label"]')
    await sleep(200)
    results['C-81 标签格式设置的标签页不显示圆角半径输入'] = await evaluate(`!document.querySelector('[data-testid="template-label-corner-radius"]') && !document.querySelector('[data-testid="template-props-dialog"]')?.innerText.includes('圆角半径')`)
    results['C-76 自定义列距/行距写入新文档'] = await evaluate(`document.querySelector('[data-testid="template-label-col-gap"]')?.value==='3.5' && document.querySelector('[data-testid="template-label-row-gap"]')?.value==='4.5'`)
    const previewPath = () => evaluate('document.querySelector("svg[aria-label=纸张形状预览] path")?.getAttribute("d") || ""')
    await setValue('[data-testid="template-label-shape"]', 'rect'); await sleep(100)
    results['形状规则：直角矩形外弧半径为 0'] = !(await previewPath()).includes('A ')
    await setValue('[data-testid="template-label-shape"]', 'roundRect'); await sleep(100)
    results['形状规则：圆角矩形外弧为共享 1mm'] = (await previewPath()).includes('A 1 1')
    await setValue('[data-testid="template-label-shape"]', 'ellipse'); await sleep(100)
    results['形状规则：圆形使用标签宽高作为直径'] = (await previewPath()).includes('A 50 35')
    await setValue('[data-testid="template-label-hole"]', 'circle'); await sleep(100)
    await setValue('[data-testid="template-label-hole-size"]', '20'); await sleep(100)
    results['形状规则：圆形带孔追加孔洞直径'] = (await previewPath()).includes('A 10 10')

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
