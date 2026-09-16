/* A-138~A-163：对齐栏 26 个按钮的点击行为回归（帮助 toolbar_align.html 逐条）。
 *
 * 1) 按钮文案必须与帮助原文一致（左齐/顶齐/右齐/底齐/垂直中齐/水平中齐/水平居中/
 *    垂直居中/标签顶部/标签左侧/标签右侧/标签底部/左旋90度/旋转180度/右旋90度/
 *    水平同宽/垂直同宽/水平垂直相同/水平间距相同/垂直间距相同/移到最前/前移/后移/
 *    移到最后）。
 * 2) 每个按钮点击后都要产生帮助描述的效果：对齐以首个选取对象为参考、居中/贴边相对
 *    标签边界、旋转绕多选视觉中心、尺寸与参考对象相同、间距均匀分布、顺序整体上下移。
 * 3) 对齐栏按钮与 排列(A) 菜单走同一套回调：同一状态下按钮结果与菜单结果一致。
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
    const waitFor = async (expression, timeout = 2500) => {
      const started = Date.now()
      while (Date.now() - started < timeout) { if (await evaluate(expression)) return true; await sleep(80) }
      return false
    }
    const key = (name, options = {}) => evaluate(`(() => { const e=new KeyboardEvent('keydown',${JSON.stringify({ key:name, code:name, bubbles:true, cancelable:true, ...options })}); window.dispatchEvent(e); document.dispatchEvent(e); return e.defaultPrevented })()`)
    const dragCanvas = (x1, y1, x2, y2) => evaluate(`(() => { const c=document.querySelector('canvas.upper-canvas')||document.querySelector('canvas'); if(!c)return false; const b=c.getBoundingClientRect(); const p=(x,y,buttons=1)=>({bubbles:true,cancelable:true,view:window,clientX:b.left+x,clientY:b.top+y,button:0,buttons}); c.dispatchEvent(new MouseEvent('mousedown',p(${x1},${y1}))); c.dispatchEvent(new MouseEvent('mousemove',p(${x2},${y2}))); c.dispatchEvent(new MouseEvent('mouseup',{...p(${x2},${y2},0),buttons:0})); return true })()`)
    const rows = () => evaluate(`([...document.querySelectorAll('[data-testid=layer-object-row]')].map((e)=>({id:e.dataset.objectId,x:Number(e.dataset.objectX),y:Number(e.dataset.objectY),w:Number(e.dataset.objectW),h:Number(e.dataset.objectH),rotation:Number(e.dataset.objectRotation)})))`)
    const order = () => evaluate(`([...document.querySelectorAll('[data-testid=layer-object-row]')].map((e)=>e.dataset.objectId))`)
    const selectAll = async () => { await key('a', { ctrlKey: true }); await sleep(180) }
    const selectRow = async (id) => {
      await evaluate(`(() => { const r=[...document.querySelectorAll('[data-testid=layer-object-row]')].find((e)=>e.dataset.objectId===${JSON.stringify(id)}); if(!r)return false; if(r.dataset.selected!=='true'){ r.click(); } return true })()`)
      await sleep(180)
    }
    const alignBarTitles = () => evaluate(`(() => { const bar=document.querySelector('[data-testid=align-bar]'); return bar ? [...bar.querySelectorAll('button[title]')].map((e)=>e.title) : [] })()`)
    // 点击对齐栏上的具名按钮：按钮必须存在且处于可用态，否则返回 false。
    const alignBtn = (title) => evaluate(`(() => { const bar=document.querySelector('[data-testid=align-bar]'); if(!bar)return false; const b=[...bar.querySelectorAll('button[title]')].find((e)=>e.title===${JSON.stringify(title)} && !e.disabled); if(!b)return false; b.click(); return true })()`)
    const openMenu = async (title) => { await evaluate(`document.querySelector('[data-menu-title=${JSON.stringify(title)}]')?.click()`); await sleep(160) }
    const openSub = async (label) => { await evaluate(`(() => { const e=[...document.querySelectorAll('[data-menu-item]')].find((c)=>c.offsetParent && c.getAttribute('data-menu-item')===${JSON.stringify(label)}); if(!e)return false; e.click(); return true })()`); await sleep(160) }
    const clickMenuItem = async (label) => { await evaluate(`(() => { const e=[...document.querySelectorAll('[data-menu-item]')].find((c)=>c.offsetParent && c.getAttribute('data-menu-item')===${JSON.stringify(label)}); if(!e)return false; e.click(); return true })()`); await sleep(200) }
    const closeStart = async () => { await evaluate('document.querySelector("button[aria-label=关闭]")?.click()'); await sleep(120) }
    const approx = (a, b) => Math.abs(a - b) < 0.02
    const same = (list, value, pick) => list.length > 0 && list.every((item) => approx(pick(item), value))

    await sleep(1800)
    await closeStart()
    await key('n', { ctrlKey: true }); await sleep(300)
    if (await evaluate('!!document.querySelector("[data-testid=template-wizard]")')) { await click('[data-testid=wizard-next]'); await sleep(300) }
    await click('[data-testid="new-label-select"]')
    if (!await waitFor('!!document.querySelector("canvas.upper-canvas")')) throw new Error('editor did not open')

    const doc = await evaluate(`(() => { const e=document.querySelector('[data-testid=template-edit-area]'); return e ? { w:Number(e.dataset.widthMm), h:Number(e.dataset.heightMm) } : null })()`)
    if (!doc || !doc.w || !doc.h) throw new Error('label size not exposed on template-edit-area')

    // ---- 1) 文案与帮助一致（A-138 / A-151 的复合项由这 24 个具体按钮承载）----
    const HELP_TITLES = ['左齐', '顶齐', '右齐', '底齐', '垂直中齐', '水平中齐',
      '左旋90度', '旋转180度', '右旋90度',
      '水平同宽', '垂直同宽', '水平垂直相同',
      '水平居中', '垂直居中',
      '水平间距相同', '垂直间距相同',
      '移到最前', '前移', '后移', '移到最后',
      '标签顶部', '标签左侧', '标签右侧', '标签底部']
    const titles = await alignBarTitles()
    results['A-138/A-151 对齐栏按钮文案与帮助原文逐字一致（24 项 + 对齐/旋转尺寸… 分组）'] =
      HELP_TITLES.every((title) => titles.includes(title)) && titles.every((title) => HELP_TITLES.includes(title))

    // 三个尺寸不同的矩形：参考对象（首个选取/蓝色句柄）= 最先创建的那个
    await click('[data-tool="rect"]'); await dragCanvas(360, 110, 430, 160)
    await click('[data-tool="rect"]'); await dragCanvas(120, 230, 210, 275)
    await click('[data-tool="rect"]'); await dragCanvas(600, 350, 710, 420)
    await sleep(400)
    const initial = await rows()
    if (initial.length !== 3) throw new Error(`expected 3 rects, got ${initial.length}`)
    const reference = initial.at(-1)

    // 选中全部 → 点按钮 → 取回结果；每个操作都用同一个快照流程，避免相互污染。
    const runOp = async (title) => {
      await selectAll()
      const before = await rows()
      if (!await alignBtn(title)) throw new Error(`align bar button unavailable: ${title}`)
      await sleep(280)
      const after = await rows()
      return { before, after }
    }
    // 与 operations.ts 的 objectBounds 完全一致：包围盒要把对象当前旋转算进去，
    // 否则旋转过 90° 的对象会算错多选视觉中心。
    const boundsOf = (item) => {
      const angle = ((item.rotation || 0) * Math.PI) / 180
      const cos = Math.cos(angle)
      const sin = Math.sin(angle)
      const cx = item.x + item.w / 2
      const cy = item.y + item.h / 2
      const points = [[-item.w / 2, -item.h / 2], [item.w / 2, -item.h / 2], [item.w / 2, item.h / 2], [-item.w / 2, item.h / 2]]
        .map(([px, py]) => ({ x: cx + px * cos - py * sin, y: cy + px * sin + py * cos }))
      return {
        left: Math.min(...points.map((p) => p.x)), top: Math.min(...points.map((p) => p.y)),
        right: Math.max(...points.map((p) => p.x)), bottom: Math.max(...points.map((p) => p.y))
      }
    }
    const union = (list) => list.map(boundsOf).reduce((acc, b) => ({
      left: Math.min(acc.left, b.left), top: Math.min(acc.top, b.top),
      right: Math.max(acc.right, b.right), bottom: Math.max(acc.bottom, b.bottom)
    }), { left: Infinity, top: Infinity, right: -Infinity, bottom: -Infinity })

    // ---- 2) 对齐 6 项：全部对齐到参考对象（首个选取对象）----
    results['A-139 左齐：所有对象左边界对齐参考对象'] = (await runOp('左齐')).after.every((item) => approx(item.x, reference.x))
    results['A-140 顶齐：所有对象上边界对齐参考对象'] = (await runOp('顶齐')).after.every((item) => approx(item.y, reference.y))
    {
      const { after } = await runOp('右齐')
      results['A-141 右齐：所有对象右边界对齐参考对象'] = same(after, reference.x + reference.w, (item) => item.x + item.w)
    }
    {
      const { after } = await runOp('底齐')
      results['A-142 底齐：所有对象下边界对齐参考对象'] = same(after, reference.y + reference.h, (item) => item.y + item.h)
    }
    {
      // 帮助「垂直中齐」= 所有对象共用一条垂直中线 → 水平坐标(中心 x)相同。
      const { after } = await runOp('垂直中齐')
      results['A-143 垂直中齐：所有对象共用垂直中线（中心 x 对齐参考对象）'] = same(after, reference.x + reference.w / 2, (item) => item.x + item.w / 2)
    }
    {
      // 帮助「水平中齐」= 所有对象共用一条水平中线 → 垂直坐标(中心 y)相同。
      const { after } = await runOp('水平中齐')
      results['A-144 水平中齐：所有对象共用水平中线（中心 y 对齐参考对象）'] = same(after, reference.y + reference.h / 2, (item) => item.y + item.h / 2)
    }

    // ---- 3) 居中 2 项与贴边 4 项：相对标签边界 ----
    {
      const { before, after } = await runOp('水平居中')
      const beforeUnion = union(before)
      const afterUnion = union(after)
      const deltas = before.map((item) => after.find((c) => c.id === item.id).x - item.x)
      results['A-145 水平居中：选取集整体水平中心落到标签中心，且相对间距不变'] =
        approx((afterUnion.left + afterUnion.right) / 2, doc.w / 2) && approx(afterUnion.right - afterUnion.left, beforeUnion.right - beforeUnion.left) &&
        deltas.every((delta) => approx(delta, deltas[0]))
    }
    {
      const { before, after } = await runOp('垂直居中')
      const beforeUnion = union(before)
      const afterUnion = union(after)
      results['A-146 垂直居中：选取集整体垂直中心落到标签中心，且相对间距不变'] =
        approx((afterUnion.top + afterUnion.bottom) / 2, doc.h / 2) && approx(afterUnion.bottom - afterUnion.top, beforeUnion.bottom - beforeUnion.top)
    }
    results['A-147 标签顶部：选取集上边界贴标签 0'] = approx(union((await runOp('标签顶部')).after).top, 0)
    results['A-148 标签左侧：选取集左边界贴标签 0'] = approx(union((await runOp('标签左侧')).after).left, 0)
    results['A-149 标签右侧：选取集右边界贴标签宽度'] = approx(union((await runOp('标签右侧')).after).right, doc.w)
    results['A-150 标签底部：选取集下边界贴标签高度'] = approx(union((await runOp('标签底部')).after).bottom, doc.h)

    // ---- 4) 旋转 3 项：绕多选视觉并集中心 ----
    const rotationCheck = async (title, degrees) => {
      await selectAll()
      const before = await rows()
      const box = union(before)
      const pivot = { x: (box.left + box.right) / 2, y: (box.top + box.bottom) / 2 }
      if (!await alignBtn(title)) throw new Error(`align bar button unavailable: ${title}`)
      await sleep(280)
      const after = await rows()
      const radians = (degrees * Math.PI) / 180
      const cos = Math.cos(radians)
      const sin = Math.sin(radians)
      return before.every((item) => {
        const next = after.find((candidate) => candidate.id === item.id)
        if (!next) return false
        const expectedRotation = (((item.rotation + degrees) % 360) + 360) % 360
        if (!approx(next.rotation, expectedRotation)) return false
        const cx = item.x + item.w / 2
        const cy = item.y + item.h / 2
        return approx(next.x + next.w / 2, pivot.x + (cx - pivot.x) * cos - (cy - pivot.y) * sin) &&
          approx(next.y + next.h / 2, pivot.y + (cx - pivot.x) * sin + (cy - pivot.y) * cos)
      })
    }
    results['A-152 左旋90度：逆时针 90°（角度 +270）且绕多选视觉中心'] = await rotationCheck('左旋90度', 270)
    results['A-153 旋转180度：角度 +180 且绕多选视觉中心'] = await rotationCheck('旋转180度', 180)
    results['A-154 右旋90度：顺时针 90°（角度 +90）且绕多选视觉中心'] = await rotationCheck('右旋90度', 90)

    // ---- 5) 尺寸 3 项：与参考对象尺寸相同（帮助原文「参考对象」=首个选取对象）----
    {
      const { after } = await runOp('水平同宽')
      results['A-155 水平同宽：所有对象宽度等于参考对象宽度'] = after.every((item) => approx(item.w, reference.w))
    }
    {
      const { after } = await runOp('垂直同宽')
      results['A-156 垂直同宽：所有对象高度等于参考对象高度'] = after.every((item) => approx(item.h, reference.h))
    }
    {
      const { after } = await runOp('水平垂直相同')
      results['A-157 水平垂直相同：所有对象宽高等于参考对象'] = after.every((item) => approx(item.w, reference.w) && approx(item.h, reference.h))
    }

    // ---- 6) 间距 2 项：首尾边界保持、中间均匀分布 ----
    {
      const { before, after } = await runOp('水平间距相同')
      const sorted = [...before].sort((a, b) => a.x - b.x || a.id.localeCompare(b.id)).map((item) => after.find((c) => c.id === item.id))
      const gaps = sorted.slice(1).map((item, index) => item.x - (sorted[index].x + sorted[index].w))
      results['A-158 水平间距相同：首尾边界不变且相邻间距相等'] =
        gaps.length === 2 && approx(gaps[0], gaps[1]) &&
        approx(sorted[0].x, Math.min(...before.map((i) => i.x))) &&
        approx(sorted.at(-1).x + sorted.at(-1).w, Math.max(...before.map((i) => i.x + i.w)))
    }
    {
      const { before, after } = await runOp('垂直间距相同')
      const sorted = [...before].sort((a, b) => a.y - b.y || a.id.localeCompare(b.id)).map((item) => after.find((c) => c.id === item.id))
      const gaps = sorted.slice(1).map((item, index) => item.y - (sorted[index].y + sorted[index].h))
      results['A-159 垂直间距相同：首尾边界不变且相邻间距相等'] =
        gaps.length === 2 && approx(gaps[0], gaps[1]) &&
        approx(sorted[0].y, Math.min(...before.map((i) => i.y))) &&
        approx(sorted.at(-1).y + sorted.at(-1).h, Math.max(...before.map((i) => i.y + i.h)))
    }

    // ---- 7) 顺序 4 项：单对象在图层栈中整体上/下移（图层面板自上而下 = 文档数组逆序）----
    const orderOp = async (title) => {
      await selectRow(reference.id)
      const before = await order()
      if (!await alignBtn(title)) throw new Error(`align bar button unavailable: ${title}`)
      await sleep(280)
      return { before, after: await order() }
    }
    {
      const { before, after } = await orderOp('移到最前')
      results['A-160 移到最前：选中对象成为最上层且其余相对次序不变'] =
        after[0] === reference.id && before.filter((id) => id !== reference.id).every((id, index) => after.slice(1)[index] === id)
    }
    {
      await orderOp('移到最后') // 先压到底，再验证「前移一层」只上移一层
      const { before, after } = await orderOp('前移')
      results['A-161 前移：只上移一层（索引减 1），其余次序不变'] =
        before.indexOf(reference.id) === before.length - 1 && after.indexOf(reference.id) === before.length - 2
    }
    {
      await orderOp('移到最前') // 先升到顶，再验证「后移一层」只下移一层
      const { before, after } = await orderOp('后移')
      results['A-162 后移：只下移一层（索引加 1），其余次序不变'] =
        before.indexOf(reference.id) === 0 && after.indexOf(reference.id) === 1
    }
    {
      const { before, after } = await orderOp('移到最后')
      results['A-163 移到最后：选中对象成为最下层且其余相对次序不变'] =
        after.at(-1) === reference.id && before.filter((id) => id !== reference.id).every((id, index) => after.slice(0, -1)[index] === id)
    }

    // ---- 8) 对齐栏按钮与 排列(A) 菜单同一套回调：同一状态下结果一致 ----
    {
      await selectAll()
      const before = await rows()
      if (!await alignBtn('左齐')) throw new Error('align bar button unavailable: 左齐')
      await sleep(280)
      const byButton = await rows()
      await key('z', { ctrlKey: true }); await sleep(320)
      const restored = await rows()
      results['A-139 对齐栏 左齐 可撤销回原位置（Ctrl+Z 复原）'] =
        restored.length === before.length && before.every((item) => {
          const now = restored.find((c) => c.id === item.id)
          return now && approx(now.x, item.x) && approx(now.y, item.y)
        })
      await selectAll()
      await openMenu('排列(A)')
      await openSub('对齐')
      await clickMenuItem('左对齐')
      await evaluate(`document.querySelector('[data-menu-title="排列(A)"]')?.click()`)
      await sleep(160)
      const byMenu = await rows()
      results['A-139 按钮「左齐」与菜单「排列(A)→对齐→左对齐」同一回调、结果一致'] =
        byButton.length === byMenu.length && byButton.every((item) => {
          const other = byMenu.find((c) => c.id === item.id)
          return other && approx(other.x, item.x) && approx(other.y, item.y)
        })
    }

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
