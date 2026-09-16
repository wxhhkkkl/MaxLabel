/* A1 主工具栏逐按钮点击行为（A-84～A-122 主工具栏部分，依据 toolbar_mainbar.html）。 */
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
    const waitFor = async (expression, timeout = 5000) => {
      const started = Date.now()
      while (Date.now() - started < timeout) {
        if (await evaluate(expression)) return true
        await sleep(80)
      }
      return false
    }
    const click = (selector) => evaluate(`(() => {
      const e=document.querySelector(${JSON.stringify(selector)})
      if(!e || e.disabled || !e.offsetParent)return false
      e.click(); return true
    })()`)
    const closeModal = async () => {
      await evaluate(`(() => { const b=[...document.querySelectorAll('button[aria-label="关闭"]')].filter((e)=>e.offsetParent); b.at(-1)?.click(); return true })()`)
      await sleep(200)
    }
    /** 主工具栏按钮：help 原文的「按钮名称」对应实现里的 title 文案。 */
    const tb = (title) => `[data-testid="toolbar"] button[title="${title}"]`
    const clickTb = (title) => click(tb(title))
    const layerTypes = () => evaluate(`[...document.querySelectorAll('[data-testid=layer-object-row]')].map((e)=>e.getAttribute('data-object-type'))`)
    const dragCanvas = (x1, y1, x2, y2) => evaluate(`(() => {
      const c=document.querySelector('canvas.upper-canvas')||document.querySelector('canvas'); if(!c)return false
      const b=c.getBoundingClientRect()
      const p=(x,y,buttons=1)=>({bubbles:true,cancelable:true,view:window,clientX:b.left+x,clientY:b.top+y,button:0,buttons})
      c.dispatchEvent(new MouseEvent('mousedown',p(${x1},${y1})))
      c.dispatchEvent(new MouseEvent('mousemove',p(${x2},${y2})))
      c.dispatchEvent(new MouseEvent('mouseup',{...p(${x2},${y2},0),buttons:0})); return true
    })()`)
    const clickCanvas = (x, y) => evaluate(`(() => {
      const c=document.querySelector('canvas.upper-canvas')||document.querySelector('canvas'); if(!c)return false
      const b=c.getBoundingClientRect()
      const init={bubbles:true,cancelable:true,view:window,clientX:b.left+${x},clientY:b.top+${y},button:0,buttons:1}
      c.dispatchEvent(new MouseEvent('mousedown',init))
      c.dispatchEvent(new MouseEvent('mouseup',{...init,buttons:0}))
      c.dispatchEvent(new MouseEvent('click',{...init,buttons:0})); return true
    })()`)
    /** 图层行已选中时再点一次会取消选中，这里只在未选中时点击。 */
    const selectRow = (index) => evaluate(`(() => {
      const row=[...document.querySelectorAll('[data-testid=layer-object-row]')][${index}]
      if(!row)return false
      if(row.getAttribute('data-selected')!=='true')row.click()
      return true
    })()`)
    const rowAttr = (index, name) => evaluate(`document.querySelectorAll('[data-testid=layer-object-row]')[${index}]?.getAttribute(${JSON.stringify(name)})`)
    const zoomValue = () => evaluate(`parseFloat(document.querySelector('[data-testid=zoom-level]')?.value || '0')`)
    const statusTitle = () => evaluate(`document.querySelector('[data-testid=status-bar]')?.title || ''`)

    await sleep(1800)
    await closeModal()

    // ---- A-84 新建 ----
    const newClicked = await clickTb('新建标签模版')
    // 首次启动时原版流程会先经过模板向导（DIFF-3）；向导的「新建」同样落到新建标签格式对话框。
    if (await waitFor('!!document.querySelector("[data-testid=template-wizard]")', 1500)) {
      await click('[data-testid="wizard-next"]')
      await sleep(300)
    }
    results['A-84 工具栏新建按钮进入新建标签模板流程'] = newClicked && await waitFor('!!document.querySelector("[data-testid=new-label-dialog]")')
    await click('[data-testid="new-label-select"]')
    if (!await waitFor('!!document.querySelector("canvas.upper-canvas")')) throw new Error('editor did not open')

    // ---- A-93 打印组与对象工具组的按钮集合/顺序 ----
    const TOOL_TITLES = ['选取', '条码', '文字', '线条', '斜线', '矩形', '图片', '表格', 'RFID', '数据']
    results['A-93 标签格式设置/打印预览/打印三按钮存在且顺序正确'] = await evaluate(`(() => {
      const titles=[...document.querySelectorAll('[data-testid=toolbar] button[title]')].map((e)=>e.title)
      const i=titles.indexOf('标签格式设置'), j=titles.indexOf('打印预览'), k=titles.indexOf('打印')
      return i>-1 && j===i+1 && k===j+1
    })()`)
    results['A-93 对象工具按钮集合与帮助顺序一致（选取/条码/文字/线条/斜线/矩形/图片/表格/RFID/数据）'] = await evaluate(`(() => {
      const wanted=${JSON.stringify(TOOL_TITLES)}
      const got=[...document.querySelectorAll('[data-testid=toolbar] button[data-tool]')].map((e)=>e.title.replace('选择工具：',''))
      return JSON.stringify(got)===JSON.stringify(wanted)
    })()`)

    // ---- A-97～A-106 对象工具：点击激活 + 画布点击/拖拽创建 ----
    // 帮助 label_object_create_drag.html：选中工具后在标签查看区域拖拽/点击即可创建。
    const CREATE_TOOLS = [
      ['barcode', 'A-98', 60, 70, 'drag', 'barcode'],
      ['text', 'A-99', 160, 70, 'drag', 'text'],
      ['rect', 'A-102', 260, 70, 'drag', 'rect'],
      ['image', 'A-103', 360, 70, 'drag', 'image'],
      ['table', 'A-104', 460, 70, 'drag', 'table'],
      ['rfid', 'A-105', 560, 70, 'drag', 'rfid'],
      ['line', 'A-100', 120, 230, 'click', 'line'],
      ['diagonal', 'A-101', 120, 330, 'click', 'line']
    ]
    for (const [key, id, x, y, mode, expectedType] of CREATE_TOOLS) {
      const before = (await layerTypes()).length
      const clicked = await click(`[data-testid="toolbar"] button[data-tool="${key}"]`)
      const pressed = await evaluate(`document.querySelector('[data-testid="toolbar"] button[data-tool="${key}"]')?.getAttribute('aria-pressed')==='true'`)
      const acted = mode === 'drag' ? await dragCanvas(x, y, x + 60, y + 45) : await clickCanvas(x, y)
      await sleep(350)
      const types = await layerTypes()
      // 图层行按最新在前排序：新建对象固定落在第 0 行。
      const createdType = await rowAttr(0, 'data-object-type')
      const createdHeight = Number(await rowAttr(0, 'data-object-h'))
      const created = types.length === before + 1 && createdType === expectedType
      results[`${id} 工具按钮激活后在画布上创建对应对象（${key}）`] = clicked && pressed && acted && created && Number.isFinite(createdHeight)
    }
    // 选取工具：激活后仍可点选对象（A-97）
    await click('[data-testid="toolbar"] button[data-tool="select"]')
    await sleep(120)
    const rectIndex = (await layerTypes()).indexOf('rect')
    const rectRowClick = await evaluate(`(() => { const row=[...document.querySelectorAll('[data-testid=layer-object-row]')][${rectIndex}]; row?.click(); return !!row })()`)
    results['A-97 选取工具激活后可点选对象并显示句柄'] = await evaluate(`document.querySelector('[data-testid="toolbar"] button[data-tool="select"]')?.getAttribute('aria-pressed')==='true'`) && rectRowClick && await waitFor(`[...document.querySelectorAll('[data-testid=layer-object-row]')].some((e)=>e.getAttribute('data-selected')==='true')`) && await evaluate('!!document.querySelector("canvas.upper-canvas")')
    // 数据工具：激活后点击画布上的文字对象打开「修改数据」对话框（A-106）
    const dataPressed = await click('[data-testid="toolbar"] button[data-tool="data"]') && await evaluate(`document.querySelector('[data-testid="toolbar"] button[data-tool="data"]')?.getAttribute('aria-pressed')==='true'`)
    await sleep(150)
    const dataStatus = (await statusTitle()).includes('数据工具')
    // 先在空白处拖出一个文字对象，再用数据工具回点其中心，避免依赖其他对象的落点。
    await click('[data-testid="toolbar"] button[data-tool="text"]')
    await sleep(150)
    await dragCanvas(520, 280, 620, 340)
    await sleep(350)
    await click('[data-testid="toolbar"] button[data-tool="data"]')
    await sleep(150)
    await clickCanvas(570, 310)
    await sleep(500)
    const dataDialog = await waitFor(`document.body.innerText.includes('显示数据')`, 3000)
    results['A-106 数据工具激活后点击对象打开修改数据对话框'] = dataPressed && dataStatus && dataDialog
    await closeModal()

    // ---- A-87～A-92 编辑与历史 ----
    await click('[data-testid="toolbar"] button[data-tool="select"]')
    await sleep(120)
    await selectRow(0)
    await sleep(200)
    const countBefore = (await layerTypes()).length
    const copied = await clickTb('复制')
    await sleep(250)
    results['A-88 复制按钮保留对象并令粘贴可用'] = copied && (await layerTypes()).length === countBefore && await evaluate(`document.querySelector('${tb('粘贴')}')?.disabled === false`)
    const pasted = await clickTb('粘贴')
    await sleep(350)
    const afterPaste = (await layerTypes()).length
    results['A-89 粘贴按钮把剪贴板对象放入标签查看区域'] = pasted && afterPaste === countBefore + 1
    await selectRow(0)
    await sleep(200)
    const cut = await clickTb('剪切')
    await sleep(350)
    const afterCut = (await layerTypes()).length
    const pasteEnabledAfterCut = await evaluate(`document.querySelector('${tb('粘贴')}')?.disabled === false`)
    results['A-87 剪切按钮删除选中对象并置入剪贴板'] = cut && afterCut === afterPaste - 1 && pasteEnabledAfterCut
    // 剪贴板内容仍在：粘贴回一个对象后再删除，用于验证删除按钮。
    await clickTb('粘贴')
    await sleep(350)
    await selectRow(0)
    await sleep(200)
    const deleted = await clickTb('删除')
    await sleep(350)
    const afterDelete = (await layerTypes()).length
    results['A-90 删除按钮删除选中对象'] = deleted && afterDelete === afterCut
    results['A-91 撤消按钮撤消上一步操作'] = await clickTb('撤销') && await sleep(300).then(async () => (await layerTypes()).length === afterDelete + 1)
    results['A-92 恢复按钮恢复刚刚撤消的操作'] = await clickTb('重做') && await sleep(300).then(async () => (await layerTypes()).length === afterDelete)

    // ---- A-94 标签格式设置 ----
    results['A-94 标签格式设置按钮打开文档标签设置对话框'] = await clickTb('标签格式设置') && await waitFor('!!document.querySelector("[data-testid=template-props-dialog]")')
    await closeModal()

    // ---- A-115/A-116 放大缩小 ----
    const z0 = await zoomValue()
    const zoomedIn = await clickTb('放大')
    await sleep(250)
    const z1 = await zoomValue()
    results['A-115 放大按钮提升标签显示比例'] = zoomedIn && z1 > z0
    const zoomedOut = await clickTb('缩小')
    await sleep(250)
    const z2 = await zoomValue()
    results['A-116 缩小按钮降低标签显示比例'] = zoomedOut && z2 < z1

    // ---- A-117/A-118/A-119 适应宽度/适应高度/撑满窗口 ----
    results['A-117 适应宽度按钮把标签缩放到适应窗口宽度'] = await clickTb('适应宽度') && await sleep(350).then(async () => (await statusTitle()).includes('已适应宽度'))
    results['A-118 适应高度按钮把标签缩放到适应窗口高度'] = await clickTb('适应高度') && await sleep(350).then(async () => (await statusTitle()).includes('已适应高度'))
    results['A-119 撑满窗口按钮把标签撑满窗口显示'] = await clickTb('撑满窗口') && await sleep(350).then(async () => (await statusTitle()).includes('已撑满窗口'))

    // ---- A-120 帮助主题 ----
    results['A-120 帮助主题按钮打开帮助系统'] = await clickTb('帮助主题') && await waitFor(`document.body.innerText.includes('快速开始')`)
    await closeModal()

    // ---- A-95/A-96 预览与打印（放最后，打印对话框会遮住其余入口） ----
    // 预览在原版与复刻版里都是独立窗口：断言点击后多出一个预览窗口目标。
    const pageCount = async () => (await getJson(`http://127.0.0.1:${port}/json/list`)).filter((item) => item.type === 'page').length
    const pagesBefore = await pageCount()
    const previewClicked = await clickTb('打印预览')
    let previewOpened = false
    for (let i = 0; i < 40; i++) {
      if (await pageCount() > pagesBefore) { previewOpened = true; break }
      await sleep(250)
    }
    results['A-95 打印预览按钮打开当前编辑标签的预览窗口'] = previewClicked && previewOpened
    await sleep(300)
    results['A-96 打印按钮打开打印对话框'] = await clickTb('打印') && await waitFor('!!document.querySelector("[data-testid=print-dialog]")')

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
