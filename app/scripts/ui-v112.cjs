/* A-138/A-151/A-155~A-159 的**可用性门槛**回归（多选阈值，帮助原文逐条）。
 *
 * 帮助出处：
 * - `label_object_align_align.html`：「多数对齐选项是用于排列两个或多个标签对象彼此之间的
 *   位置。因此，除非在标签中选择了两个或多个对象，否则这些选项多数是不可用的（灰色）」。
 *   → 左齐/顶齐/右齐/底齐/垂直中齐/水平中齐 需要选中 **≥2**。
 * - `label_object_align_size.html`：同一句话，作用于 水平同宽/垂直同宽/水平垂直相同 → **≥2**。
 * - `label_object_align_pos.html`：「这个命令与对齐命令不同，对齐命令需要选定两个或多个对象，
 *   而这个命令至少需要选定三个对象」 → 水平间距相同/垂直间距相同 需要 **≥3**。
 * - 旋转 / 顺序 / 居中 / 「相对于标签的位置」帮助未设多选门槛 → 一个对象即可。
 *
 * 三处入口（对齐栏按钮 / 排列(A) 菜单 / 画布右键菜单）必须取自同一套阈值，
 * 否则同一条命令会在一个入口可用、另一个入口灰色。
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

// 帮助 toolbar_align.html 的七组按钮，按「可用的最少选中数」分组。
const ALIGN_NEEDS_TWO = ['左齐', '顶齐', '右齐', '底齐', '垂直中齐', '水平中齐']
const SIZE_NEEDS_TWO = ['水平同宽', '垂直同宽', '水平垂直相同']
const DIST_NEEDS_THREE = ['水平间距相同', '垂直间距相同']
const ONE_IS_ENOUGH = ['左旋90度', '旋转180度', '右旋90度',
  '水平居中', '垂直居中',
  '移到最前', '前移', '后移', '移到最后',
  '标签顶部', '标签左侧', '标签右侧', '标签底部']

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
    const waitFor = async (expression, timeout = 2500) => {
      const started = Date.now()
      while (Date.now() - started < timeout) { if (await evaluate(expression)) return true; await sleep(80) }
      return false
    }
    const key = (name, options = {}) => evaluate(`(() => { const e=new KeyboardEvent('keydown',${JSON.stringify({ key: name, code: name, bubbles: true, cancelable: true, ...options })}); window.dispatchEvent(e); document.dispatchEvent(e); return e.defaultPrevented })()`)
    const dragCanvas = (x1, y1, x2, y2) => evaluate(`(() => { const c=document.querySelector('canvas.upper-canvas')||document.querySelector('canvas'); if(!c)return false; const b=c.getBoundingClientRect(); const p=(x,y,buttons=1)=>({bubbles:true,cancelable:true,view:window,clientX:b.left+x,clientY:b.top+y,button:0,buttons}); c.dispatchEvent(new MouseEvent('mousedown',p(${x1},${y1}))); c.dispatchEvent(new MouseEvent('mousemove',p(${x2},${y2}))); c.dispatchEvent(new MouseEvent('mouseup',{...p(${x2},${y2},0),buttons:0})); return true })()`)
    const selectAll = async () => { await key('a', { ctrlKey: true }); await sleep(200) }
    // 图层面板每行一个对象；Ctrl+A 之后「选中数 = 层行数」。
    const objectCount = () => evaluate(`document.querySelectorAll('[data-testid=layer-object-row]').length`)
    // 图层面板只把主对象标成 data-selected，故单选场景用它、多选场景用 objectCount()。
    const primaryRows = () => evaluate(`document.querySelectorAll('[data-testid=layer-object-row][data-selected=true]').length`)

    // 对齐栏上每个具名按钮的禁用态（按钮不存在时记 'missing'，便于区分「没渲染」与「灰色」）。
    const alignBarState = () => evaluate(`(() => {
      const bar=document.querySelector('[data-testid=align-bar]')
      if(!bar) return null
      const out={}
      for (const b of bar.querySelectorAll('button[title]')) out[b.title]= b.disabled ? 'disabled' : 'enabled'
      return out
    })()`)
    const groupState = (state, titles) => {
      if (!state) return 'no-bar'
      const values = titles.map((t) => state[t] ?? 'missing')
      if (values.every((v) => v === 'disabled')) return 'disabled'
      if (values.every((v) => v === 'enabled')) return 'enabled'
      return `mixed:${values.join(',')}`
    }

    // 菜单项禁用态：打开菜单 → 逐项读 data-menu-disabled。
    const openMenu = async (title) => { await evaluate(`document.querySelector('[data-menu-title=${JSON.stringify(title)}]')?.click()`); await sleep(180) }
    const openSub = async (label) => {
      await evaluate(`(() => { const e=[...document.querySelectorAll('[data-menu-item]')].find((c)=>c.offsetParent && c.getAttribute('data-menu-item')===${JSON.stringify(label)}); if(!e)return false; e.click(); return true })()`)
      await sleep(180)
    }
    const closeMenu = async () => { await evaluate(`document.querySelector('[data-menu-title="排列(A)"]')?.click()`); await sleep(120) }
    const menuState = () => evaluate(`(() => {
      const out={}
      for (const e of document.querySelectorAll('[data-menu-item]')) {
        if (!e.offsetParent) continue
        out[e.getAttribute('data-menu-item')] = e.getAttribute('data-menu-disabled')==='true' ? 'disabled' : 'enabled'
      }
      return out
    })()`)
    const menuGroup = (state, titles) => {
      if (!state) return 'no-menu'
      const values = titles.map((t) => state[t] ?? 'missing')
      if (values.every((v) => v === 'disabled')) return 'disabled'
      if (values.every((v) => v === 'enabled')) return 'enabled'
      return `mixed:${values.join(',')}`
    }
    const openCanvasContextMenu = async () => {
      await evaluate(`(() => {
        const c=document.querySelector('canvas.upper-canvas')||document.querySelector('canvas'); if(!c)return false
        const b=c.getBoundingClientRect()
        c.dispatchEvent(new MouseEvent('contextmenu',{bubbles:true,cancelable:true,view:window,clientX:b.left+b.width/2,clientY:b.top+b.height/2,button:2,buttons:2}))
        return true
      })()`)
      await sleep(200)
    }
    const ctxState = () => evaluate(`(() => {
      const out={}
      for (const e of document.querySelectorAll('[data-menu-item]')) {
        if (!e.offsetParent) continue
        out[e.getAttribute('data-menu-item')] = e.getAttribute('data-menu-disabled')==='true' ? 'disabled' : 'enabled'
      }
      return out
    })()`)
    const closeCtx = async () => { await key('Escape'); await sleep(140) }

    await sleep(1800)
    await evaluate('document.querySelector("button[aria-label=关闭]")?.click()'); await sleep(140)
    await key('n', { ctrlKey: true }); await sleep(320)
    if (await evaluate('!!document.querySelector("[data-testid=template-wizard]")')) { await click('[data-testid=wizard-next]'); await sleep(320) }
    await click('[data-testid="new-label-select"]')
    if (!await waitFor('!!document.querySelector("canvas.upper-canvas")')) throw new Error('editor did not open')

    // ---- 1) 空文档（0 个选中对象）：七组全部灰色 ----
    {
      const state = await alignBarState()
      const groups = [groupState(state, ALIGN_NEEDS_TWO), groupState(state, SIZE_NEEDS_TWO), groupState(state, DIST_NEEDS_THREE),
        groupState(state, ONE_IS_ENOUGH.slice(0, 3)), groupState(state, ONE_IS_ENOUGH.slice(3, 5)),
        groupState(state, ONE_IS_ENOUGH.slice(5, 9)), groupState(state, ONE_IS_ENOUGH.slice(9))]
      results['A-138 未选中对象时对齐栏七组按钮全部灰色'] =
        await primaryRows() === 0 && groups.every((value) => value === 'disabled')
    }

    // ---- 2) 选中 1 个对象：三组多选命令灰色；单对象命令（旋转/居中/顺序/位置）可用 ----
    await click('[data-tool="rect"]'); await dragCanvas(360, 110, 430, 160)
    await sleep(400)
    await selectAll()
    {
      const count = await objectCount()
      const state = await alignBarState()
      results['A-138/A-155 选中 1 个对象：对齐六项与尺寸三项灰色（帮助要求两个及以上）'] =
        count === 1 &&
        groupState(state, ALIGN_NEEDS_TWO) === 'disabled' &&
        groupState(state, SIZE_NEEDS_TWO) === 'disabled'
      results['A-158 选中 1 个对象：间距两项灰色（帮助 require 三个及以上）'] =
        groupState(state, DIST_NEEDS_THREE) === 'disabled'
      results['A-138 选中 1 个对象：旋转/居中/顺序/位置四组仍可用（帮助未设多选门槛）'] =
        groupState(state, ONE_IS_ENOUGH.slice(0, 3)) === 'enabled' &&
        groupState(state, ONE_IS_ENOUGH.slice(3, 5)) === 'enabled' &&
        groupState(state, ONE_IS_ENOUGH.slice(5, 9)) === 'enabled' &&
        groupState(state, ONE_IS_ENOUGH.slice(9)) === 'enabled'
    }
    // 排列(A) 菜单同一状态：对齐子菜单前六项灰色，尺寸子菜单三项灰色，间距子菜单两项灰色。
    {
      await openMenu('排列(A)')
      await openSub('对齐')
      const alignMenu = await menuState()
      await openSub('尺寸')
      const sizeMenu = await menuState()
      await openSub('间距')
      const distMenu = await menuState()
      await closeMenu()
      results['A-138 排列(A) 菜单与对齐栏同一阈值：1 个选中时对齐六项灰色、居中/贴边仍可用'] =
        menuGroup(alignMenu, ['左对齐', '右对齐', '顶对齐', '底对齐', '垂直中齐', '水平中齐']) === 'disabled' &&
        menuGroup(alignMenu, ['水平居中', '垂直居中', '标签顶部', '标签左侧', '标签右侧', '标签底部']) === 'enabled'
      results['A-155 排列(A)→尺寸 在 1 个选中时三项灰色（与对齐栏一致）'] =
        menuGroup(sizeMenu, ['水平同宽', '垂直同宽', '水平垂直相同']) === 'disabled'
      results['A-158 排列(A)→间距 在 1 个选中时两项灰色（与对齐栏一致）'] =
        menuGroup(distMenu, ['水平间距相同', '垂直间距相同']) === 'disabled'
    }
    // 画布右键菜单同一状态。
    {
      await openCanvasContextMenu()
      await openSub('对齐')
      const alignCtx = await ctxState()
      await closeCtx()
      await closeCtx()
      results['A-138 画布右键菜单与对齐栏同一阈值：1 个选中时对齐六项灰色、居中/贴边仍可用'] =
        menuGroup(alignCtx, ['左对齐', '右对齐', '顶对齐', '底对齐', '垂直中齐', '水平中齐']) === 'disabled' &&
        menuGroup(alignCtx, ['水平居中', '垂直居中', '标签顶部', '标签左侧', '标签右侧', '标签底部']) === 'enabled'
    }

    // ---- 3) 选中 2 个对象：对齐六项与尺寸三项转为可用；间距仍灰色 ----
    await click('[data-tool="rect"]'); await dragCanvas(120, 230, 210, 275)
    await sleep(400)
    await selectAll()
    {
      const count = await objectCount()
      const state = await alignBarState()
      results['A-138/A-155 选中 2 个对象：对齐六项与尺寸三项转为可用'] =
        count === 2 &&
        groupState(state, ALIGN_NEEDS_TWO) === 'enabled' &&
        groupState(state, SIZE_NEEDS_TWO) === 'enabled'
      results['A-158 选中 2 个对象：间距两项仍灰色（门槛是三个）'] =
        groupState(state, DIST_NEEDS_THREE) === 'disabled'
    }
    {
      await openMenu('排列(A)')
      await openSub('间距')
      const distMenu = await menuState()
      await closeMenu()
      results['A-158 排列(A)→间距 在 2 个选中时仍灰色（与对齐栏一致）'] =
        menuGroup(distMenu, ['水平间距相同', '垂直间距相同']) === 'disabled'
    }

    // ---- 4) 选中 3 个对象：间距两项转为可用 ----
    await click('[data-tool="rect"]'); await dragCanvas(600, 350, 710, 420)
    await sleep(400)
    await selectAll()
    {
      const count = await objectCount()
      const state = await alignBarState()
      results['A-158/A-159 选中 3 个对象：间距两项转为可用'] =
        count === 3 && groupState(state, DIST_NEEDS_THREE) === 'enabled'
      results['A-138 三组在 3 个选中时全部可用（阈值只收紧到各自门槛）'] =
        groupState(state, ALIGN_NEEDS_TWO) === 'enabled' &&
        groupState(state, SIZE_NEEDS_TWO) === 'enabled' &&
        groupState(state, DIST_NEEDS_THREE) === 'enabled'
    }
    {
      await openMenu('排列(A)')
      await openSub('间距')
      const distMenu = await menuState()
      await closeMenu()
      results['A-158 排列(A)→间距 在 3 个选中时可用（与对齐栏一致）'] =
        menuGroup(distMenu, ['水平间距相同', '垂直间距相同']) === 'enabled'
    }
    {
      await openCanvasContextMenu()
      await openSub('尺寸与间距')
      const ctx = await ctxState()
      await closeCtx()
      await closeCtx()
      results['A-158 画布右键菜单「尺寸与间距」在 3 个选中时间距可用（与对齐栏一致）'] =
        menuGroup(ctx, ['水平间距相同', '垂直间距相同']) === 'enabled'
    }

    // ---- 5) 回到 1 个选中：多选命令重新变灰（可用性随选区实时收敛） ----
    await evaluate(`(() => { const r=[...document.querySelectorAll('[data-testid=layer-object-row]')][0]; if(!r) return false; r.click(); return true })()`)
    await sleep(220)
    {
      const count = await primaryRows()
      const state = await alignBarState()
      results['A-138 选区回落到 1 个对象时多选命令重新变灰（可用性随选区实时收敛）'] =
        count === 1 &&
        groupState(state, ALIGN_NEEDS_TWO) === 'disabled' &&
        groupState(state, SIZE_NEEDS_TWO) === 'disabled' &&
        groupState(state, DIST_NEEDS_THREE) === 'disabled' &&
        groupState(state, ONE_IS_ENOUGH.slice(5, 9)) === 'enabled'
    }
  } catch (error) {
    results[`ERROR ${error && error.message}`] = false
  } finally {
    try { client?.ws?.close() } catch {}
  }
  let failed = 0
  for (const [name, ok] of Object.entries(results)) {
    if (!ok) failed += 1
    console.log(`${ok ? 'PASS' : 'FAIL'} ${name}`)
  }
  console.log(`\n${Object.keys(results).length - failed}/${Object.keys(results).length} PASS`)
  process.exit(failed ? 1 : 0)
})()
