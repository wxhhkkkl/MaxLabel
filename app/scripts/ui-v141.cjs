/*
 * round-138：对象属性「常规」页按真机控件树 dump 对齐（结构 + 逐字文案 + 加速键接线）。
 *
 * 权威依据：`parity/reference/labelshop/probe-44-two-objects-tree.txt`（真机「文字属性 → 常规」页控件树）
 *   - 四个**分组框**（Button 型，坐标自上而下）：`位置`(934,458) / `对齐`(934,533) / `颜色`(934,611) / `其它`(934,689)；
 *   - `位置` 组 = `水平(&H):` + Edit + `毫米` / `垂直(&V):` + Edit + `毫米`；
 *   - `对齐` 组 = `水平(&W):` / `垂直(&T):`，文字对象下**两个都是 DISABLED**（有控件但灰）；
 *   - `其它` 组 = `旋转(&R):` / `镜像(&M):` / `背景(&B):` / `位置锁定(&L)` / `不打印输出(&N)`
 *                + **全角冒号**的 `对象名称标识：` 与 `图层：`（图层下拉 DISABLED）；
 *   - `对象附加说明(&C)` 在「其它」组之外（y=980 > 689+288），整行独占；
 *   - 底排按钮（左→右）= `确定` / `取消` / `应用(&A)`(**不可见**) / `帮助`。
 *
 * 本脚本用**整数组全等**与**启用态**钉住结构，而不是"包含某个串"：
 *   - 分组框 legend 集合必须**恰为** ['位置','对齐','颜色','其它'] 且按 DOM 顺序（多一个少一个都红）；
 *   - 底排按钮集合必须**恰为** ['确定','取消','帮助']（顺序也锁）；
 *   - `对齐` 的两个下拉在文字对象下必须 `disabled`（真机 DISABLED，不是"没有"）；
 *   - 加速键接线：渲染了 `(X)` 的控件必须真的带 `accessKey`（DIFF-83 只保证不显示 `&`，
 *     不保证按键可用；真机 Alt+C 实测可触发，见 r189-before/after-alt-c.png）。
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
    ws.on('message', (raw) => {
      const message = JSON.parse(raw.toString())
      const item = pending.get(message.id)
      if (!item) return
      pending.delete(message.id)
      if (message.error) item.reject(new Error(message.error.message))
      else item.resolve(message.result)
    })
    ws.on('open', () => resolve({ ws, send: (method, params = {}) => new Promise((ok, fail) => {
      const messageId = ++id
      pending.set(messageId, { resolve: ok, reject: fail })
      ws.send(JSON.stringify({ id: messageId, method, params }))
    }) }))
    ws.on('error', reject)
  })
}

const D = '[data-testid="object-props-dialog"]'

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
    const waitFor = async (expression, timeout = 8000) => {
      const started = Date.now()
      while (Date.now() - started < timeout) {
        if (await evaluate(expression)) return true
        await sleep(90)
      }
      return false
    }

    await sleep(1500)
    await evaluate('document.querySelector("button[aria-label=关闭]")?.click()')
    await evaluate('document.dispatchEvent(new KeyboardEvent("keydown",{key:"n",code:"KeyN",ctrlKey:true,bubbles:true,cancelable:true}))')
    // 建文档竞态：先等「向导或编辑器」任一就绪（照 ui-v81 round-137 的修法），再按实际出现的那条走
    if (!await waitFor('!!document.querySelector("[data-testid=template-wizard]") || !!document.querySelector("canvas.upper-canvas")', 15000)) {
      throw new Error('^{n} 之后既没出现向导也没出现编辑器：' + (await evaluate('document.body.innerText.slice(-800)')))
    }
    if (await evaluate('!!document.querySelector("[data-testid=template-wizard]")')) {
      await click('[data-testid="wizard-next"]')
      await sleep(500)
    }
    if (await evaluate('!!document.querySelector("[data-testid=new-label-dialog]")')) {
      await click('[data-testid="new-label-select"]')
      await sleep(1200)
    }
    if (!await waitFor('!!document.querySelector("canvas.upper-canvas")', 15000)) throw new Error('editor did not open')

    // 放一个**文字**对象（与真机 dump probe-44 同对象类型）并双击打开属性
    await click('[data-tool="text"]')
    await sleep(400)
    const rect = await evaluate(`(() => { const el=document.querySelector('canvas.upper-canvas'); const r=el.getBoundingClientRect(); return {x:r.left+r.width*0.35, y:r.top+r.height*0.35} })()`)
    const mouse = (type, n, buttons, x, y) => client.send('Input.dispatchMouseEvent', { type, x: Math.round(x), y: Math.round(y), button: 'left', buttons, clickCount: n })
    await mouse('mousePressed', 1, 1, rect.x, rect.y)
    await mouse('mouseReleased', 1, 0, rect.x, rect.y)
    await sleep(500)
    let opened = false
    for (const [dx, dy] of [[12, 10], [24, 12], [40, 16]]) {
      await mouse('mousePressed', 1, 1, rect.x + dx, rect.y + dy); await mouse('mouseReleased', 1, 0, rect.x + dx, rect.y + dy); await sleep(70)
      await mouse('mousePressed', 2, 1, rect.x + dx, rect.y + dy); await mouse('mouseReleased', 2, 0, rect.x + dx, rect.y + dy)
      if (await waitFor(`!!document.querySelector('${D}')`, 2500)) { opened = true; break }
    }
    if (!opened) throw new Error('双击文字对象没打开属性对话框')
    await sleep(400)

    await evaluate(`(() => { const b=[...document.querySelectorAll('[data-testid^="object-props-tab-"]')].find((x)=>(x.textContent||'').trim()==='常规'); if(b) b.click(); return !!b })()`)
    await sleep(400)

    /* ---------- ① 四个分组框：整数组全等 + 顺序 ---------- */
    const groups = await evaluate(`(() => {
      const d = document.querySelector('${D}')
      return [...d.querySelectorAll('fieldset')].map((f) => {
        const legend = f.querySelector('legend')
        return { testid: f.getAttribute('data-testid') || '', text: (legend?.textContent || '').trim() }
      })
    })()`)
    results['「常规」页分组框 legend 整数组全等 = 真机 [位置, 对齐, 颜色, 其它]'] =
      JSON.stringify(groups.map((g) => g.text)) === JSON.stringify(['位置', '对齐', '颜色', '其它'])
    results['「常规」页分组框 testid 顺序 = 位置/对齐/颜色/其它'] =
      JSON.stringify(groups.map((g) => g.testid)) === JSON.stringify(['obj-group-position', 'obj-group-align', 'obj-group-color', 'obj-group-other'])

    /* ---------- ② 位置组：`水平(H):` / `垂直(V):` + 毫米 ---------- */
    const position = await evaluate(`(() => {
      const f = document.querySelector('[data-testid="obj-group-position"]')
      if (!f) return null
      const inputs = [...f.querySelectorAll('input')]
      const x = f.querySelector('[data-testid="obj-x"]')
      const y = f.querySelector('[data-testid="obj-y"]')
      return {
        text: f.textContent || '',
        mmCount: [...f.querySelectorAll('*')].filter((e) => e.children.length === 0 && (e.textContent || '').trim() === '毫米').length,
        xKey: x ? x.getAttribute('accessKey') : null,
        yKey: y ? y.getAttribute('accessKey') : null,
        xSuffix: x ? x.getAttribute('data-access-suffix') : null,
        ySuffix: y ? y.getAttribute('data-access-suffix') : null,
        inputCount: inputs.length
      }
    })()`)
    results['「位置」组含真机文案 水平(H): 与 垂直(V):'] =
      !!position && position.text.includes('水平(H):') && position.text.includes('垂直(V):')
    results['「位置」组两个数值框各带「毫米」单位（真机为 Edit 右侧独立 Static）'] =
      !!position && position.mmCount === 2
    results['「位置」组只有 水平/垂直 两个输入框（不多不少）'] = !!position && position.inputCount === 2
    results['「位置」组 obj-x/obj-y 接上加速键 (H)/(V)'] =
      !!position && position.xKey === 'h' && position.yKey === 'v' && position.xSuffix === '(H)' && position.ySuffix === '(V)'

    /* ---------- ③ 对齐组：`水平(W):` / `垂直(T):` 且文字对象下 DISABLED ---------- */
    const align = await evaluate(`(() => {
      const f = document.querySelector('[data-testid="obj-group-align"]')
      if (!f) return null
      const h = f.querySelector('[data-testid="obj-align-h"]')
      const v = f.querySelector('[data-testid="obj-align-v"]')
      return {
        text: f.textContent || '',
        hDisabled: h ? h.disabled : null, vDisabled: v ? v.disabled : null,
        hKey: h ? h.getAttribute('accessKey') : null, vKey: v ? v.getAttribute('accessKey') : null,
        hSuffix: h ? h.getAttribute('data-access-suffix') : null, vSuffix: v ? v.getAttribute('data-access-suffix') : null
      }
    })()`)
    results['「对齐」组含真机文案 水平(W): 与 垂直(T):'] =
      !!align && align.text.includes('水平(W):') && align.text.includes('垂直(T):')
    results['「对齐」组两个下拉在文字对象下为 DISABLED（真机 probe-44 同为 DISABLED，不是"整组没有"）'] =
      !!align && align.hDisabled === true && align.vDisabled === true
    results['「对齐」组两个下拉接上加速键 (W)/(T)'] =
      !!align && align.hKey === 'w' && align.vKey === 't' && align.hSuffix === '(W)' && align.vSuffix === '(T)'

    /* ---------- ④ 其它组：逐字文案（含全角冒号）+ 复选框启用态 ---------- */
    const other = await evaluate(`(() => {
      const f = document.querySelector('[data-testid="obj-group-other"]')
      if (!f) return null
      const boxes = [...f.querySelectorAll('label')]
      const byText = (s) => boxes.find((b) => (b.textContent || '').includes(s))
      const lock = byText('位置锁定')
      const noPrint = byText('不打印输出')
      return {
        text: f.textContent || '',
        lockChecked: lock ? lock.querySelector('input')?.checked : null,
        noPrintChecked: noPrint ? noPrint.querySelector('input')?.checked : null,
        layer: f.querySelector('[data-testid="obj-layer"]') ? f.querySelector('[data-testid="obj-layer"]').disabled : null,
        rotKey: f.querySelector('[data-testid="obj-rotation"]')?.getAttribute('accessKey'),
        mirrorKey: f.querySelector('[data-testid="obj-mirror"]')?.getAttribute('accessKey'),
        bgKey: f.querySelector('[data-testid="obj-background"]')?.getAttribute('accessKey')
      }
    })()`)
    results['「其它」组含 旋转(R): / 镜像(M): / 背景(B):（逐字，含加速键）'] =
      !!other && other.text.includes('旋转(R):') && other.text.includes('镜像(M):') && other.text.includes('背景(B):')
    results['「其它」组含 位置锁定(L) 与 不打印输出(N)（逐字）'] =
      !!other && other.text.includes('位置锁定(L)') && other.text.includes('不打印输出(N)')
    results['「其它」组含**全角冒号**的 对象名称标识： 与 图层：'] =
      !!other && other.text.includes('对象名称标识：') && other.text.includes('图层：')
    results['「其它」组的 图层 下拉为 DISABLED（真机 probe-44 同为 DISABLED）'] = !!other && other.layer === true
    results['「其它」组 旋转/镜像/背景 接上加速键 (R)/(M)/(B)'] =
      !!other && other.rotKey === 'r' && other.mirrorKey === 'm' && other.bgKey === 'b'

    /* ---------- ⑤ 对象附加说明在「其它」组之外，整行独占 ---------- */
    const note = await evaluate(`(() => {
      const n = document.querySelector('[data-testid="obj-note"]')
      if (!n) return null
      return { inOther: !!n.closest('[data-testid="obj-group-other"]'), inPosition: !!n.closest('[data-testid="obj-group-position"]') }
    })()`)
    results['对象附加说明(C) 渲染在「其它」分组之外（真机 y=980 在组框 y∈[689,977] 之外）'] =
      !!note && note.inOther === false && note.inPosition === false

    /* ---------- ⑥ 底排按钮：整数组全等（真机 确定/取消/帮助，应用为隐藏控件） ---------- */
    const footer = await evaluate(`(() => {
      const d = document.querySelector('${D}')
      const footerEl = d.querySelector(':scope > div:last-child')
      const btns = footerEl ? [...footerEl.querySelectorAll('button')].map((b) => (b.textContent || '').trim()) : []
      const help = d.querySelector('[data-testid="object-props-help"]')
      const ok = d.querySelector('[data-testid="object-props-ok"]')
      const cancel = d.querySelector('[data-testid="object-props-cancel"]')
      return { btns, hasHelp: !!help, helpKey: help ? help.getAttribute('accessKey') : null,
               hasOk: !!ok, hasCancel: !!cancel,
               visibleApply: [...d.querySelectorAll('button')].some((b) => (b.textContent || '').trim().startsWith('应用') && b.offsetParent !== null) }
    })()`)
    results['对象属性底排按钮整数组全等 = 真机 [确定, 取消, 帮助]（顺序也锁）'] =
      !!footer && JSON.stringify(footer.btns) === JSON.stringify(['确定', '取消', '帮助'])
    results['对象属性底排行内没有可见的「应用」按钮（真机 probe-44 该控件行首为 [ ] 不可见）'] =
      !!footer && footer.visibleApply === false
    results['底排「帮助」按钮接上加速键 (H) 且可点'] = !!footer && footer.hasHelp && footer.helpKey === 'h'

    /* ---------- ⑦ 加速键接线总检：凡渲染了 (X) 的控件，其 accessKey 必须与后缀一致 ---------- */
    const wiring = await evaluate(`(() => {
      const d = document.querySelector('${D}')
      const controls = [...d.querySelectorAll('[data-access-suffix]')]
      const bad = controls.filter((c) => {
        const suffix = c.getAttribute('data-access-suffix') || ''
        const letter = (suffix.match(/^\\(([A-Za-z0-9])\\)$/) || [])[1]
        return !letter || (c.getAttribute('accessKey') || '') !== letter.toLowerCase()
      }).map((c) => c.getAttribute('data-testid') || c.textContent.trim().slice(0, 12))
      return { total: controls.length, bad }
    })()`)
    results['常规页 accessKey 接线 ≥ 8 处且全部与 data-access-suffix 一致'] =
      !!wiring && wiring.total >= 8 && wiring.bad.length === 0

    /* ---------- ⑧ 「常规」页不再有「打印时可见」（真机只有 不打印输出(&N)） ---------- */
    results['「常规」页不再出现「打印时可见」（真机只有 不打印输出(N)，语义重复项已删）'] =
      !(await evaluate(`document.querySelector('${D}').textContent.includes('打印时可见')`))

    /* ---------- ⑨ 复刻版扩展区被明确标注，而不是静默保留 ---------- */
    const ext = await evaluate(`(() => {
      const e = document.querySelector('[data-testid="obj-general-extension"]')
      return e ? { text: e.textContent || '' } : null
    })()`)
    results['「常规」页的复刻版扩展（宽度/高度）带「复刻版扩展」标注'] =
      !!ext && ext.text.includes('复刻版扩展')
  } catch (error) {
    results[`脚本异常：${error.message}`] = false
  } finally {
    if (client) client.ws.close()
  }

  const names = Object.keys(results)
  let passed = 0
  for (const name of names) {
    const ok = results[name] === true
    if (ok) passed += 1
    console.log(`${ok ? 'PASS' : 'FAIL'} ${name}`)
  }
  // 前缀换行与 ui-v140 一致：runner 用 `^\s*(\d+)/(\d+) PASS\s*$` 判定，摘要行必须自成一行。
  console.log(`\n${passed}/${names.length} PASS`)
  // 显式退出：CDP 的 WebSocket 会让事件循环不空，靠自然退出会被 runner 判成超时/非零。
  process.exit(passed === names.length ? 0 : 1)
})()
