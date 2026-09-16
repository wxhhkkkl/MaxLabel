/*
 * B-02 / B-05 / B-44 / B-45：
 *  - B-02 对象工具拖拽创建（含线条水平/垂直吸附、斜线保角）+ 复制粘贴创建
 *  - B-05 所见即所得编辑闭环（格式栏改字体字号、属性对话框改属性、对齐/层次/旋转）
 *  - B-44 可排入多个 RFID 标记对象
 *  - B-45 RFID 属性页字段（读写器类型 / 数据段位置 / 起始块 / 数据类型 / PC 协议控制字）
 *
 * 出处：label_object_create.html、label_object_create_drag.html、label_object_create_paste.html、
 *       label_object_edit.html、label_object_line.html、label_object_rfid.html、label_object_page_rfid.html
 */
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
    const click = (selector) => evaluate(`(() => { const e=document.querySelector(${JSON.stringify(selector)}); if(!e || e.disabled)return false; e.click(); return true })()`)
    // 只在 window 上派发一次：无论 window+document 双发还是 document 单发，
    // 都靠事件冒泡到达 window 监听者，但双发会让 Ctrl+V / Alt+Enter 这类
    // 非幂等命令执行两次（粘贴出两个对象、属性对话框开了又关）。
    const pressKey = (k, o = {}) => evaluate(`(() => { const e=new KeyboardEvent('keydown',${JSON.stringify({ key: k, code: k, bubbles: true, cancelable: true, ...o })}); window.dispatchEvent(e); return true })()`)
    const waitFor = async (expression, timeout = 4000) => {
      const started = Date.now()
      while (Date.now() - started < timeout) {
        if (await evaluate(expression)) return true
        await sleep(80)
      }
      return false
    }
    const rows = () => evaluate(`[...document.querySelectorAll('[data-testid=layer-object-row]')].map((e)=>({ type:e.getAttribute('data-object-type'), id:e.getAttribute('data-object-id'), sel:e.getAttribute('data-selected')==='true', x:Number(e.getAttribute('data-object-x')), y:Number(e.getAttribute('data-object-y')), w:Number(e.getAttribute('data-object-w')), h:Number(e.getAttribute('data-object-h')), rot:Number(e.getAttribute('data-object-rotation')), text:e.textContent }))`)
    const statusText = () => evaluate(`document.querySelector('[data-testid=status-bar]')?.innerText || ''`)
    // 取 lower-canvas（Fabric 把对象内容画在下层，upper-canvas 只画选中把柄）
    const canvasPng = () => evaluate(`(() => { const c=document.querySelector('canvas.lower-canvas')||document.querySelector('canvas.upper-canvas'); return c ? c.toDataURL('image/png') : '' })()`)
    const optionsOf = (selector) => evaluate(`[...(document.querySelector(${JSON.stringify(selector)})?.options||[])].map((o)=>o.value)`)
    const setValue = (selector, value) => evaluate(`(() => {
      const e=document.querySelector(${JSON.stringify(selector)}); if(!e)return false
      const proto=e instanceof HTMLSelectElement?HTMLSelectElement.prototype:HTMLInputElement.prototype
      const setter=Object.getOwnPropertyDescriptor(proto,'value').set
      setter.call(e,${JSON.stringify(String(value))})
      e.dispatchEvent(new Event('input',{bubbles:true})); e.dispatchEvent(new Event('change',{bubbles:true})); return true
    })()`)
    /** 在 upper-canvas 上按像素坐标拖拽（相对画布左上角），用于拖放创建对象 */
    const drag = (x1, y1, x2, y2) => evaluate(`(() => {
      const c=document.querySelector('canvas.upper-canvas')||document.querySelector('canvas'); if(!c)return false
      const b=c.getBoundingClientRect()
      const p=(x,y,buttons=1)=>({bubbles:true,cancelable:true,view:window,clientX:b.left+x,clientY:b.top+y,button:0,buttons})
      c.dispatchEvent(new MouseEvent('mousedown',p(${x1},${y1})))
      c.dispatchEvent(new MouseEvent('mousemove',p(${x2},${y2})))
      c.dispatchEvent(new MouseEvent('mouseup',{...p(${x2},${y2},0),buttons:0})); return true
    })()`)
    /** 点画布空白处取消选中（清掉画布的选中集，只留模型 selectedId） */
    const clickEmptyCanvas = () => evaluate(`(() => {
      const c=document.querySelector('canvas.upper-canvas')||document.querySelector('canvas'); if(!c)return false
      const b=c.getBoundingClientRect()
      const p=(bt)=>({bubbles:true,cancelable:true,view:window,clientX:b.left+6,clientY:b.top+b.height-6,button:0,buttons:bt})
      c.dispatchEvent(new MouseEvent('mousedown',p(1)))
      c.dispatchEvent(new MouseEvent('mouseup',{...p(0),buttons:0})); return true
    })()`)
    const menuLabels = () => evaluate(`[...document.querySelectorAll('[data-menu-item]')].filter((e)=>e.offsetParent).map((e)=>e.getAttribute('data-menu-item'))`)
    const openMenu = async (title) => {
      await evaluate(`(() => { const b=document.querySelector('[data-menu-title=${JSON.stringify(title)}]'); if(!b) return false; if(!b.parentElement.querySelector('[data-menu-item],[data-menu-divider]')) b.click(); return true })()`)
      await sleep(180)
    }
    const closeMenu = async (title) => {
      await evaluate(`(() => { const b=document.querySelector('[data-menu-title=${JSON.stringify(title)}]'); if(!b) return false; if(b.parentElement.querySelector('[data-menu-item],[data-menu-divider]')) b.click(); return true })()`)
      await sleep(150)
    }
    const clickItem = async (label) => { const ok = await click(`[data-menu-item=${JSON.stringify(label)}]`); await sleep(300); return ok }
    // 图层行点击是「切换选中」：已选中的行再点一次会取消选中，故先判后点。
    const selectRow = async (id) => {
      const ok = await evaluate(`(() => { const r=[...document.querySelectorAll('[data-testid=layer-object-row]')].find((e)=>e.getAttribute('data-object-id')===${JSON.stringify(id)}); if(!r) return false; if(r.getAttribute('data-selected')!=='true') r.click(); return true })()`)
      await sleep(180)
      return ok
    }
    const openPropsByRow = async (id) => {
      if (!await selectRow(id)) return false
      await pressKey('Enter', { altKey: true })
      if (!await waitFor('!!document.querySelector("[data-testid=object-props-dialog]")')) return false
      await sleep(200)
      return true
    }
    const closeProps = async () => {
      await evaluate(`document.querySelector('[data-testid="object-props-dialog"] button[aria-label]')?.click()`)
      await sleep(220)
    }

    // ---------- 打开编辑器 ----------
    await sleep(1800)
    await evaluate('document.querySelector("button[aria-label=关闭]")?.click()')
    await pressKey('n', { ctrlKey: true }); await sleep(340)
    if (await evaluate('!!document.querySelector("[data-testid=template-wizard]")')) {
      await click('[data-testid="wizard-next"]'); await sleep(320)
    }
    await click('[data-testid="new-label-select"]')
    if (!await waitFor('!!document.querySelector("canvas.upper-canvas")', 8000)) throw new Error('editor did not open')
    await sleep(400)

    const size = await evaluate(`(() => { const c=document.querySelector('canvas.upper-canvas'); const b=c.getBoundingClientRect(); return { w:Math.round(b.width), h:Math.round(b.height) } })()`)
    if (!size || size.w < 300 || size.h < 240) throw new Error('canvas too small: ' + JSON.stringify(size))
    const px = (fx, fy) => [Math.round(size.w * fx), Math.round(size.h * fy)]

    // ================= B-02 拖放创建 =================
    // 每个对象一个互不重叠的拖拽框，避免 mousedown 落在已有对象上而不创建。
    const plan = [
      { tool: 'barcode', box: [0.04, 0.05, 0.21, 0.20] },
      { tool: 'text', box: [0.26, 0.05, 0.43, 0.20] },
      { tool: 'line', box: [0.47, 0.05, 0.64, 0.19] }, // 水平主导 → 水平线
      { tool: 'lineV', box: [0.68, 0.05, 0.73, 0.30] }, // 垂直主导 → 垂直线
      { tool: 'diagonal', box: [0.80, 0.05, 0.98, 0.30] },
      { tool: 'rect', box: [0.04, 0.38, 0.21, 0.53] },
      { tool: 'image', box: [0.26, 0.38, 0.43, 0.53] },
      { tool: 'table', box: [0.47, 0.38, 0.64, 0.53] },
      { tool: 'rfid', box: [0.04, 0.62, 0.21, 0.77] },
      { tool: 'rfid', box: [0.26, 0.62, 0.43, 0.77] }
    ]
    const created = []
    for (const step of plan) {
      const toolName = step.tool === 'lineV' ? 'line' : step.tool
      const clicked = await click(`[data-tool="${toolName}"]`)
      if (!clicked) throw new Error('tool button missing: ' + toolName)
      await sleep(120)
      const [x1, y1] = px(step.box[0], step.box[1])
      const [x2, y2] = px(step.box[2], step.box[3])
      await drag(x1, y1, x2, y2)
      await sleep(320)
      created.push({ tool: step.tool, toolName })
    }
    const after = await rows()
    results['B-02 八种对象工具拖拽创建均排入对象（条码/文字/线条/斜线/矩形/图片/表格/RFID）'] =
      after.length === plan.length && after.length === 10

    const byType = (type) => after.filter((r) => r.type === type)
    results['B-02 拖拽创建的对象类型与工具一致'] =
      byType('barcode').length === 1 && byType('text').length === 1 && byType('line').length === 3 &&
      byType('rect').length === 1 && byType('image').length === 1 && byType('table').length === 1 && byType('rfid').length === 2

    // 帮助 label_object_create_drag.html：直线工具只能创建水平或垂直的线条，方向由拖动方向决定。
    const hLine = byType('line').find((r) => r.h === 0 && r.w > 0)
    const vLine = byType('line').find((r) => r.w === 0 && r.h > 0)
    results['B-02 线条工具按拖动方向吸附为水平线（h=0）或垂直线（w=0）'] = Boolean(hLine) && Boolean(vLine)

    // 帮助 label_object_line.html：斜线是任意角度倾斜的线条（拖拽包围盒两侧均为正）。
    const diag = byType('line').find((r) => r.w > 0 && r.h > 0)
    results['B-02 斜线工具保留拖拽包围盒（w>0 且 h>0，渲染为斜线）'] = Boolean(diag)

    const barcodeRow = byType('barcode')[0]
    results['B-02 拖拽创建的对象尺寸来自拖拽框（宽大于高）'] = barcodeRow.w > barcodeRow.h && barcodeRow.w > 2 && barcodeRow.h > 2

    // 帮助 label_object_create.html / label_object_create_drag.html：
    // 「鼠标变为对应的图标」——绘制类工具激活时标签编辑区为十字光标。
    await click('[data-tool="barcode"]'); await sleep(200)
    const cursorDraw = await evaluate(`(() => { const e=document.querySelector('[data-testid=template-edit-area]'); return e ? { attr:e.getAttribute('data-draw-cursor'), css:getComputedStyle(e).cursor } : null })()`)
    await click('[data-tool="select"]'); await sleep(200)
    const cursorSelect = await evaluate(`(() => { const e=document.querySelector('[data-testid=template-edit-area]'); return e ? { attr:e.getAttribute('data-draw-cursor'), css:getComputedStyle(e).cursor } : null })()`)
    results['B-02 对象工具激活时标签编辑区显示绘制光标，选取工具恢复默认指针'] =
      !!cursorDraw && cursorDraw.attr === 'crosshair' && cursorDraw.css === 'crosshair' &&
      !!cursorSelect && cursorSelect.attr === 'default' && cursorSelect.css === 'default'

    // 帮助 label_object_create_paste.html：复制粘贴创建新对象，新对象属性与原有对象一致。
    await selectRow(barcodeRow.id)
    const beforePaste = (await rows()).length
    await pressKey('c', { ctrlKey: true }); await sleep(300)
    await pressKey('v', { ctrlKey: true }); await sleep(420)
    const afterPaste = await rows()
    const pasted = afterPaste.find((r) => r.type === 'barcode' && r.id !== barcodeRow.id)
    results['B-02 复制粘贴创建一个新对象（数量 +1）'] = afterPaste.length === beforePaste + 1 && Boolean(pasted)
    results['B-02 粘贴出的对象与源对象同属性（宽高一致）且带偏移'] =
      Boolean(pasted) && pasted.w === barcodeRow.w && pasted.h === barcodeRow.h && (pasted.x !== barcodeRow.x || pasted.y !== barcodeRow.y)
    // 状态栏提示以 title 承载（真机 44-statusbar.png 的空闲态同样没有独立消息面板）
    results['B-02 粘贴动作在状态栏留下提示文案'] = /已粘贴/.test(await evaluate(`document.querySelector('[data-testid=status-bar]')?.getAttribute('title') || ''`))

    // ================= B-05 所见即所得编辑闭环 =================
    // 帮助 label_object_edit.html：「双击对象后在属性页中修改属性，字体等属性也可直接操作工具栏修改」
    const textRow = (await rows()).find((r) => r.type === 'text')
    await selectRow(textRow.id)
    await pressKey('Enter', { altKey: true })
    const dblOpened = await waitFor('!!document.querySelector("[data-testid=object-props-dialog]")')
    results['B-05 选中对象后可从属性页入口打开属性页'] = dblOpened
    await closeProps()

    const pngBefore = await canvasPng()
    // 先试真实点击（粗体按钮）：确认「改属性会不会丢选中」
    await evaluate(`(() => { const b=[...document.querySelectorAll('[data-testid=format-bar] button')].find((e)=>e.title==='粗体'); if(b) b.click(); return !!b })()`)
    await sleep(400)
    await evaluate(`(() => { const b=[...document.querySelectorAll('[data-testid=format-bar] button')].find((e)=>e.title==='粗体'); if(b) b.click(); return !!b })()`)
    await sleep(400)
    await setValue('[data-testid="format-font-size"]', '24')
    await sleep(500)
    const pngAfterFormat = await canvasPng()
    results['B-05 通过格式栏改字号后画布即时重绘（所见即所得）'] = pngBefore !== pngAfterFormat
    results['B-05 格式栏改后的值回填格式栏自身'] =
      (await evaluate(`document.querySelector('[data-testid=format-font-size]')?.value`)) === '24'

    // 同一属性在属性页与格式栏之间必须同步（不能两处改同一属性而不同步）
    await pressKey('Enter', { altKey: true })
    await waitFor('!!document.querySelector("[data-testid=object-props-dialog]")')
    await sleep(220)
    // 字号字段在「字体」页（帮助 label_object_page_font.html）
    await click('[data-testid="object-props-tab-font"]'); await sleep(240)
    const dialogPt = await evaluate(`document.querySelector('[data-testid=object-props-font-size]')?.value`)
    results['B-05 格式栏改动的字号同步到属性页（同一属性同一来源）'] = dialogPt === '24'
    // 属性对话框是事务式的：改字段只落到草稿，点「确定」才写回文档（原版模态对话框一致）。
    await setValue('[data-testid="object-props-font-size"]', '10')
    await sleep(400)
    await evaluate(`(() => { const b=[...document.querySelectorAll('[data-testid=object-props-dialog] button')].find((e)=>e.textContent.trim()==='确定'); if(b) b.click(); return !!b })()`)
    await sleep(450)
    results['B-05 属性页改字号并「确定」后写回文档并同步到格式栏'] =
      !await evaluate('!!document.querySelector("[data-testid=object-props-dialog]")') &&
      (await evaluate(`document.querySelector('[data-testid=format-font-size]')?.value`)) === '10'

    // 「也可对齐对象、调整前后层次、旋转对象」
    await pressKey('a', { ctrlKey: true }); await sleep(300)
    await openMenu('排列(A)')
    await clickItem('对齐')
    await clickItem('左对齐')
    await sleep(320)
    const xs = (await rows()).map((r) => r.x)
    results['B-05 多选后对齐使全部对象左边界一致'] = xs.length >= 2 && xs.every((x) => x === xs[0])

    await pressKey('a', { ctrlKey: true }); await sleep(300)
    await openMenu('排列(A)')
    await clickItem('旋转')
    await clickItem('右旋90度')
    await sleep(320)
    const rots = (await rows()).map((r) => r.rot)
    results['B-05 多选后执行旋转使全部对象同步转到同一角度'] =
      rots.length >= 2 && rots.every((r) => r === rots[0]) && rots[0] !== 0
    results['B-05 旋转角度落在 0/90/180/270 四档'] = rots.every((r) => [0, 90, 180, 270].includes(r))
    await closeMenu('排列(A)')

    const topmost = (await rows())[0]
    // 先在画布空白处点一下清掉画布选中集：图层行点击只改模型的 selectedId，
    // 而排列/对齐命令取的是画布选中集，否则这里会作用到上一步 Ctrl+A 留下的 11 个对象。
    await clickEmptyCanvas()
    await selectRow(topmost.id)
    await openMenu('排列(A)')
    await clickItem('移到最后')
    const orderAfter = await rows()
    results['B-05 调整前后层次改变图层顺序（把最上层对象移到最末）'] =
      orderAfter.length >= 2 && orderAfter[orderAfter.length - 1].id === topmost.id
    if (orderAfter[orderAfter.length - 1].id !== topmost.id) {
    }
    await closeMenu('排列(A)')

    // ================= B-44 RFID 标记对象 =================
    const rfidRows = (await rows()).filter((r) => r.type === 'rfid')
    results['B-44 模板中可同时排入多个 RFID 标记对象'] = rfidRows.length === 2
    results['B-44 RFID 对象在图层窗体有独立条目'] =
      rfidRows.every((r) => r.text.trim().length > 0)

    const rfidSrc = await evaluate(`(() => { const r=[...document.querySelectorAll('[data-testid=layer-object-row]')].find((e)=>e.getAttribute('data-object-type')==='rfid'); return r? r.getAttribute('data-object-id') : null })()`)
    const rfidSelected = await selectRow(rfidSrc)
    if (!rfidSelected) throw new Error('rfid row not selectable')
    await pressKey('Enter', { altKey: true })
    if (!await waitFor('!!document.querySelector("[data-testid=object-props-dialog]")')) throw new Error('rfid props did not open')
    await sleep(220)
    await click('[data-testid="object-props-tab-rfid"]'); await sleep(260)

    // 帮助 label_object_page_rfid.html：读写器类型 / 数据段位置 / 起始块位置 / 数据类型 / PC 协议控制字
    const readerOptions = await optionsOf('[data-testid="object-props-dialog"] [data-testid="rfid-reader-type"]')
    const readerLabels = await evaluate(`[...(document.querySelector('[data-testid="object-props-dialog"] [data-testid="rfid-reader-type"]')?.options||[])].map((o)=>o.textContent.trim())`)
    results['B-45 读写器类型给出 5 项协议（自动/ISO18000-6C/ISO14443/国标/军标）'] =
      Array.isArray(readerOptions) && readerOptions.length === 5 &&
      ['auto', 'iso18000-6c', 'iso14443', 'gbt29768', 'gjb7377'].every((v) => readerOptions.includes(v))
    results['B-45 读写器类型含 UHF(HF) 与国标/军标文案'] =
      readerLabels.some((t) => t.includes('UHF')) && readerLabels.some((t) => t.includes('HF')) &&
      readerLabels.some((t) => t.includes('国标')) && readerLabels.some((t) => t.includes('军标'))

    const bankOptions = await optionsOf('[data-testid="object-props-dialog"] [data-testid="rfid-bank"]')
    results['B-45 数据段位置为 EPC / USER / TID 三项'] = JSON.stringify(bankOptions) === JSON.stringify(['EPC', 'USER', 'TID'])

    const startBlock = await evaluate(`(() => { const e=document.querySelector('[data-testid="object-props-dialog"] [data-testid="rfid-start-block"]'); return e ? { value:e.value, min:e.getAttribute('min'), type:e.type } : null })()`)
    results['B-45 起始块位置为不小于 0 的数字字段'] = !!startBlock && startBlock.type === 'number' && startBlock.min === '0'

    const dataTypes = await optionsOf('[data-testid="object-props-dialog"] [data-testid="rfid-data-type"]')
    results['B-45 数据类型含十六进制与 ASCII'] =
      Array.isArray(dataTypes) && dataTypes.includes('hex') && dataTypes.includes('ascii')

    const pcWord = await evaluate(`!!document.querySelector('[data-testid="object-props-dialog"] [data-testid="rfid-pc-word"]')`)
    const codeHead = await evaluate(`!!document.querySelector('[data-testid="object-props-dialog"] [data-testid="rfid-code-head"]')`)
    const codeLen = await evaluate(`!!document.querySelector('[data-testid="object-props-dialog"] [data-testid="rfid-code-len"]')`)
    results['B-45 EPC 区 PC 协议控制字（PC 值/编码码头/编码长度）齐备'] = pcWord === true && codeHead === true && codeLen === true

    await setValue('[data-testid="object-props-dialog"] [data-testid="rfid-bank"]', 'USER')
    await sleep(300)
    const pcWordAfter = await evaluate(`!!document.querySelector('[data-testid="object-props-dialog"] [data-testid="rfid-pc-word"]')`)
    const codeHeadAfter = await evaluate(`!!document.querySelector('[data-testid="object-props-dialog"] [data-testid="rfid-code-head"]')`)
    results['B-45 PC 值仅在 EPC 区提供，切到 USER 区后隐藏而编码码头仍保留'] =
      pcWordAfter === false && codeHeadAfter === true

    await setValue('[data-testid="object-props-dialog"] [data-testid="rfid-bank"]', 'EPC')
    await sleep(300)
    const readerKept = await evaluate(`document.querySelector('[data-testid="object-props-dialog"] [data-testid="rfid-reader-type"]')?.value`)
    results['B-45 RFID 字段改动在属性页内自洽（切回 EPC 后 PC 值字段复现）'] =
      readerKept === 'auto' && (await evaluate(`!!document.querySelector('[data-testid="object-props-dialog"] [data-testid="rfid-pc-word"]')`)) === true
    await closeProps()

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
