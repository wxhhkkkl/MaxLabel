/* A-227～A-230：标签格式设置_标签页按帮助 label_page_label.html 收口——
   字段名与顺序（标签宽度/标签高度 → 水平间距/垂直间距 → 列数/行数 → 形状/孔洞）、
   形状三档（直角矩形/圆角矩形/圆形）、孔洞=圆洞+尺寸、
   预定义标签格式不可修改而自定义格式可修改、光盘类格式落成「圆形 + 圆洞」。 */
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
    const waitFor = async (expression, timeout = 3000) => {
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
      const setter=Object.getOwnPropertyDescriptor(e instanceof HTMLSelectElement?HTMLSelectElement.prototype:HTMLInputElement.prototype,'value').set
      setter.call(e,${JSON.stringify(String(value))})
      e.dispatchEvent(new Event('input',{bubbles:true})); e.dispatchEvent(new Event('change',{bubbles:true})); return true
    })()`)
    const optionsOf = (selector) => evaluate(`[...(document.querySelector(${JSON.stringify(selector)})?.options||[])].map((o)=>o.textContent.trim())`)
    const openMenu = async (title) => { await click(`[data-menu-title="${title}"]`); await sleep(90) }
    const clickMenuItem = (label) => evaluate(`(() => {
      const wanted=${JSON.stringify(label)}
      const e=[...document.querySelectorAll('[data-menu-item]')].find((c)=>c.offsetParent && c.getAttribute('data-menu-item')===wanted)
      if(!e || e.getAttribute('data-menu-disabled')==='true')return false
      e.click(); return true
    })()`)
    const closeModal = (testId) => evaluate(`(() => {
      const root=document.querySelector('[data-testid=${JSON.stringify(testId)}]')
      const buttons=[...root.querySelectorAll('button[aria-label="关闭"]')].filter((e)=>e.offsetParent)
      buttons.at(-1)?.click(); return true
    })()`)
    const openTemplateProps = async () => {
      await openMenu('文件(F)')
      const opened = await clickMenuItem('模板属性设置(M)...')
      await sleep(220)
      await click('[data-testid="template-props-tab-label"]')
      await sleep(160)
      return opened && await evaluate('!!document.querySelector("[data-testid=template-props-dialog]")')
    }
    // 标签页里各字段在 DOM 中的先后顺序（帮助 label_page_label.html 的小节顺序）
    const labelFieldOrder = () => evaluate(`(() => {
      const root=document.querySelector('[data-testid="template-props-dialog"]')
      const wanted=['template-label-width','template-label-height','template-label-col-gap','template-label-row-gap','template-label-cols','template-label-rows','template-label-shape','template-label-hole']
      const found=[...root.querySelectorAll('[data-testid]')].map((e)=>e.getAttribute('data-testid')).filter((id)=>wanted.includes(id))
      return found
    })()`)

    await sleep(1600)
    await evaluate('document.querySelector("button[aria-label=关闭]")?.click()')
    await sleep(200)

    // ---- 打开一个预定义标签格式的文档（选择标签格式 → 选择(O)）----
    await evaluate('document.dispatchEvent(new KeyboardEvent("keydown",{key:"n",code:"KeyN",ctrlKey:true,bubbles:true}))')
    await sleep(400)
    if (await evaluate('!!document.querySelector("[data-testid=template-wizard]")')) { await click('[data-testid="wizard-next"]'); await sleep(320) }
    if (!await waitFor('!!document.querySelector("[data-testid=new-label-dialog]")', 5000)) throw new Error('choose-label dialog did not open')
    await click('[data-testid="new-label-select"]')
    if (!await waitFor('!!document.querySelector("canvas")', 8000)) throw new Error('editor did not open')
    await sleep(600)

    // A-227/A-228/A-229/A-230：字段顺序与名称按帮助原文
    results['A-227 模板属性标签页可打开'] = await openTemplateProps()
    results['A-227 标签页字段顺序为 宽/高 → 水平间距/垂直间距 → 列数/行数 → 形状/孔洞'] =
      JSON.stringify(await labelFieldOrder()) === JSON.stringify([
        'template-label-width', 'template-label-height',
        'template-label-col-gap', 'template-label-row-gap',
        'template-label-cols', 'template-label-rows',
        'template-label-shape', 'template-label-hole'
      ])
    const labelText = await evaluate('document.querySelector("[data-testid=template-props-dialog]")?.innerText || ""')
    results['A-229 间距按帮助原文叫「水平间距」「垂直间距」'] =
      labelText.includes('水平间距（mm）') && labelText.includes('垂直间距（mm）') && !labelText.includes('行间隔') && !labelText.includes('列间隔')
    results['A-230 列数与行数沿用帮助原文命名'] = labelText.includes('列数') && labelText.includes('行数')
    results['A-227 形状只有直角矩形/圆角矩形/圆形三档'] =
      JSON.stringify(await optionsOf('[data-testid="template-label-shape"]')) === JSON.stringify(['直角矩形', '圆角矩形', '圆形'])
    results['A-227 孔洞提供圆洞并可输入孔洞尺寸'] = await evaluate(`(() => {
      const hole=document.querySelector('[data-testid="template-label-hole"]')
      const labels=[...(hole?.options||[])].map((o)=>o.textContent.trim())
      return JSON.stringify(labels)===JSON.stringify(['无','圆洞'])
    })()`)

    // 预定义标签格式的标签信息不可修改
    results['A-227 预定义标签格式的标签信息只读'] = await evaluate(`(() => {
      const ids=['template-label-width','template-label-height','template-label-col-gap','template-label-row-gap','template-label-cols','template-label-rows']
      return ids.every((id)=>document.querySelector('[data-testid="'+id+'"]')?.readOnly === true) &&
        document.querySelector('[data-testid="template-label-shape"]')?.disabled === true &&
        document.querySelector('[data-testid="template-label-hole"]')?.disabled === true &&
        (document.querySelector('[data-testid="template-props-dialog"]')?.innerText||'').includes('系统预定义标签格式的标签信息不可以修改')
    })()`)
    await closeModal('template-props-dialog'); await sleep(200)

    // ---- 自定义标签格式：标签信息可修改，改动写回文档 ----
    await evaluate('document.dispatchEvent(new KeyboardEvent("keydown",{key:"n",code:"KeyN",ctrlKey:true,bubbles:true}))')
    await sleep(400)
    if (await evaluate('!!document.querySelector("[data-testid=template-wizard]")')) { await click('[data-testid="wizard-next"]'); await sleep(320) }
    if (!await waitFor('!!document.querySelector("[data-testid=new-label-dialog]")', 5000)) throw new Error('choose-label dialog did not reopen')
    await click('[data-testid="new-label-custom"]'); await sleep(160)
    await setValue('[data-testid="new-label-custom-width"]', '90')
    await setValue('[data-testid="new-label-custom-height"]', '90')
    await click('[data-testid="new-label-select"]')
    if (!await waitFor('!!document.querySelector("canvas")', 8000)) throw new Error('custom editor did not open')
    await sleep(600)

    results['A-227 自定义标签格式的标签信息可修改'] = await openTemplateProps() &&
      await evaluate(`['template-label-width','template-label-height','template-label-col-gap','template-label-row-gap','template-label-cols','template-label-rows'].every((id)=>document.querySelector('[data-testid="'+id+'"]')?.readOnly === false) &&
        document.querySelector('[data-testid="template-label-shape"]')?.disabled === false`)

    // 形状=圆形：宽度与高度即两个方向的直径，勾选圆洞后出现孔洞尺寸
    await setValue('[data-testid="template-label-shape"]', 'ellipse'); await sleep(200)
    results['A-227 选圆形后提示宽度与高度表示两个方向的直径'] =
      (await evaluate('document.querySelector("[data-testid=template-props-dialog]")?.innerText || ""')).includes('两个方向的直径')
    await setValue('[data-testid="template-label-hole"]', 'circle'); await sleep(220)
    results['A-227 选圆洞后出现孔洞尺寸输入'] = await waitFor('!!document.querySelector("[data-testid=template-label-hole-size]")')
    await setValue('[data-testid="template-label-hole-size"]', '40'); await sleep(200)
    results['A-227 孔洞尺寸可输入到 40 毫米'] =
      await evaluate('document.querySelector("[data-testid=template-label-hole-size]")?.value') === '40'

    // 水平/垂直间距写回 layout 并在重开后保持
    await setValue('[data-testid="template-label-col-gap"]', '3.5'); await sleep(160)
    await setValue('[data-testid="template-label-row-gap"]', '4.5'); await sleep(160)
    await evaluate(`(() => { const root=document.querySelector('[data-testid="template-props-dialog"]')
      const ok=[...root.querySelectorAll('button')].find((b)=>b.textContent.trim()==='确定'); ok?.click(); return true })()`)
    await sleep(400)
    await openTemplateProps()
    results['A-229 水平间距与垂直间距写回标签布局并保持'] = await evaluate(`(() => {
      return document.querySelector('[data-testid="template-label-col-gap"]')?.value==='3.5' &&
        document.querySelector('[data-testid="template-label-row-gap"]')?.value==='4.5' &&
        document.querySelector('[data-testid="template-label-shape"]')?.value==='ellipse' &&
        document.querySelector('[data-testid="template-label-hole-size"]')?.value==='40'
    })()`)
    await closeModal('template-props-dialog'); await sleep(200)

    // ---- 光盘类格式（格式库 corner=2）落成「圆形 + 圆洞」，不再单列光盘形状 ----
    await evaluate('document.dispatchEvent(new KeyboardEvent("keydown",{key:"n",code:"KeyN",ctrlKey:true,bubbles:true}))')
    await sleep(400)
    if (await evaluate('!!document.querySelector("[data-testid=template-wizard]")')) { await click('[data-testid="wizard-next"]'); await sleep(320) }
    if (!await waitFor('!!document.querySelector("[data-testid=new-label-dialog]")', 5000)) throw new Error('choose-label dialog did not reopen for disc format')
    // 格式下拉按品牌+分类联动筛选，光盘类格式在 品牌2 / 分类14（光盘标签）
    await setValue('[data-testid="new-label-brand"]', '2'); await sleep(200)
    await setValue('[data-testid="new-label-type"]', '14'); await sleep(200)
    await setValue('[data-testid="new-label-format"]', '608020'); await sleep(300)
    results['A-227 光盘类格式可被选中'] = await evaluate('document.querySelector("[data-testid=new-label-format]")?.value === "608020"')
    await click('[data-testid="new-label-select"]')
    if (!await waitFor('!!document.querySelector("canvas")', 8000)) throw new Error('disc editor did not open')
    await sleep(700)
    await openTemplateProps()
    results['A-227 光盘格式落成「圆形 + 圆洞」而不是独立形状档'] = await evaluate(`(() => {
      const shape=document.querySelector('[data-testid="template-label-shape"]')
      const labels=[...(shape?.options||[])].map((o)=>o.textContent.trim())
      const hole=document.querySelector('[data-testid="template-label-hole"]')?.value
      const holeSize=document.querySelector('[data-testid="template-label-hole-size"]')?.value
      return JSON.stringify(labels)===JSON.stringify(['直角矩形','圆角矩形','圆形']) && shape?.value==='ellipse' && hole==='circle' && holeSize==='40'
    })()`)
    await closeModal('template-props-dialog'); await sleep(150)

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
