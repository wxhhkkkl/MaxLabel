/*
 * 图层窗体的选中集必须与画布选中集一致（真机无此分层）。
 *
 * 出处：帮助 `label_edit_layer.html`（图层窗体列出标签上的每个对象，点谁就是选中谁）、
 *       `label_object_edit.html`（选取对象后即可对其执行排列/对齐/删除等命令）。
 *
 * 修复前实测：画布 Ctrl+A 多选后再点图层窗体的某一行，模型 selectedId 换成了该对象，
 * 但 Fabric 的活动对象仍是旧的 ActiveSelection —— 排列/对齐/删除读的是
 * `useEditorTransformCommands.selectedIds()`（优先 `fc.getActiveObjects()`），
 * 于是命令作用在画布上残留的旧选中集。`app/src/renderer/src/editor/LabelEditor.tsx`
 * 新增「模型选中集 → Fabric 活动对象」同步 effect 后本条转绿。
 *
 * 断言：
 *   1) Ctrl+A 多选不被同步 effect 压成单选（回归保护）；
 *   2) 点图层行后画布活动对象就是该行对象（`data-active-fabric-selection`）；
 *   3) 随后按 Delete 只删掉该对象（证明命令作用域跟随图层选中）；
 *   4) 再点已被选中的图层行（取消选中）后画布选中集清空。
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
    const pressKey = (k, o = {}) => evaluate(`(() => { const e=new KeyboardEvent('keydown',${JSON.stringify({ key: k, code: k, bubbles: true, cancelable: true, ...o })}); window.dispatchEvent(e); return true })()`)
    const waitFor = async (expression, timeout = 5000) => {
      const started = Date.now()
      while (Date.now() - started < timeout) {
        if (await evaluate(expression)) return true
        await sleep(80)
      }
      return false
    }
    const rows = () => evaluate(`[...document.querySelectorAll('[data-testid=layer-object-row]')].map((e)=>({ id:e.getAttribute('data-object-id'), type:e.getAttribute('data-object-type'), sel:e.getAttribute('data-selected')==='true', text:e.textContent }))`)
    const fabricSelection = () => evaluate(`(() => { const el=document.querySelector('[data-active-fabric-selection]'); if(!el) return null; try { return JSON.parse(el.getAttribute('data-active-fabric-selection')) } catch { return null } })()`)
    const clickRow = async (id) => {
      const ok = await evaluate(`(() => { const r=[...document.querySelectorAll('[data-testid=layer-object-row]')].find((e)=>e.getAttribute('data-object-id')===${JSON.stringify(id)}); if(!r) return false; r.click(); return true })()`)
      await sleep(220)
      return ok
    }
    const drag = (x1, y1, x2, y2) => evaluate(`(() => {
      const c=document.querySelector('canvas.upper-canvas')||document.querySelector('canvas'); if(!c)return false
      const b=c.getBoundingClientRect()
      const p=(x,y,buttons=1)=>({bubbles:true,cancelable:true,view:window,clientX:b.left+x,clientY:b.top+y,button:0,buttons})
      c.dispatchEvent(new MouseEvent('mousedown',p(${x1},${y1})))
      c.dispatchEvent(new MouseEvent('mousemove',p(${x2},${y2})))
      c.dispatchEvent(new MouseEvent('mouseup',{...p(${x2},${y2},0),buttons:0})); return true
    })()`)

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
    // 图层窗体默认可能是关闭的（查看菜单可切换）
    if (!(await evaluate('!!document.querySelector("[data-testid=layer-object-row]")'))) {
      await evaluate(`(() => { const b=document.querySelector('[data-menu-title="查看(V)"]'); if(b) b.click(); return true })()`)
      await sleep(200)
      await click('[data-menu-item="图层窗体"]'); await sleep(300)
    }

    const size = await evaluate(`(() => { const c=document.querySelector('canvas.upper-canvas'); const b=c.getBoundingClientRect(); return { w:Math.round(b.width), h:Math.round(b.height) } })()`)
    if (!size || size.w < 300 || size.h < 240) throw new Error('canvas too small: ' + JSON.stringify(size))
    const px = (fx, fy) => [Math.round(size.w * fx), Math.round(size.h * fy)]

    // ---------- 排入 3 个互不重叠的矩形 ----------
    const boxes = [[0.05, 0.08, 0.22, 0.28], [0.30, 0.08, 0.47, 0.28], [0.55, 0.08, 0.72, 0.28]]
    for (const box of boxes) {
      const ok = await click('[data-tool="rect"]')
      if (!ok) throw new Error('rect tool button missing')
      await sleep(120)
      const [x1, y1] = px(box[0], box[1])
      const [x2, y2] = px(box[2], box[3])
      await drag(x1, y1, x2, y2)
      await sleep(280)
    }
    await click('[data-tool="select"]'); await sleep(180)
    const initial = await rows()
    results['前置：图层窗体列出 3 个矩形对象'] = initial.length === 3 && initial.every((r) => r.type === 'rect')

    // ---------- 1) Ctrl+A 多选不被同步 effect 压成单选 ----------
    await pressKey('a', { ctrlKey: true }); await sleep(320)
    const multi = await fabricSelection()
    results['Ctrl+A 全选后画布活动对象仍是 3 个（同步 effect 未破坏 Shift/全选多选）'] =
      !!multi && Array.isArray(multi.ids) && multi.ids.length === 3

    const primaryId = multi?.primaryId
    const otherId = initial.map((r) => r.id).find((id) => id !== primaryId)
    results['前置：能取到一个非主对象用于图层点击'] = Boolean(primaryId && otherId)

    // ---------- 2) 点图层行 → 画布活动对象跟随 ----------
    await clickRow(otherId)
    const afterRowClick = await fabricSelection()
    results['点图层行后画布活动对象即为该行对象（不再是残留的旧多选集）'] =
      !!afterRowClick && afterRowClick.ids.length === 1 && afterRowClick.ids[0] === otherId
    const rowSel = (await rows()).find((r) => r.id === otherId)?.sel
    results['点图层行后该行标记为已选中（模型选中集一致）'] = rowSel === true

    // ---------- 3) 命令作用域跟随：Delete 只删该对象 ----------
    await pressKey('Delete'); await sleep(360)
    const remaining = await rows()
    results['随后按 Delete 只删除图层选中的那个对象（排列/编辑命令作用域跟随图层选中）'] =
      remaining.length === 2 && !remaining.some((r) => r.id === otherId)

    // ---------- 4) 再点已选中行（取消选中）→ 画布选中集清空 ----------
    await pressKey('a', { ctrlKey: true }); await sleep(300)
    const rowsNow = await rows()
    const primaryRowId = (await fabricSelection())?.primaryId
    const target = rowsNow.find((r) => r.id === primaryRowId) ? primaryRowId : rowsNow[0]?.id
    await clickRow(target)
    const cleared = await fabricSelection()
    results['点击已选中的图层行（切换为取消选中）后画布选中集同步清空'] = cleared === null

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
