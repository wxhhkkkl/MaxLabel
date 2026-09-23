/* round-79：待核清零簇（对象操作 + 条码码制特性）。
 *
 * - A-246 帮助 menu_tools.html：工具菜单项顺序为 选取/条码/文字/线条/斜线/矩形/图片/
 *   表格/RFID/数据，再 放大/缩小/适应宽度/适应高度/适合窗口；Alt+T 调出；点 RFID
 *   应激活 RFID 工具并能在画布上创建 RFID 对象。
 * - B-13 帮助 label_object_select.html / label_object_select_key.html：任何对象操作都要
 *   先选取对象（未选取时对象命令灰色）；TAB 或 CTRL+T 依次选中模板上的每个对象。
 * - B-17 帮助 label_object_change.html：数据工具点对象出现「修改数据」对话框，
 *   在「显示数据」处直接输入新数据即可修改对象子串的数据。
 * - B-18 帮助 label_object_align.html：多个对象可结合成一组同时移动；
 *   也可通过常规属性的位置属性精确定位。
 * - B-27 帮助 label_object_align_size.html：排列菜单的尺寸命令（水平同宽/垂直同宽/
 *   水平垂直相同），未选两个及以上对象时灰色不可用。
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
    const waitFor = async (expression, timeout = 3000) => {
      const started = Date.now()
      while (Date.now() - started < timeout) { if (await evaluate(expression)) return true; await sleep(80) }
      return false
    }
    const key = (name, options = {}) => evaluate(`(() => { const e=new KeyboardEvent('keydown',${JSON.stringify({ key: name, code: name, bubbles: true, cancelable: true, ...options })}); window.dispatchEvent(e); document.dispatchEvent(e); return e.defaultPrevented })()`)
    const rows = () => evaluate(`([...document.querySelectorAll('[data-testid=layer-object-row]')].map((e)=>({id:e.dataset.objectId,type:e.dataset.objectType,x:Number(e.dataset.objectX),y:Number(e.dataset.objectY),w:Number(e.dataset.objectW),h:Number(e.dataset.objectH),rotation:Number(e.dataset.objectRotation)})))`)
    const selectedIds = () => evaluate(`([...document.querySelectorAll('[data-testid=layer-object-row]')].filter((e)=>e.dataset.selected==='true').map((e)=>e.dataset.objectId))`)
    const rowId = (type, nth = 0) => evaluate(`(() => { const r=[...document.querySelectorAll('[data-testid=layer-object-row]')].filter((e)=>e.dataset.objectType===${JSON.stringify(type)})[${nth}]; return r ? r.dataset.objectId : null })()`)
    /** 图层行已选中时再点一次会取消选中，这里只在未选中时点击。 */
    const selectRow = async (id) => {
      await evaluate(`(() => { const r=[...document.querySelectorAll('[data-testid=layer-object-row]')].find((e)=>e.dataset.objectId===${JSON.stringify(id)}); if(!r)return false; if(r.dataset.selected!=='true') r.click(); return true })()`)
      await sleep(220)
    }
    const dragCanvas = (x1, y1, x2, y2) => evaluate(`(() => { const c=document.querySelector('canvas.upper-canvas')||document.querySelector('canvas'); if(!c)return false; const b=c.getBoundingClientRect(); const p=(x,y,buttons=1)=>({bubbles:true,cancelable:true,view:window,clientX:b.left+x,clientY:b.top+y,button:0,buttons}); c.dispatchEvent(new MouseEvent('mousedown',p(${x1},${y1}))); c.dispatchEvent(new MouseEvent('mousemove',p(${x2},${y2}))); c.dispatchEvent(new MouseEvent('mouseup',{...p(${x2},${y2},0),buttons:0})); return true })()`)
    const clickCanvas = (x, y) => evaluate(`(() => { const c=document.querySelector('canvas.upper-canvas')||document.querySelector('canvas'); if(!c)return false; const b=c.getBoundingClientRect(); const init={bubbles:true,cancelable:true,view:window,clientX:b.left+${x},clientY:b.top+${y},button:0,buttons:1}; c.dispatchEvent(new MouseEvent('mousedown',init)); c.dispatchEvent(new MouseEvent('mouseup',{...init,buttons:0})); c.dispatchEvent(new MouseEvent('click',{...init,buttons:0})); return true })()`)
    const setInputValue = (selector, value) => evaluate(`(() => {
      const input=document.querySelector(${JSON.stringify(selector)}); if(!input)return false;
      const setter=Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype,'value').set;
      setter.call(input, ${JSON.stringify(value)});
      input.dispatchEvent(new Event('input',{bubbles:true}));
      return true
    })()`)

    // ---- 菜单操作 ----
    const visibleItems = () => evaluate(`([...document.querySelectorAll('[data-menu-item]')].filter((e)=>e.offsetParent).map((e)=>({label:e.getAttribute('data-menu-item'),disabled:e.getAttribute('data-menu-disabled')==='true'})))`)
    /** 关闭已打开的菜单：再点一次同一个顶级标题（MenuBar 的 toggle 语义）。 */
    const closeMenu = async () => {
      await evaluate(`(() => {
        const b=[...document.querySelectorAll('[data-menu-title]')].find((n)=>getComputedStyle(n).backgroundColor!=='rgba(0, 0, 0, 0)' && getComputedStyle(n).backgroundColor!=='transparent');
        if(b) b.click(); return true
      })()`)
      await sleep(180)
    }
    const openMenu = async (title) => {
      if ((await visibleItems()).length > 0) await closeMenu()
      await evaluate(`(() => { const e=[...document.querySelectorAll('[data-menu-title]')].find((n)=>n.getAttribute('data-menu-title').startsWith(${JSON.stringify(title)})); if(!e)return false; e.click(); return true })()`)
      await sleep(220)
    }
    const clickSubItem = async (label) => {
      const ok = await evaluate(`(() => { const e=[...document.querySelectorAll('[data-menu-item]')].find((c)=>c.offsetParent && c.getAttribute('data-menu-item')===${JSON.stringify(label)}); if(!e)return false; e.click(); return true })()`)
      await sleep(220)
      return ok
    }
    const itemState = async (label) => {
      const hit = (await visibleItems()).find((i) => i.label === label)
      return hit ? hit.disabled : null
    }
    const approx = (a, b) => Math.abs(a - b) < 0.05

    await sleep(1800)
    await evaluate('document.querySelector("button[aria-label=关闭]")?.click()'); await sleep(200)
    await key('n', { ctrlKey: true }); await sleep(350)
    if (await evaluate('!!document.querySelector("[data-testid=template-wizard]")')) { await click('[data-testid="wizard-next"]'); await sleep(350) }
    await click('[data-testid="new-label-select"]')
    if (!await waitFor('!!document.querySelector("canvas.upper-canvas")', 8000)) throw new Error('editor did not open')

    // ================= A-246 工具菜单 =================
    const altT = await key('t', { altKey: true })
    await sleep(250)
    let toolItems = (await visibleItems()).map((i) => i.label)
    if (toolItems.length === 0) { await openMenu('工具'); toolItems = (await visibleItems()).map((i) => i.label) }
    // 顺序以**真机弹菜单实拍**为准（parity/reference/labelshop/r162-menu-03-tool.png；并排图
    // parity/review/cmp-menu-tool-r162.png）：真机是 `图片(P) → 数据(D) → 表格(G)`；帮助 menu_tools.html
    // 写的是「表格」在前，与真机不符 ⇒ 按真机改（DIFF-65）。末项 RFID 真机该图不显示（按硬件条件显示）。
    const REAL_TOOL_ORDER = ['选取(S)', '条码(B)', '文字(T)', '线条(L)', '斜线(L)', '矩形(R)', '图片(P)', '数据(D)', '表格(G)', '放大(I)', '缩小(O)', '适应宽度', '适应高度', '适合窗口(W)']
    results['A-246 Alt+T 调出工具菜单'] = Boolean(altT) && toolItems.length > 0
    results['A-246 工具菜单项与真机 r162-menu-03-tool.png 顺序一致（数据 在 表格 之前）'] = JSON.stringify(toolItems) === JSON.stringify(REAL_TOOL_ORDER)
    // RFID 已按 DIFF-65 从菜单移除（真机菜单资源里 `工具(&T)` 段没有该项）；创建入口在工具栏按钮上，
    // 因此这条断言改为验证**工具栏**入口仍然可用（能力未丢，只是不再占据真机没有的菜单项）。
    results['A-246 工具菜单不含真机没有的 RFID 项'] = !toolItems.includes('RFID')
    await closeMenu()
    const rfidClicked = await click('[data-testid="toolbar"] button[data-tool="rfid"]')
    const rfidActive = await evaluate(`document.querySelector('[data-testid="toolbar"] button[data-tool="rfid"]')?.getAttribute('aria-pressed')==='true'`)
    await dragCanvas(360, 330, 440, 390)
    await sleep(450)
    const afterRfid = await rows()
    results['A-246 工具栏 RFID 按钮激活工具并在画布创建 RFID 对象'] = rfidClicked && rfidActive && afterRfid.some((r) => r.type === 'rfid')

    // 素材：3 个矩形 + 1 个文字
    // 三个宽度不同的矩形，供「水平同宽」验证尺寸确实按参考对象收敛
    for (const [x1, y1, w] of [[120, 120, 80], [250, 120, 115], [400, 120, 60]]) {
      await click('[data-testid="toolbar"] button[data-tool="rect"]')
      await dragCanvas(x1, y1, x1 + w, y1 + 60); await sleep(380)
    }
    await click('[data-testid="toolbar"] button[data-tool="text"]')
    await dragCanvas(520, 240, 620, 300); await sleep(420)
    await click('[data-testid="toolbar"] button[data-tool="select"]'); await sleep(150)

    // ================= B-13 先选取对象 + TAB/CTRL+T 依次选取 =================
    await clickCanvas(60, 430); await sleep(220)
    const noSel = (await selectedIds()).length === 0
    await openMenu('排列')
    const sizeParentWhenNone = await itemState('尺寸')
    const orderWhenNone = await itemState('移到最前')
    await closeMenu()
    results['B-13 未选取对象时对象相关命令灰色不可用（须先选取对象）'] = noSel && sizeParentWhenNone === true && orderWhenNone === true

    const totalObjects = (await rows()).length
    const visited = []
    for (let i = 0; i < totalObjects + 1; i++) {
      await key('t', { ctrlKey: true }); await sleep(220)
      const sel = await selectedIds()
      if (sel.length === 1) visited.push(sel[0])
    }
    // 依次轮转：每次恰好选中一个对象，且 totalObjects 次内不重复地走遍全部对象
    const distinct = new Set(visited.slice(0, totalObjects))
    results['B-13 CTRL+T 依次选中模板上的每个对象（逐个轮转）'] =
      visited.length === totalObjects + 1 && distinct.size === totalObjects && visited[0] !== visited[1]

    await clickCanvas(60, 430); await sleep(200)
    await key('Tab'); await sleep(280)
    const tabFirst = await selectedIds()
    await key('Tab'); await sleep(280)
    const tabSecond = await selectedIds()
    results['B-13 TAB 键同样可依次选中每个对象'] = tabFirst.length === 1 && tabSecond.length === 1 && tabFirst[0] !== tabSecond[0]

    // ================= B-17 数据工具 → 修改数据 =================
    const textId = await rowId('text')
    await click('[data-testid="toolbar"] button[data-tool="data"]'); await sleep(200)
    const dataToolOn = await evaluate(`document.querySelector('[data-testid="toolbar"] button[data-tool="data"]')?.getAttribute('aria-pressed')==='true'`)
    await clickCanvas(570, 270); await sleep(500)
    const dlgOpen = await waitFor('!!document.querySelector("[data-testid=change-data-dialog]")')
    const hasDisplayField = await evaluate(`document.body.innerText.includes('显示数据')`)
    results['B-17 数据工具点对象打开「修改数据」对话框'] = dataToolOn && dlgOpen && hasDisplayField
    const typed = await setInputValue('[data-testid=change-data-input]', 'SERIAL-42')
    await sleep(180)
    const confirmed = await evaluate(`(() => { const b=[...document.querySelectorAll('[data-testid=change-data-dialog] button')].find((e)=>e.textContent.trim()==='确定'); if(!b)return false; b.click(); return true })()`)
    await sleep(500)
    const closed = !(await evaluate('!!document.querySelector("[data-testid=change-data-dialog]")'))
    // 回读：再次用数据工具点同一对象，显示数据应已是新值
    // 回读：选中该对象打开属性对话框的「数据」页，常量内容应已是新值
    await selectRow(textId)
    await key('Enter', { altKey: true }); await sleep(500)
    await evaluate(`document.querySelector('[data-testid=object-props-tab-datasource]')?.click()`); await sleep(300)
    const readback = await evaluate(`(() => {
      const labels=[...document.querySelectorAll('[data-testid=object-props-dialog] label')];
      const hit=labels.find((l)=>l.textContent.trim().startsWith('常量内容'));
      const inp=hit?.parentElement?.querySelector('input');
      return inp ? inp.value : ''
    })()`)
    await evaluate(`(() => { const b=[...document.querySelectorAll('[data-testid=object-props-dialog] button')].find((e)=>e.textContent.trim()==='取消'); b?.click(); return true })()`)
    await sleep(350)
    results[`B-17 在「显示数据」输入后确定即改写对象数据（回读 ${readback}）`] = typed && closed && confirmed && readback === 'SERIAL-42' && !!textId
    await click('[data-testid="toolbar"] button[data-tool="select"]'); await sleep(150)

    // ================= B-27 排列菜单尺寸命令 =================
    await clickCanvas(60, 430); await sleep(220)
    const rectsBefore = (await rows()).filter((r) => r.type === 'rect')
    await selectRow(rectsBefore[0].id)
    await openMenu('排列')
    await clickSubItem('尺寸')
    const sizeWhenOne = await itemState('水平同宽')
    const sizeLabels = (await visibleItems()).map((i) => i.label)
    await closeMenu()
    results['B-27 只选一个对象时尺寸命令灰色不可用'] = sizeWhenOne === true
    results['B-27 尺寸命令文案为帮助原文（水平同宽/垂直同宽/水平垂直相同）'] =
      ['水平同宽', '垂直同宽', '水平垂直相同'].every((l) => sizeLabels.includes(l)) &&
      !sizeLabels.includes('宽度相同') && !sizeLabels.includes('高度相同')

    await key('a', { ctrlKey: true }); await sleep(300)
    // 帮助：以参考对象为基准，把选定对象的水平尺寸改为参考对象的水平尺寸
    const beforeSame = (await rows()).filter((r) => r.type === 'rect')
    await openMenu('排列')
    await clickSubItem('尺寸')
    const sizeEnabledMany = (await itemState('水平同宽')) === false
    const clickedSame = await clickSubItem('水平同宽')
    await sleep(450)
    const afterSame = (await rows()).filter((r) => r.type === 'rect')
    const allEqualWidth = afterSame.length >= 2 && afterSame.every((r) => approx(r.w, afterSame[0].w))
    const changed = afterSame.some((r) => {
      const was = beforeSame.find((b) => b.id === r.id)
      return was && !approx(was.w, r.w)
    })
    results[`B-27 选中多个对象后「水平同宽」按参考对象改尺寸（等宽 ${allEqualWidth}／有变化 ${changed}）`] =
      sizeEnabledMany && allEqualWidth && changed

    // ================= B-18 组合成组同时移动 + 常规属性位置精确定位 =================
    await clickCanvas(60, 430); await sleep(200)
    await key('a', { ctrlKey: true }); await sleep(300)
    const beforeChildren = (await rows()).filter((r) => r.type !== 'group')
    const groupClicked = await click('[data-testid="format-bar"] button[title^="组合（"]')
    await sleep(500)
    const afterGroup = await rows()
    const groupRow = afterGroup.find((r) => r.type === 'group')
    const childrenNow = afterGroup.filter((r) => r.type !== 'group')
    results['B-18 多个对象结合成一组（组行带全部子对象）'] =
      groupClicked && !!groupRow && childrenNow.length === beforeChildren.length && beforeChildren.length >= 2

    await selectRow(groupRow.id)
    await key('Enter', { altKey: true }); await sleep(500)
    const propsOpen = await waitFor('!!document.querySelector("[data-testid=object-props-dialog]")', 4000)
    const newX = groupRow.x + 25
    // round-139：常规范式的 X 字段按真机改名为 `水平(&H):`（probe-44），按标签文字找已失效；
    // 改成按 testid 精确定位（比文字更严，且顺带要求该字段在常规页存在）。
    const setX = await evaluate(`(() => {
      const input=document.querySelector('[data-testid=object-props-dialog] [data-testid=obj-x]'); if(!input)return false;
      const setter=Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype,'value').set;
      setter.call(input, String(${newX}));
      input.dispatchEvent(new Event('input',{bubbles:true}));
      return true
    })()`)
    await evaluate(`(() => { const b=[...document.querySelectorAll('[data-testid=object-props-dialog] button')].find((e)=>e.textContent.trim()==='确定'); b?.click(); return true })()`)
    await sleep(600)
    const afterMove = await rows().then((list) => list.filter((r) => r.type !== 'group'))
    const allMoved = beforeChildren.every((c) => {
      const now = afterMove.find((r) => r.id === c.id)
      return now && approx(now.x - c.x, 25) && approx(now.y - c.y, 0)
    })
    results[`B-18 组内对象随组一起移动（常规属性 X +25mm）`] = propsOpen && setX && allMoved

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
