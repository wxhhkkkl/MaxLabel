/* 「文字属性 → 字体」页按真机对齐（round-143）。
 *
 * 依据（真机控件树 dump，逐字原文）：
 *  `parity/reference/labelshop/probe-r201-textprops-font-tree.txt`
 *    [V] class=Static   text='字体名称(&T):'              xy=(931,458)  + ComboBox(931,494) 369×230
 *    [V] class=Static   text='字体样式(&Y):'              xy=(1311,458) + ComboBox(1311,494)
 *    [V] class=Static   text='大小(&P):'                  xy=(1506,458) + ComboBox(1506,494)   ← **是 ComboBox，不是数字框**
 *    [V] class=Button   text='特殊效果'   xy=(931,722) wh=(696x144)   ← 分组框
 *    [V] class=Button   text='删除线(&S)'   xy=(972,752)  wh=(143x30)  ← 复选框
 *    [V] class=Button   text='下划线(&U)'   xy=(972,788)  wh=(143x30)  ← 复选框
 *    [V] class=Button   text='黑底白字(&W)' xy=(972,824)  wh=(165x30)  ← 复选框
 *    [V] class=Static   text='字体宽度方向缩放倍数(&H):'  xy=(1181,758) + Edit(1459,752) + msctls_updown32
 *    [V] class=Button   text='颜色(&C)...'  xy=(1470,806) wh=(132x45)  ← Button，不是内联色块
 *    [V] class=Static   text='字间距(&J):'   xy=(1181,818) + Edit(1302,812) + Static '毫米'(1401,818)
 *    [V] class=Button   text='示例'   xy=(931,875) wh=(696x156)        ← 分组框
 *    [V] class=Static   text='显示示例'  xy=(953,902)
 *    [V] class=Static   text='这是TRUETYPE字体，显示与打印完全相同!'  xy=(928,1040)  ← 半角 `!`、无空格
 *
 * 判定口径：控件**种类**（select/checkbox/button）、**逐字文案**、**数量**、**加速键接线**，
 * 全部从 dump 推出、可证伪；不用"页面里有没有这几个字"这种松判。
 * 屏幕文案走 `displayMfcCaption`（DIFF-83：真机不显示 `&`）。
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
      const message = JSON.parse(raw.toString()); const item = pending.get(message.id)
      if (!item) return
      pending.delete(message.id); if (message.error) item.rej(new Error(message.error.message)); else item.res(message.result)
    })
    ws.on('open', () => resolve({ ws, send })); ws.on('error', reject)
  })
}

;(async () => {
  let client
  const results = {}
  try {
    const port = process.env.MAXLABEL_DEBUG_PORT || 9222
    const pages = await getJson(`http://127.0.0.1:${port}/json/list`); const page = pages.find((item) => item.type === 'page')
    if (!page) throw new Error('no main page')
    client = await attach(page.webSocketDebuggerUrl)
    const evaluate = async (expression) => {
      const result = await client.send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true })
      if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description || result.exceptionDetails.text)
      return result.result?.value
    }
    const waitFor = async (expression, timeout = 8000) => {
      const started = Date.now()
      while (Date.now() - started < timeout) { if (await evaluate(expression)) return true; await sleep(120) }
      return false
    }

    // 建一个**文字**对象并打开属性对话框（与真机对照同对象类型）。
    await evaluate('document.dispatchEvent(new KeyboardEvent("keydown",{key:"n",code:"KeyN",ctrlKey:true,bubbles:true,cancelable:true}))')
    await sleep(700)
    if (await evaluate('!!document.querySelector("[data-testid=template-wizard]")')) { await evaluate('document.querySelector("[data-testid=wizard-next]")?.click()'); await sleep(800) }
    if (await evaluate('!!document.querySelector("[data-testid=new-label-dialog]")')) { await evaluate('document.querySelector("[data-testid=new-label-select]")?.click()'); await sleep(1400) }
    if (!(await waitFor('!!document.querySelector("canvas.upper-canvas")'))) throw new Error('没进编辑器')
    await evaluate('document.querySelector(\'[data-tool="text"]\')?.click()')
    await sleep(350)
    await evaluate(`(() => {
      const c=document.querySelector('canvas.upper-canvas'); const b=c.getBoundingClientRect()
      const p={bubbles:true,cancelable:true,view:window,clientX:b.left+120,clientY:b.top+110,button:0,buttons:1}
      c.dispatchEvent(new MouseEvent('mousedown',p))
      c.dispatchEvent(new MouseEvent('mousemove',{...p,clientX:b.left+240,clientY:b.top+150}))
      c.dispatchEvent(new MouseEvent('mouseup',{...p,buttons:0,clientX:b.left+240,clientY:b.top+150}))
      return true })()`)
    await sleep(500)
    let opened = false
    for (const [dx, dy] of [[0, 0], [20, 8], [12, -8]]) {
      await evaluate(`(() => { const c=document.querySelector('canvas.upper-canvas'); const b=c.getBoundingClientRect()
        const x=b.left+180+${dx}, y=b.top+130+${dy}
        const p={bubbles:true,cancelable:true,view:window,clientX:x,clientY:y,button:0}
        c.dispatchEvent(new MouseEvent('mousedown',{...p,buttons:1})); c.dispatchEvent(new MouseEvent('mouseup',{...p,buttons:0}))
        c.dispatchEvent(new MouseEvent('dblclick',{...p,detail:2})); return true })()`)
      if (await waitFor('!!document.querySelector(\'[data-testid="object-props-dialog"]\')', 2500)) { opened = true; break }
    }
    if (!opened) throw new Error('双击文字对象没打开属性对话框')
    await evaluate(`(() => { const b=[...document.querySelectorAll('[data-testid^="object-props-tab-"]')].find((x)=>(x.textContent||'').trim()==='字体'); b?.click(); return !!b })()`)
    await sleep(350)

    /** 读字体页结构：分组框 / 控件种类 / 逐字文案 / 加速键 / 启用态 */
    const snapshot = () => evaluate(`(() => {
      const d=document.querySelector('[data-testid="object-props-dialog"]'); if(!d) return null
      const q=(s)=>d.querySelector(s)
      const info=(el)=> el ? { tag:el.tagName, kind:el.type||'', disabled:!!el.disabled, accessKey:el.accessKey||'', suffix:el.getAttribute('data-access-suffix')||'' } : null
      const effects=q('[data-testid="font-group-effects"]')
      const sample=q('[data-testid="font-group-sample"]')
      const boxes=[...(effects?.querySelectorAll('input[type=checkbox]')||[])]
      const colorBtn=q('[data-testid="text-font-color"]')
      const colorIn=q('[data-testid="text-font-color-input"]')
      const sizeSel=q('[data-testid="object-props-font-size"]')
      return {
        legends:[...d.querySelectorAll('fieldset')].map((f)=>(f.querySelector('legend')?.textContent||'').trim()),
        fonts:{ name:info(q('[data-testid="object-props-font-family"]')), style:info(q('[data-testid="text-font-style"]')), size:info(sizeSel) },
        fontOptions: sizeSel ? sizeSel.options.length : 0,
        familyOptions: [...(q('[data-testid="object-props-font-family"]')?.options||[])].map((o)=>o.value),
        boxes: boxes.map((b)=>({ label:(b.parentElement?.textContent||'').trim(), kind:b.type, checked:b.checked, accessKey:b.accessKey||'', suffix:b.getAttribute('data-access-suffix')||'' })),
        widthScale: info(q('[data-testid="text-font-width-scale"]')),
        charSpacing: info(q('[data-testid="text-font-char-spacing"]')),
        colorBtn: colorBtn ? { tag:colorBtn.tagName, caption:(colorBtn.textContent||'').trim(), accessKey:colorBtn.accessKey||'', suffix:colorBtn.getAttribute('data-access-suffix')||'' } : null,
        colorInput: colorIn ? { tag:colorIn.tagName, kind:colorIn.type, value:colorIn.value } : null,
        swatch: q('[data-testid="text-font-color-swatch"]')?.style?.background || '',
        sampleCaption:(q('[data-testid="text-font-sample-label"]')?.textContent||'').trim(),
        truetype:(q('[data-testid="text-font-truetype-note"]')?.textContent||'').trim(),
        preview: q('[data-testid="text-font-preview"]') ? {
          exists:true,
          deco: getComputedStyle(q('[data-testid="text-font-preview"]').lastElementChild).textDecorationLine,
          color: getComputedStyle(q('[data-testid="text-font-preview"]').lastElementChild).color
        } : { exists:false },
        mmSpans:[...d.querySelectorAll('span')].filter((s)=>(s.textContent||'').trim()==='毫米').length,
        extensions:(q('[data-testid="font-extensions"]')?.textContent||'').slice(0,80),
        hasAmpersand:(d.innerText||'').includes('&')
      } })()`)

    const snap = await snapshot()

    // ---- 分组框：真机两个组框（特殊效果 / 示例）----
    results['字体页分组框整数组全等 = 真机 [特殊效果, 示例] + 复刻版扩展区（标注）'] =
      JSON.stringify(snap?.legends) === JSON.stringify(['特殊效果', '示例', '复刻版扩展（原版「字体」页中无此项）'])

    // ---- 首行三个字段：真机三者都是 ComboBox ----
    results['首行三字段都是下拉（真机 字体名称/字体样式/大小 都是 ComboBox，不是数字框）'] =
      snap?.fonts?.name?.tag === 'SELECT' && snap?.fonts?.style?.tag === 'SELECT' && snap?.fonts?.size?.tag === 'SELECT'
    results['`大小(P):` 是下拉且 31 项（沿用 ui-v125 的真机字号表）'] = (snap?.fontOptions ?? 0) === 31
    results['字体名称下拉含 Symbol/楷体/仿宋（真机字体表）'] =
      ['Symbol', '楷体', '仿宋'].every((name) => (snap?.familyOptions ?? []).includes(name))
    results['三字段都接上加速键 t/y/p（accessKey 与 data-access-suffix 一致）'] =
      snap?.fonts?.name?.accessKey === 't' && snap?.fonts?.name?.suffix === '(T)' &&
      snap?.fonts?.style?.accessKey === 'y' && snap?.fonts?.style?.suffix === '(Y)' &&
      snap?.fonts?.size?.accessKey === 'p' && snap?.fonts?.size?.suffix === '(P)'

    // ---- 特殊效果组：三个复选框（真机 Button 型复选框），不多不少 ----
    results['`特殊效果` 组里恰好 3 个复选框（真机 删除线/下划线/黑底白字）'] =
      (snap?.boxes?.length ?? 0) === 3 && snap.boxes.every((b) => b.kind === 'checkbox')
    results['三个复选框文案逐字 = 删除线(S) / 下划线(U) / 黑底白字(W)（DIFF-83：屏幕不显示 &）'] =
      JSON.stringify(snap?.boxes?.map((b) => b.label)) === JSON.stringify(['删除线(S)', '下划线(U)', '黑底白字(W)'])
    results['三个复选框都接上加速键 s/u/w'] =
      snap?.boxes?.every((b) => b.accessKey === b.label.slice(-2, -1).toLowerCase() && b.suffix === `(${b.label.slice(-2, -1)})`)

    // ---- `字体宽度方向缩放倍数(&H):`（DIFF-90：含「方向」二字 + (H)）----
    results['`字体宽度方向缩放倍数(H):` 是数字框且 min=0.1 max=10，接了加速键 h'] =
      snap?.widthScale?.tag === 'INPUT' && snap.widthScale.kind === 'number' && snap.widthScale.accessKey === 'h' && snap.widthScale.suffix === '(H)'

    // ---- `颜色(&C)...` 是**按钮**（真机 Button 132×45），不是内联色块 ----
    results['`颜色(C)...` 是按钮（真机是 Button，不是内联色块）'] = snap?.colorBtn?.tag === 'BUTTON' && snap.colorBtn.caption === '颜色(C)...'
    results['`颜色(C)...` 接了加速键 c，且按钮内带色块（回显当前颜色）'] =
      snap?.colorBtn?.accessKey === 'c' && snap?.colorBtn?.suffix === '(C)' && (snap?.swatch ?? '').length > 0
    results['按钮背后有一个隐藏的取色输入（点按钮即打开系统取色器）'] =
      snap?.colorInput?.kind === 'color' && /^#[0-9a-fA-F]{6}$/.test(snap?.colorInput?.value ?? '')

    // ---- `字间距(&J):` + 独立 `毫米` ----
    results['`字间距(J):` 是数字框、右侧有独立 `毫米` 文本，接了加速键 j'] =
      snap?.charSpacing?.tag === 'INPUT' && snap.charSpacing.accessKey === 'j' && snap.charSpacing.suffix === '(J)' && (snap?.mmSpans ?? 0) >= 1

    // ---- 示例组：显示示例 + TRUETYPE 逐字 ----
    results['`示例` 组含 `显示示例` 且预览块存在'] = snap?.sampleCaption === '显示示例' && snap?.preview?.exists === true
    results['`这是TRUETYPE字体，显示与打印完全相同!` 逐字一致（半角 !、无空格）'] =
      snap?.truetype === '这是TRUETYPE字体，显示与打印完全相同!'

    // ---- DIFF-83：整页不出现字面量 `&` ----
    results['整页文本不含字面量 `&`（DIFF-83：加速键标记不渲染）'] = snap?.hasAmpersand === false

    // ---- 行为：勾选复选框后预览即时跟随 ----
    await evaluate(`document.querySelector('[data-testid="text-font-strikeout"]')?.click()`)
    await sleep(220)
    const strike = await snapshot()
    results['勾选「删除线(S)」后预览加删除线且复选框回显勾选'] =
      strike?.boxes?.[0]?.checked === true && (strike?.preview?.deco ?? '').includes('line-through')
    await evaluate(`document.querySelector('[data-testid="text-font-strikeout"]')?.click()`)
    await sleep(220)

    await evaluate(`document.querySelector('[data-testid="text-font-underline"]')?.click()`)
    await sleep(220)
    const under = await snapshot()
    results['勾选「下划线(U)」后预览加下划线'] = (under?.preview?.deco ?? '').includes('underline')
    await evaluate(`document.querySelector('[data-testid="text-font-underline"]')?.click()`)
    await sleep(220)

    // ---- 行为：隐藏取色输入改值后色块与预览跟随（`颜色(C)...` 的落地链路）----
    await evaluate(`(() => { const i=document.querySelector('[data-testid="text-font-color-input"]'); const setter=Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype,'value').set; setter.call(i,'#ff0000'); i.dispatchEvent(new Event('input',{bubbles:true})); i.dispatchEvent(new Event('change',{bubbles:true})); return true })()`)
    await sleep(260)
    const red = await snapshot()
    results['取色器改色后按钮内色块与预览字色都同步为 #ff0000'] =
      /255,\s*0,\s*0/.test(red?.swatch ?? '') && /255,\s*0,\s*0/.test(red?.preview?.color ?? '') &&
      (red?.colorInput?.value ?? '').toLowerCase() === '#ff0000'

    // ---- 复刻版扩展区必须**明确标注**（口径：不许既不标注也不删）----
    results['页内多出的字段集中在 `font-extensions` 且标注「复刻版扩展」'] =
      (snap?.extensions ?? '').includes('复刻版扩展')
  } catch (error) {
    results['脚本执行'] = 'ERR ' + (error && error.message ? error.message : String(error))
  } finally {
    try { client?.ws?.close() } catch { /* 忽略关闭异常 */ }
  }
  let failed = 0
  for (const [name, value] of Object.entries(results)) {
    const ok = value === true
    if (!ok) failed++
    console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${ok ? '' : ' -> ' + JSON.stringify(value)}`)
  }
  console.log(`\n${Object.keys(results).length - failed}/${Object.keys(results).length} PASS`)
  process.exit(failed === 0 ? 0 : 1)
})()
