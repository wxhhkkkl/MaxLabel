/* A-227 孔洞=矩形 的贯通性：工具栏「标签格式设置」（模板属性设置）入口也必须能选「矩形」并把孔形一路带到
   文档与编辑器裁剪，且两个入口（新建标签 → 自定义(N) / 工具栏入口）的 形状·孔洞 选项是**同一套**（防漂移）。

   背景（round-107b→round-109 复核）：round-107b 把「矩形」加进了孔洞下拉，但只做到了「自定义」对话框的
   本地 draft 预览里 —— 工具栏入口的 `PaperFields` 用 `holeMm > 0 ? 'circle' : 'none'` 反查选中态，
   选「矩形」会立刻回弹成「圆洞」；孔形也没有进 document 归一化、没进 print scene，所以打印出来仍是圆孔。
   真机证据：parity/reference/labelshop/probe-round106-custom-label-combos.txt（孔洞 = 无/圆洞/矩形）、
   PROBE-round107-hole-rect.md（三项共用一个尺寸框；选「无」时尺寸框禁用）。 */
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
    const waitFor = async (expression, timeout = 6000) => {
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
    // 读某个对话框里 svg 的纸张路径：切出「轮廓 / 切孔」两条子路径，用于区分方孔与圆孔。
    const cutOf = (rootTestId) => evaluate(`(function(){
      var r=document.querySelector('[data-testid="${rootTestId}"]')
      var p=r&&r.querySelector('svg path')
      var d=(p&&p.getAttribute('d'))||''
      var subs=(d.match(/M [^M]*/g)||[]).map(function(s){return s.trim()})
      return { n:subs.length, cut:subs[1]||'', hasArc:/A/.test(subs[1]||'') }
    })()`)

    await sleep(1600)
    await evaluate('document.querySelector("button[aria-label=关闭]")?.click()')

    // ---- ① 自定义入口（新建标签 → 自定义(N)）----
    await evaluate('document.dispatchEvent(new KeyboardEvent("keydown",{key:"n",code:"KeyN",ctrlKey:true,bubbles:true,cancelable:true}))')
    await sleep(500)
    if (await evaluate('!!document.querySelector("[data-testid=template-wizard]")')) await click('[data-testid="wizard-next"]')
    if (!await waitFor('!!document.querySelector("[data-testid=new-label-dialog]")')) throw new Error('choose-label dialog did not open')
    await click('[data-testid="new-label-custom"]')
    if (!await waitFor('!!document.querySelector("[data-testid=custom-label-dialog]")')) throw new Error('custom dialog did not open')
    const customShape = await optionsOf('[data-testid="custom-label-shape"]')
    const customHole = await optionsOf('[data-testid="custom-label-hole"]')
    results['A-227 自定义入口 形状 = 方角矩形/圆角矩形/圆形'] = JSON.stringify(customShape) === JSON.stringify(['方角矩形', '圆角矩形', '圆形'])
    results['A-227 自定义入口 孔洞 = 无/圆洞/矩形'] = JSON.stringify(customHole) === JSON.stringify(['无', '圆洞', '矩形'])
    await setValue('[data-testid="custom-label-hole"]', 'rectangle'); await sleep(250)
    results['A-227 自定义入口选「矩形」保持矩形且尺寸框启用'] = await evaluate('document.querySelector("[data-testid=custom-label-hole]")?.value === "rectangle" && document.querySelector("[data-testid=custom-label-hole-size]")?.disabled === false')
    await click('[data-testid="custom-label-confirm"]')
    await sleep(700)

    // ---- ② 工具栏入口：文件 → 模板属性设置(M)... → 标签页 ----
    await click('[data-menu-title="文件(F)"]'); await sleep(140)
    await evaluate(`(() => {
      const e=[...document.querySelectorAll('[data-menu-item]')].find((c)=>c.offsetParent && c.getAttribute('data-menu-item')==='模板属性设置(M)...')
      if(!e || e.getAttribute('data-menu-disabled')==='true')return false
      e.click(); return true
    })()`)
    await sleep(300)
    await click('[data-testid="template-props-tab-label"]')
    await sleep(220)
    if (!await evaluate('!!document.querySelector("[data-testid=template-props-dialog]")')) throw new Error('template props dialog did not open')
    results['A-227 工具栏入口的孔洞下拉可编辑（自定义格式）'] = await evaluate('document.querySelector("[data-testid=template-label-hole]")?.disabled === false')

    const toolbarShape = await optionsOf('[data-testid="template-label-shape"]')
    const toolbarHole = await optionsOf('[data-testid="template-label-hole"]')
    results['A-227 工具栏入口 形状 = 方角矩形/圆角矩形/圆形'] = JSON.stringify(toolbarShape) === JSON.stringify(['方角矩形', '圆角矩形', '圆形'])
    results['A-227 工具栏入口 孔洞 = 无/圆洞/矩形'] = JSON.stringify(toolbarHole) === JSON.stringify(['无', '圆洞', '矩形'])
    results['A-227 两个入口的形状选项逐字相同（单一来源）'] = JSON.stringify(toolbarShape) === JSON.stringify(customShape)
    results['A-227 两个入口的孔洞选项逐字相同（单一来源）'] = JSON.stringify(toolbarHole) === JSON.stringify(customHole)

    // 旧实现在这里会立刻回弹成「圆洞」（holeMm>0 ? circle : none 反查），所以下面两条是回归钉。
    await setValue('[data-testid="template-label-hole"]', 'rectangle'); await sleep(250)
    results['A-227 工具栏入口选「矩形」后不回落成圆洞'] = await evaluate('document.querySelector("[data-testid=template-label-hole]")?.value === "rectangle"')
    results['A-227 工具栏入口选「矩形」后尺寸框启用'] = await evaluate('document.querySelector("[data-testid=template-label-hole-size]")?.disabled === false')
    await setValue('[data-testid="template-label-hole-size"]', '20'); await sleep(280)

    // 100x70 居中 20mm 正方形：x 从 50-10=40 到 60，y 从 35-10=25 到 45
    const rect = await cutOf('template-props-dialog')
    results['A-227 矩形孔预览逐字 = M 40 25 H 60 V 45 H 40 Z'] = rect.cut === 'M 40 25 H 60 V 45 H 40 Z'
    results['A-227 矩形孔预览只有直线（无弧）'] = rect.n === 2 && rect.hasArc === false

    await setValue('[data-testid="template-label-hole"]', 'circle'); await sleep(280)
    const circle = await cutOf('template-props-dialog')
    results['A-227 圆洞预览为弧线切孔（φ20 → A 10 10）'] = circle.n === 2 && /A 10 10/.test(circle.cut)
    results['A-227 矩形孔与圆洞孔路径不同'] = circle.cut !== rect.cut

    await setValue('[data-testid="template-label-hole"]', 'none'); await sleep(280)
    const none = await cutOf('template-props-dialog')
    // 真机 probe-round107-hole-rect-tree.txt：孔洞=无 时该 Edit 是 DISABLED；选「无」即不画切孔。
    results['A-227 选「无」后尺寸框禁用且不画切孔'] = none.n === 1 && await evaluate('document.querySelector("[data-testid=template-label-hole-size]")?.disabled === true')

    // ---- ③ 确定后孔形必须落进文档 → 编辑器裁剪路径按矩形孔（LabelEditor 是 innerShape 的唯一裁剪消费点）----
    await setValue('[data-testid="template-label-hole"]', 'rectangle'); await sleep(220)
    await setValue('[data-testid="template-label-hole-size"]', '20'); await sleep(280)
    await evaluate(`(() => {
      const b=[...document.querySelectorAll('[data-testid="template-props-dialog"] button')].find((x)=>(x.textContent||'').trim()==='确定')
      if(!b)return false
      b.click(); return true
    })()`)
    await sleep(800)
    if (await evaluate('!!document.querySelector("[data-testid=template-props-dialog]")')) {
      await evaluate('document.querySelector("[data-testid=template-props-dialog] button[aria-label=关闭]")?.click()')
      await sleep(400)
    }
    const editorCut = await evaluate(`(() => {
      const paths=[...document.querySelectorAll('svg clipPath path')].map((p)=>p.getAttribute('d')||'')
      const d=paths.find((x)=>x.indexOf('H ')>=0)||''
      const subs=(d.match(/M [^M]*/g)||[]).map(function(s){return s.trim()})
      return { n:subs.length, cut:subs[1]||'', hasArc:/A/.test(subs[1]||'') }
    })()`)
    results['A-227 编辑器裁剪路径带矩形孔且为直线（孔形贯通到画布）'] = editorCut.n === 2 && editorCut.cut !== '' && editorCut.hasArc === false

    let pass = 0
    for (const [key, value] of Object.entries(results)) { console.log((value ? 'PASS ' : 'FAIL ') + key); if (value) pass++ }
    console.log(`\n${pass}/${Object.keys(results).length} PASS`)
    client.ws.close()
    process.exit(pass === Object.keys(results).length ? 0 : 1)
  } catch (error) {
    console.error('ERR', error.message)
    for (const [key, value] of Object.entries(results)) console.log((value ? 'PASS ' : 'FAIL ') + key)
    if (client) client.ws.close()
    process.exit(2)
  }
})()
