/*
 * 需求清单「对象编辑」15 条逐条对齐（round-114）。
 *
 * 清单判据来自原版自带的帮助文档（app/docs/labelshop-help-zh，随 6.37/6.39 安装包分发）：
 *   - 38 CTRL+单击      label_object_select_mouse.html「按住CTRL键单击选取，可以选择多个对象」
 *   - 39 SHIFT+单击     label_object_select_mouse.html「按住SHIFT键单击选取，可以选择/择选对象」
 *   - 40 拷贝粘贴       shortcut_main.html「CTRL+C 复制当前选取的对象到系统剪切板」「CTRL+V 粘贴系统剪切板上的内容到当前模板」
 *   - 41 剪切粘贴       shortcut_main.html「CTRL+X / SHIFT+DELETE 剪切当前选取的对象到系统剪切板」
 *   - 42 CTRL+拖动      帮助**无记载**（快捷键页无此组合）→ 复刻版按「不复制副本」处理并在此留证
 *   - 45 鼠标拖动       label_object_move_mouse.html
 *   - 46 键盘方向键     label_object_move_key.html + shortcut_main.html（移动对象分组：0.5mm / Shift 5mm）
 *   - 47 鼠标拖动调整尺寸 label_object_size.html（角把柄保比、中间把柄长扁、SHIFT 等尺寸、输出步长）
 *                      → 已由 ui-v76.cjs 的 B-15/B-16 覆盖，这里不重复
 *   - 54 菜单/工具栏调整层次 label_object_align_order.html
 *   - 55 CTRL+B         shortcut_main.html「CTRL+B 将当前选取的对象移到最后」
 *   - 56/57 旋转         label_object_align_rotate.html → 多选绕视觉中心已由 ui-v99 覆盖，这里补单对象
 *   - 58 组合（含多级）  label_object_align_group.html
 *   - 59 解组            label_object_align_group.html
 *   - 60 位置锁定        label_object_align_pos.html + label_object_page_general.html
 *                      「位置被锁定的对象不能被移动」「使用常规属性页时位置选项被禁止无法更改其数值」
 *                      「如果一个锁定的对象被组合，对象将失去位置锁定属性」
 *
 * 三条实测出来的驱动约定（都写进这里的注释，后面脚本照抄）：
 *   1. 手势一律走 CDP Input 域：页面内 new MouseEvent 驱动不了 Fabric 的变换状态机（ui-v109 顶部注释）。
 *   2. 「单选」用图层行的 DOM click（data-selected 只反映单一 selectedId）；切换到单选前必须先点
 *      画布空白处清空——多选状态下点已选对象会被 Fabric 当成「拖动整组」。
 *   3. 清空选取的落点必须既在画布内在可视区内、又不压对象：(360, 300) 是实测可用点；
 *      画布 1000×700 时的右下角会掉到窗口可视区外，CDP 鼠标事件被丢弃、选取清不掉。
 *   另外：矩形是空心图形（点内部不选中，对标原版），需要选中时用图层行，或改用实心对象。
 */
const http = require('http')
const WebSocket = require('ws')

const MOD = { alt: 1, ctrl: 2, meta: 4, shift: 8 }

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
    await client.send('Runtime.enable')
    const evaluate = async (expression) => {
      const result = await client.send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true })
      if (result.exceptionDetails) {
        const detail = result.exceptionDetails.exception?.description || result.exceptionDetails.text
        throw new Error(detail + '  <<< ' + String(expression).slice(0, 160).replace(/\s+/g, ' '))
      }
      return result.result?.value
    }
    const click = (selector) => evaluate(`(() => { const e=document.querySelector(${JSON.stringify(selector)}); if(!e || e.disabled)return false; e.click(); return true })()`)
    const waitFor = async (expression, timeout = 4000) => {
      const started = Date.now()
      while (Date.now() - started < timeout) {
        if (await evaluate(expression)) return true
        await sleep(80)
      }
      return false
    }
    // 只派发给 window：document 上再派发一次会冒泡回 window，事件被消费两遍
    // （复制粘贴会粘两份、方向键会走两步 —— round-114 实测）。
    const key = (name, options = {}) => evaluate(`(() => { const e=new KeyboardEvent('keydown',${JSON.stringify({ key: name, code: name, bubbles: true, cancelable: true, ...options })}); window.dispatchEvent(e); return true })()`)
    const rows = () => evaluate(`([...document.querySelectorAll('[data-testid=layer-object-row]')].map((e)=>({
      id:e.dataset.objectId, type:e.dataset.objectType, sel:e.dataset.selected==='true',
      x:Number(e.dataset.objectX), y:Number(e.dataset.objectY), w:Number(e.dataset.objectW), h:Number(e.dataset.objectH),
      rot:Number(e.dataset.objectRotation), text:e.textContent })))`)
    const canvasRect = () => evaluate(`(() => { const c=document.querySelector('canvas.upper-canvas')||document.querySelector('canvas'); if(!c)return null
      const b=c.getBoundingClientRect(); return b.width>0 ? { left:b.left, top:b.top, width:b.width, height:b.height } : null })()`)
    let rect = null
    const pointIn = (row, rx = 0.5, ry = 0.5) => ({ x: rect.left + (row.x + row.w * rx) * 10, y: rect.top + (row.y + row.h * ry) * 10 })
    const mouse = (type, x, y, buttons, modifiers = 0) => client.send('Input.dispatchMouseEvent', {
      type, x, y, button: 'left', buttons, clickCount: type === 'mousePressed' ? 1 : 0, modifiers
    })
    const clickAt = async (x, y, modifiers = 0) => {
      await mouse('mouseMoved', x, y, 0, modifiers); await sleep(40)
      await mouse('mousePressed', x, y, 1, modifiers); await sleep(50)
      await mouse('mouseReleased', x, y, 0, modifiers); await sleep(170)
    }
    const dragAt = async (x1, y1, x2, y2, modifiers = 0) => {
      await mouse('mouseMoved', x1, y1, 0, modifiers); await sleep(40)
      await mouse('mousePressed', x1, y1, 1, modifiers); await sleep(70)
      await mouse('mouseMoved', (x1 + x2) / 2, (y1 + y2) / 2, 1, modifiers); await sleep(70)
      await mouse('mouseMoved', x2, y2, 1, modifiers); await sleep(70)
      await mouse('mouseReleased', x2, y2, 0, modifiers); await sleep(250)
    }
    const byId = async (id) => (await rows()).find((row) => row.id === id)
    const rowClick = async (id) => {
      const ok = await evaluate(`(() => { const r=[...document.querySelectorAll('[data-testid=layer-object-row]')].find((e)=>e.dataset.objectId===${JSON.stringify(id)})
        if(!r)return false; if(r.dataset.selected!=='true') r.click(); return true })()`)
      await sleep(180)
      return ok
    }
    const fabricSelection = () => evaluate(`(() => { const root=document.querySelector('[data-active-fabric-selection]'); if(!root)return { ids: [], primaryId: null }
      try { return JSON.parse(root.getAttribute('data-active-fabric-selection')) } catch (error) { return { ids: [], primaryId: null } } })()`)
    const selectedIds = async () => (await fabricSelection()).ids
    const clearSelection = async () => { await clickAt(rect.left + 360, rect.top + 300) }
    const selectOnly = async (id) => { await clearSelection(); await sleep(140); await rowClick(id) }
    const clickObject = async (id, modifiers = 0) => {
      const row = await byId(id)
      if (!row) return false
      const point = pointIn(row)
      await clickAt(point.x, point.y, modifiers)
      return true
    }
    const dragObject = async (id, dxMm, dyMm, modifiers = 0) => {
      const row = await byId(id)
      if (!row) return false
      const point = pointIn(row)
      await dragAt(point.x, point.y, point.x + dxMm * 10, point.y + dyMm * 10, modifiers)
      return true
    }
    const countType = async (type) => (await rows()).filter((row) => row.type === type).length
    const lockedCount = async () => (await rows()).filter((row) => row.text.indexOf('🔒') >= 0).length
    const menuItems = () => evaluate(`([...document.querySelectorAll('[data-menu-item]')].filter((e)=>e.offsetParent).map((e)=>e.getAttribute('data-menu-item')))`)
    const openMenu = async (title) => {
      await evaluate(`(() => { const b=document.querySelector('[data-menu-title=${JSON.stringify(title)}]'); if(!b)return false; if(!b.parentElement.querySelector('[data-menu-item],[data-menu-divider]')) b.click(); return true })()`)
      await sleep(180)
      return menuItems()
    }
    const clickItem = async (label) => { const ok = await click(`[data-menu-item=${JSON.stringify(label)}]`); await sleep(300); return ok }
    const newDocument = async () => {
      await key('n', { ctrlKey: true }); await sleep(460)
      if (await evaluate('!!document.querySelector("[data-testid=template-wizard]")')) {
        await click('[data-testid="wizard-next"]'); await sleep(380)
      }
      await click('[data-testid="new-label-select"]')
      await waitFor('!!document.querySelector("canvas.upper-canvas")', 9000)
      await evaluate(`(() => { const z=document.querySelector('[data-testid="zoom-level"]'); if(!z)return false
        const proto = z instanceof HTMLSelectElement ? HTMLSelectElement.prototype : HTMLInputElement.prototype
        const setter=Object.getOwnPropertyDescriptor(proto,'value').set; setter.call(z,'1')
        z.dispatchEvent(new Event('input',{bubbles:true})); z.dispatchEvent(new Event('change',{bubbles:true})); return true })()`)
      await sleep(380)
      rect = await canvasRect()
    }
    const createObject = async (tool, x1, y1, x2, y2) => {
      await click(`[data-tool="${tool}"]`); await sleep(170)
      await evaluate(`(() => { const c=document.querySelector('canvas.upper-canvas'); const b=c.getBoundingClientRect()
        const p=(x,y,buttons=1)=>({bubbles:true,cancelable:true,view:window,clientX:b.left+x,clientY:b.top+y,button:0,buttons})
        c.dispatchEvent(new MouseEvent('mousedown',p(${x1},${y1}))); c.dispatchEvent(new MouseEvent('mousemove',p(${x2},${y2})))
        c.dispatchEvent(new MouseEvent('mouseup',{...p(${x2},${y2},0),buttons:0})); return true })()`)
      await sleep(440)
    }
    const createFour = async () => {
      await createObject('text', 30, 30, 140, 70)     // 文字 A：3..14mm / 3..7mm
      await createObject('text', 220, 30, 340, 70)    // 文字 B：22..34mm / 3..7mm
      await createObject('barcode', 40, 300, 190, 380) // 条码：4..19mm / 30..38mm（实心、尺寸与模型一致）
      await createObject('rect', 40, 470, 160, 570)   // 矩形（空心）：4..16mm / 47..57mm
      await click('[data-tool="select"]'); await sleep(220)
      await clearSelection()
    }

    await sleep(1600)
    await evaluate('document.querySelector("button[aria-label=关闭]")?.click()')

    // ======================= 文档 1：选取 / 移动 / 复制粘贴 =======================
    await newDocument()
    await createFour()
    const first = await rows()
    if (first.length !== 4) throw new Error('expected 4 objects, got ' + first.length)
    const textA = first.filter((row) => row.type === 'text').sort((a, b) => a.x - b.x)[0].id
    const textB = first.filter((row) => row.type === 'text').sort((a, b) => a.x - b.x)[1].id
    const barcodeId = first.find((row) => row.type === 'barcode').id

    // 38 CTRL+单击追加选取
    await selectOnly(textA)
    const afterSingle = await selectedIds()
    await clickObject(textB, MOD.ctrl)
    const afterCtrl = await selectedIds()
    results['38 CTRL+单击追加选取（帮助：按住CTRL键单击选取，可以选择多个对象）'] =
      afterSingle.length === 1 && afterSingle[0] === textA && afterCtrl.length === 2 && afterCtrl.includes(textB)

    // 39 SHIFT+单击 选择/取消选择
    await clickObject(textB, MOD.shift)
    const afterShiftOff = await selectedIds()
    await clickObject(textB, MOD.shift)
    const afterShiftOn = await selectedIds()
    results['39 SHIFT+单击切换选择（帮助：按住SHIFT键单击选取，可以选择/择选对象）'] =
      afterShiftOff.length === 1 && afterShiftOff[0] === textA && afterShiftOn.length === 2

    // 45 鼠标拖动（用条码：尺寸与模型一致，落点与拖动量可精确核对）
    await selectOnly(barcodeId)
    const beforeDrag = await byId(barcodeId)
    await dragObject(barcodeId, 4, 3)
    const afterDrag = await byId(barcodeId)
    // 复刻版在拖动时会做「对齐参考线」吸附（LabelEditor ALIGN_THRESHOLD = 5px，原版帮助无此记载），
    // 落点可能被拉走最多 0.5 毫米，故位移容差取 0.6 毫米；尺寸必须原样不变。
    results['45 鼠标直接拖动对象改变位置且尺寸不变（帮助 label_object_move_mouse.html）'] =
      Math.abs((afterDrag.x - beforeDrag.x) - 4) < 0.6 && Math.abs((afterDrag.y - beforeDrag.y) - 3) < 0.6 &&
      Math.abs(afterDrag.w - beforeDrag.w) < 0.01 && Math.abs(afterDrag.h - beforeDrag.h) < 0.01

    // 46 方向键 0.5mm / SHIFT 5mm
    await selectOnly(barcodeId)
    const beforeKey = await byId(barcodeId)
    await key('ArrowLeft'); await sleep(240)
    await key('ArrowRight', { shiftKey: true }); await sleep(260)
    const afterKey = await byId(barcodeId)
    results['46 方向键 0.5 毫米、SHIFT+方向键 5 毫米（shortcut_main.html 移动对象分组）'] =
      Math.abs((afterKey.x - beforeKey.x) - 4.5) < 0.05 && Math.abs(afterKey.y - beforeKey.y) < 0.05

    // 40 复制粘贴（同模板）
    await selectOnly(textA)
    const beforeCopy = await countType('text')
    await key('c', { ctrlKey: true }); await sleep(320)
    await key('v', { ctrlKey: true })
    await waitFor(`document.querySelectorAll('[data-testid=layer-object-row][data-object-type=text]').length===${beforeCopy + 1}`, 5000)
    const pastedIds = (await rows()).filter((row) => row.type === 'text').map((row) => row.id).filter((id) => id !== textA && id !== textB)
    results['40 CTRL+C / CTRL+V 复制粘贴（帮助 shortcut_main.html 拷贝粘贴分组）'] =
      (await countType('text')) === beforeCopy + 1 && pastedIds.length === 1

    // 41 剪切粘贴（CTRL+X 与 SHIFT+DELETE）
    const pastedId = pastedIds[0]
    await selectOnly(pastedId)
    await key('x', { ctrlKey: true })
    await waitFor(`document.querySelectorAll('[data-testid=layer-object-row][data-object-type=text]').length===${beforeCopy}`, 4000)
    const afterCut = await countType('text')
    await key('v', { ctrlKey: true })
    await waitFor(`document.querySelectorAll('[data-testid=layer-object-row][data-object-type=text]').length===${beforeCopy + 1}`, 4000)
    const afterCutPaste = await countType('text')
    await selectOnly(textB)
    await key('Delete', { shiftKey: true })
    await waitFor(`document.querySelectorAll('[data-testid=layer-object-row][data-object-type=text]').length===${beforeCopy}`, 4000)
    const afterShiftDelete = await countType('text')
    await key('v', { ctrlKey: true })
    await waitFor(`document.querySelectorAll('[data-testid=layer-object-row][data-object-type=text]').length===${beforeCopy + 1}`, 4000)
    const afterRestore = await countType('text')
    results['41 CTRL+X 剪切后 CTRL+V 粘贴还原（帮助：剪切到系统剪切板）'] =
      afterCut === beforeCopy && afterCutPaste === beforeCopy + 1
    results['41 SHIFT+DELETE 同为剪切（shortcut_main.html 明确标注）并可粘贴还原'] =
      afterShiftDelete === beforeCopy && afterRestore === beforeCopy + 1

    // 42 CTRL+拖动（帮助无记载，留证实际行为）
    await selectOnly(textA)
    const beforeCtrlDragCount = (await rows()).length
    await dragObject(textA, 3, 2, MOD.ctrl)
    const afterCtrlDragCount = (await rows()).length
    results['42 CTRL+拖动不产生副本（帮助快捷键页无此组合，复刻版按保守对齐处理）'] =
      afterCtrlDragCount === beforeCtrlDragCount

    // 复制一个对象到剪贴板，供最后的跨模板粘贴用
    await selectOnly(textA)
    await key('c', { ctrlKey: true }); await sleep(340)

    // ======================= 文档 2：层次 / 旋转 / 组合 / 锁定 =======================
    await newDocument()
    await createObject('barcode', 40, 40, 190, 120)  // 条码：4..19mm / 4..12mm
    await createObject('text', 40, 300, 160, 360)    // 文字 C：4..16mm / 30..36mm
    await createObject('text', 230, 300, 350, 360)   // 文字 D：23..35mm / 30..36mm
    await click('[data-tool="select"]'); await sleep(220)
    await clearSelection()
    const second = await rows()
    if (second.length !== 3) throw new Error('expected 3 objects in the second document, got ' + second.length)
    const texts2 = second.filter((row) => row.type === 'text').sort((a, b) => a.x - b.x)
    const textC = texts2[0].id
    const textD = texts2[1].id
    const barcode2 = second.find((row) => row.type === 'barcode').id

    // 55 CTRL+B 移到最后
    await selectOnly(textC)
    await key('b', { ctrlKey: true }); await sleep(360)
    const afterBack = await rows()
    results['55 CTRL+B 将当前选取对象移到最后（shortcut_main.html 排列对象分组）'] =
      afterBack[afterBack.length - 1].id === textC

    // 54 排列菜单「移到最前」
    await selectOnly(textC)
    await openMenu('排列(A)')
    await clickItem('移到最前')
    const afterFront = await rows()
    results['54 排列菜单「移到最前」把对象提到最上层（label_object_align_order.html）'] =
      afterFront[0].id === textC

    // 56 单个对象旋转（多选绕视觉中心见 ui-v99）
    await selectOnly(barcode2)
    const beforeRotate = await byId(barcode2)
    const centerBefore = { x: beforeRotate.x + beforeRotate.w / 2, y: beforeRotate.y + beforeRotate.h / 2 }
    await openMenu('排列(A)')
    await click(`[data-menu-item="旋转"]`); await sleep(200)
    await clickItem('右旋90度')
    const afterRotate = await byId(barcode2)
    const centerAfter = { x: afterRotate.x + afterRotate.w / 2, y: afterRotate.y + afterRotate.h / 2 }
    results['56 单个对象「右旋90度」写入 rotation=90 且绕自身中心（label_object_align_rotate.html）'] =
      afterRotate.rot === 90 && Math.abs(centerAfter.x - centerBefore.x) < 0.3 && Math.abs(centerAfter.y - centerBefore.y) < 0.3

    // 58 组合 / 59 解组（含多级）
    const objectCount = (await rows()).length
    await selectOnly(textC)
    await clickObject(textD, MOD.ctrl)
    const twoSelected = (await selectedIds()).length === 2
    await key('g', { ctrlKey: true }); await sleep(440)
    const grouped = await rows()
    const groupRows = grouped.filter((row) => row.type === 'group')
    results['58 CTRL+G 组合两个对象（帮助 label_object_align_group.html）'] =
      twoSelected && groupRows.length === 1 && grouped.length === objectCount + 1

    // 单击组内任意子对象 ⇒ 选中整组
    const groupId = groupRows[0].id
    const textDRow = grouped.find((row) => row.id === textD)
    const textDPoint = pointIn(textDRow)
    await clickAt(textDPoint.x, textDPoint.y)
    const afterGroupClick = await selectedIds()
    results['58 单击组内任意对象即选中整组'] =
      afterGroupClick.length === 1 && afterGroupClick[0] === groupId

    // 多级组合：把「组合体」与旋转过的条码再组合（先用单选确认旋转后仍可点选）
    await selectOnly(barcode2)
    const barcodeSelected = (await selectedIds()).length === 1
    await clickObject(textD, MOD.ctrl)
    const nestedSelection = (await selectedIds()).length
    await key('g', { ctrlKey: true }); await sleep(460)
    const nested = await rows()
    results['58 多级组合：组合体可与其它对象再次组合（嵌套组合）'] =
      barcodeSelected && nestedSelection === 2 && nested.filter((row) => row.type === 'group').length === 2 && nested.length === objectCount + 2

    // 逐层解组
    await clearSelection()
    await rowClick(nested.find((row) => row.type === 'group').id)
    await key('u', { ctrlKey: true }); await sleep(440)
    const afterUngroup1 = await rows()
    const innerGroup = afterUngroup1.filter((row) => row.type === 'group')
    if (innerGroup.length) { await clearSelection(); await rowClick(innerGroup[0].id) }
    await key('u', { ctrlKey: true }); await sleep(440)
    const afterUngroup2 = await rows()
    results['59 CTRL+U 取消组合：逐层拆开并还原为顶层对象'] =
      afterUngroup1.filter((row) => row.type === 'group').length === 1 &&
      afterUngroup2.filter((row) => row.type === 'group').length === 0 &&
      afterUngroup2.length === objectCount

    // 60 位置锁定
    await selectOnly(textC)
    await key('l', { ctrlKey: true }); await sleep(380)
    const lockedOn = await lockedCount()
    const lockedBefore = await byId(textC)
    await dragObject(textC, 6, 0)
    const lockedAfterDrag = await byId(textC)
    await key('ArrowLeft'); await sleep(260)
    await key('ArrowUp', { shiftKey: true }); await sleep(280)
    const lockedAfterKeys = await byId(textC)
    await selectOnly(textC)
    await openMenu('排列(A)')
    await click(`[data-menu-item="对齐"]`); await sleep(200)
    await clickItem('标签左侧')
    const lockedAfterAlign = await byId(textC)
    results['60 位置锁定后鼠标拖动 / 方向键 / 对齐命令都无法移动（label_object_align_pos.html）'] =
      lockedOn === 1 &&
      lockedAfterDrag.x === lockedBefore.x && lockedAfterDrag.y === lockedBefore.y &&
      lockedAfterKeys.x === lockedBefore.x && lockedAfterKeys.y === lockedBefore.y &&
      lockedAfterAlign.x === lockedBefore.x && lockedAfterAlign.y === lockedBefore.y

    // 属性页位置选项被禁止
    await selectOnly(textC)
    await evaluate(`window.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',code:'Enter',altKey:true,bubbles:true,cancelable:true}))`)
    await waitFor('!!document.querySelector("[data-testid=object-props-dialog]")', 5000)
    const positionDisabled = await evaluate(`(() => {
      const x=document.querySelector('[data-testid=obj-x]'); const y=document.querySelector('[data-testid=obj-y]')
      const h=document.querySelector('[data-testid=obj-align-h]'); const v=document.querySelector('[data-testid=obj-align-v]')
      return { x: !!x && x.disabled, y: !!y && y.disabled, h: !!h && h.disabled, v: !!v && v.disabled } })()`)
    results['60 位置锁定时属性页 X/Y 与水平/垂直位置被禁止改数值（label_object_page_general.html）'] =
      positionDisabled.x && positionDisabled.y && positionDisabled.h && positionDisabled.v
    await evaluate(`document.querySelector('[data-testid=object-props-dialog] button[aria-label]')?.click()`)
    await waitFor('!document.querySelector("[data-testid=object-props-dialog]")', 3000)
    await sleep(280)

    // 解锁后恢复可拖动
    await selectOnly(textC)
    await key('l', { ctrlKey: true }); await sleep(360)
    const unlockedCount = await lockedCount()
    const beforeUnlockedDrag = await byId(textC)
    await dragObject(textC, 3, 0)
    const afterUnlockedDrag = await byId(textC)
    if (process.env.MAXLABEL_DEBUG_122) console.log('DBG 60 unlock', unlockedCount, JSON.stringify(beforeUnlockedDrag), JSON.stringify(afterUnlockedDrag), JSON.stringify(await selectedIds()))
    results['60 再次 Ctrl+L 解锁后对象恢复可拖动'] =
      unlockedCount === 0 && Math.abs((afterUnlockedDrag.x - beforeUnlockedDrag.x) - 3) < 0.5

    // 被组合的锁定对象失去位置锁定
    await selectOnly(textC)
    await key('l', { ctrlKey: true }); await sleep(340)
    const lockedBeforeGroup = await lockedCount()
    await clickObject(textD, MOD.ctrl)
    await key('g', { ctrlKey: true }); await sleep(460)
    results['60 锁定的对象被组合后失去位置锁定（label_object_page_general.html 明文）'] =
      lockedBeforeGroup === 1 && (await lockedCount()) === 0

    // ======================= 跨标签模板粘贴 =======================
    await newDocument()
    const freshRows = await rows()
    await key('v', { ctrlKey: true })
    await waitFor(`document.querySelectorAll('[data-testid=layer-object-row]').length===1`, 5000)
    const pastedRows = await rows()
    results['40 跨标签模板粘贴：新模板里 CTRL+V 得到剪贴板中的对象'] =
      freshRows.length === 0 && pastedRows.length === 1 && pastedRows[0].type === 'text'

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
