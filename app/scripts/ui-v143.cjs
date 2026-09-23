/* 「文字属性 → 文本」页按真机对齐（round-142）。
 *
 * 依据（真机控件树 dump，逐字原文）：
 *  `parity/reference/labelshop/probe-r201-textprops-text-tree.txt`
 *    [V] class=Button  text='单行(&S)'            xy=(1025,545) wh=(121x30)
 *    [V] class=Button  text='多行(&M)'            xy=(1223,545) wh=(121x30)
 *    [V] class=Button  text='圆形(&C)'            xy=(1421,545) wh=(121x30)
 *    [V] class=Static  text='水平对齐(&A):'        xy=(950,671)  wh=(135x24)   + ComboBox(1099,665)
 *    [V] class=Static  DISABLED text='行宽度(&W):' xy=(1297,671) wh=(113x24)   + Edit DISABLED + Static '毫米' DISABLED
 *    [V] class=Button  text='字符模板(&T):'        xy=(950,812)  wh=(179x30)   + Edit DISABLED(1135,809)
 *    [ ] class=Static  text='文字停靠(&P)'         xy=(950,719)  —— 行首 `[ ]` = 单行态**不显示**
 *    [ ] class=Static  text='角度(&E):' / '行距(&L):' / '弧度(&R):' / '字符剪裁(&C):'
 *    [V] class=Button  text='类型'  xy=(928,503) wh=(704x102)   ← 分组框
 *    [V] class=Button  text='属性'  xy=(928,632) wh=(704x378)   ← 分组框
 *  三个 Button 同 y（545）、x 等距（差 198）= 一组**单选按钮**，不是下拉。
 *
 * 判定口径：控件**种类**（radio/checkbox/select）、**逐字文案**、**数量**、**启用态**、**按模式显示**
 * 四类都从 dump 推出来，全部可证伪；不用"页面里有没有这几个字"这种松判（那是旧的 GAP 口径）。
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

    // 建一个**文字**对象并打开属性对话框（与真机对照图同对象类型）。
    await evaluate('document.dispatchEvent(new KeyboardEvent("keydown",{key:"n",code:"KeyN",ctrlKey:true,bubbles:true,cancelable:true}))')
    await sleep(700)
    if (await evaluate('!!document.querySelector("[data-testid=template-wizard]")')) { await evaluate('document.querySelector("[data-testid=wizard-next]")?.click()'); await sleep(800) }
    if (await evaluate('!!document.querySelector("[data-testid=new-label-dialog]")')) { await evaluate('document.querySelector("[data-testid=new-label-select]")?.click()'); await sleep(1400) }
    if (!(await waitFor('!!document.querySelector("canvas.upper-canvas")'))) throw new Error('没进编辑器')
    await evaluate('document.querySelector(\'[data-tool="text"]\')?.click()')
    await sleep(350)
    // 在画布上画一个文字对象（拖拽），再双击打开属性页。
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
    await evaluate(`(() => { const b=[...document.querySelectorAll('[data-testid^="object-props-tab-"]')].find((x)=>(x.textContent||'').trim()==='文本'); b?.click(); return !!b })()`)
    await sleep(350)

    /** 读文本页的关键结构（分组框 legend / 控件种类 / 文案 / 启用态 / 加速键） */
    const snapshot = () => evaluate(`(() => {
      const d=document.querySelector('[data-testid="object-props-dialog"]'); if(!d) return null
      const q=(s)=>d.querySelector(s)
      const fs=[...d.querySelectorAll('fieldset')]
      const radioBox=q('[data-testid="text-group-type"]')
      const radios=[...(radioBox?.querySelectorAll('input[type=radio]')||[])]
      const w=q('[data-testid="text-line-width"]')
      const tpl=q('[data-testid="text-char-template"]')
      const tplOn=q('[data-testid="text-char-template-enabled"]')
      return {
        legends: fs.map((f)=>(f.querySelector('legend')?.textContent||'').trim()),
        radios: radios.map((r)=>({ id:(r.getAttribute('data-testid')||'').replace('text-type-',''), kind:r.type, name:r.name,
                                   label:(r.parentElement?.textContent||'').trim(), checked:r.checked,
                                   accessKey:r.accessKey, suffix:r.getAttribute('data-access-suffix') })),
        checked:[...radios].filter((r)=>r.checked).map((r)=>(r.getAttribute('data-testid')||'').replace('text-type-','')),
        align: (() => { const s=q('[data-testid="text-align"]'); return s ? { tag:s.tagName, values:[...s.options].map((o)=>o.value), labels:[...s.options].map((o)=>o.textContent.trim()), value:s.value, accessKey:s.accessKey, suffix:s.getAttribute('data-access-suffix') } : null })(),
        lineWidth: w ? { tag:w.tagName, disabled:w.disabled, min:w.min, step:w.step, accessKey:w.accessKey, suffix:w.getAttribute('data-access-suffix') } : null,
        template: tpl ? { tag:tpl.tagName, disabled:tpl.disabled, value:tpl.value } : null,
        templateToggle: tplOn ? { kind:tplOn.type, checked:tplOn.checked, accessKey:tplOn.accessKey, suffix:tplOn.getAttribute('data-access-suffix') } : null,
        hasDock: !!d.querySelector('select[accesskey="p"]'),
        dockCaption:(d.textContent||'').includes('文字停靠'),
        hasRadius: !!q('[data-testid="text-arc-radius"]'),
        extensions: (q('[data-testid="text-extensions"]')?.textContent||'').slice(0, 60),
        mmCount: [...d.querySelectorAll('span')].filter((s)=>(s.textContent||'').trim()==='毫米').length
      } })()`)
    /** 用**真实点击**切换「类型」单选 */
    const pick = async (kind) => { await evaluate(`document.querySelector('[data-testid="text-type-${kind}"]')?.click()`); await sleep(220) }

    const single = await snapshot()
    results['文本页分组框整数组全等 = 真机 [类型, 属性]'] = JSON.stringify(single?.legends) === JSON.stringify(['类型', '属性'])

    // ---- 类型 = 三个同名单选按钮（不是下拉）----
    results['「类型」组是三个 radio（真机 121×30 Button ×3 同一行等距）'] =
      (single?.radios.length ?? 0) === 3 && single.radios.every((r) => r.kind === 'radio') && new Set(single.radios.map((r) => r.name)).size === 1
    results['三个单选的文案与顺序逐字 = 单行(S) / 多行(M) / 圆形(C)（DIFF-83：屏幕上不显示 &）'] =
      JSON.stringify(single?.radios.map((r) => r.label)) === JSON.stringify(['单行(S)', '多行(M)', '圆形(C)'])
    results['默认选中「单行」（真机 dump 的现场态）'] = JSON.stringify(single?.checked) === JSON.stringify(['single'])
    results['三个单选都接上加速键 s/m/c（accessKey 与 data-access-suffix 一致）'] =
      single?.radios.every((r) => r.accessKey === r.id[0] && r.suffix === `(${r.id[0].toUpperCase()})`)

    // ---- 属性组：水平对齐 / 行宽度 / 字符模板 ----
    results['有 `水平对齐(A):` 且是下拉，4 项顺序 = left,center,right,justify'] =
      single?.align?.tag === 'SELECT' && JSON.stringify(single.align.values) === JSON.stringify(['left', 'center', 'right', 'justify'])
    results['`水平对齐` 接了加速键 a'] = single?.align?.accessKey === 'a' && single?.align?.suffix === '(A)'
    results['`行宽度(W):` 带独立单位文本 `毫米`，输入框 min=0.1 step=0.1，接了加速键 w'] =
      single?.lineWidth?.tag === 'INPUT' && single.lineWidth.min === '0.1' && single.lineWidth.step === '0.1' &&
      single.lineWidth.accessKey === 'w' && single.lineWidth.suffix === '(W)' && (single.mmCount ?? 0) >= 1
    results['单行态 `行宽度(W):` 输入框 DISABLED（真机 dump 同态）'] = single?.lineWidth?.disabled === true
    results['`字符模板(T):` 是**复选框** + 独立输入框（真机 Button 179×30 + Edit）'] =
      single?.templateToggle?.kind === 'checkbox' && single?.template?.tag === 'INPUT' && single.templateToggle.accessKey === 't'
    results['单行态 `字符模板` 输入框 DISABLED（真机 dump: Edit DISABLED）'] = single?.template?.disabled === true

    // ---- 按模式显示：单行态不显示 文字停靠/弧度 ----
    results['单行态**不显示** `文字停靠`（真机 dump 行首 `[ ]`）'] = single?.hasDock === false && single?.dockCaption === false
    results['单行态不显示圆形文字的「半径」字段'] = single?.hasRadius === false

    // ---- 切到多行：文字停靠出现、行宽度可用 ----
    await pick('multi')
    const multi = await snapshot()
    results['点「多行」后文字类型切到 multi'] = JSON.stringify(multi?.checked) === JSON.stringify(['multi'])
    results['多行态出现 `文字停靠`（带加速键 p）'] = multi?.hasDock === true
    results['多行态 `行宽度(W):` 输入框可用'] = multi?.lineWidth?.disabled === false

    // ---- 切到圆形：出现 半径/弧度/角度 ----
    await pick('circle')
    const circle = await snapshot()
    results['点「圆形」后文字类型切到 circle'] = JSON.stringify(circle?.checked) === JSON.stringify(['circle'])
    results['圆形态出现「半径」字段'] = circle?.hasRadius === true

    // ---- 字符模板：勾选后才可编辑（勾选前 charTemplate 未定义 = 不启用模板）----
    await pick('single')
    await evaluate(`document.querySelector('[data-testid="text-char-template-enabled"]')?.click()`)
    await sleep(220)
    const tplOn = await snapshot()
    results['勾选「字符模板(T):」后输入框变为可编辑'] = tplOn?.templateToggle?.checked === true && tplOn?.template?.disabled === false
    await evaluate(`document.querySelector('[data-testid="text-char-template-enabled"]')?.click()`)
    await sleep(220)
    const tplOff = await snapshot()
    results['取消勾选后输入框回到 DISABLED（模板不启用）'] = tplOff?.templateToggle?.checked === false && tplOff?.template?.disabled === true

    // ---- 复刻版扩展区必须**明确标注**（验收方口径：不许既不标注也不删）----
    results['页内多出的字段集中在 `text-extensions` 且标注「复刻版扩展」'] =
      (single?.extensions ?? '').includes('复刻版扩展')
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
