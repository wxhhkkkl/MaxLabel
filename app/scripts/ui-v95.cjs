/* A3 格式栏逐控件点击行为（A-122～A-137）：
 * 每个控件点击后既要改变选中对象的模型，也要与对象属性对话框（同一模型）同步。
 * 依据：帮助 toolbar_format.html 的「控件名称 / 作用」清单。 */
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
    const key = (name, options = {}) => evaluate(`(() => { const e=new KeyboardEvent('keydown',${JSON.stringify({ key: name, code: name, bubbles: true, cancelable: true, ...options })}); window.dispatchEvent(e); document.dispatchEvent(e); return true })()`)
    const waitFor = async (expression, timeout = 3000) => {
      const started = Date.now()
      while (Date.now() - started < timeout) {
        if (await evaluate(expression)) return true
        await sleep(80)
      }
      return false
    }
    const setValue = (selector, value) => evaluate(`(() => {
      const e=document.querySelector(${JSON.stringify(selector)}); if(!e)return false
      const proto=e instanceof HTMLSelectElement?HTMLSelectElement.prototype:HTMLInputElement.prototype
      const setter=Object.getOwnPropertyDescriptor(proto,'value').set
      setter.call(e,${JSON.stringify(String(value))})
      e.dispatchEvent(new Event('input',{bubbles:true})); e.dispatchEvent(new Event('change',{bubbles:true})); return true
    })()`)
    const dragCanvas = (x1, y1, x2, y2) => evaluate(`(() => {
      const c=document.querySelector('canvas.upper-canvas')||document.querySelector('canvas'); if(!c)return false
      const b=c.getBoundingClientRect()
      const p=(x,y,buttons=1)=>({bubbles:true,cancelable:true,view:window,clientX:b.left+x,clientY:b.top+y,button:0,buttons})
      c.dispatchEvent(new MouseEvent('mousedown',p(${x1},${y1})))
      c.dispatchEvent(new MouseEvent('mousemove',p(${x2},${y2})))
      c.dispatchEvent(new MouseEvent('mouseup',{...p(${x2},${y2},0),buttons:0})); return true
    })()`)
    /** 格式栏控件按 title 定位（帮助「控件名称」→ 实现里的 title 文案） */
    const fb = (title) => `[data-testid="format-bar"] [title="${title}"]`
    const fbClick = async (title) => { const ok = await click(fb(title)); await sleep(200); return ok }
    const fbDisabled = (title) => evaluate(`document.querySelector(${JSON.stringify(fb(title))})?.disabled === true`)
    const fbActive = (title) => evaluate(`(() => { const e=document.querySelector(${JSON.stringify(fb(title))}); return !!e && getComputedStyle(e).backgroundColor === 'rgb(234, 243, 251)' })()`)
    const fbValue = (title) => evaluate(`document.querySelector(${JSON.stringify(fb(title))})?.value`)
    const dlg = (selector) => `[data-testid="object-props-dialog"] ${selector}`
    const dlgText = (selector) => evaluate(`document.querySelector(${JSON.stringify(dlg(selector))})?.textContent?.trim() || ''`)
    /** 用 Alt+Enter 打开属性对话框（与双击同一入口），读完用「取消」关闭以免回写草稿 */
    const openProps = async (tabKey) => {
      await key('Enter', { altKey: true })
      if (!await waitFor('!!document.querySelector("[data-testid=object-props-dialog]")')) return false
      if (tabKey) { await click(dlg(`[data-testid="object-props-tab-${tabKey}"]`)); await sleep(180) }
      return true
    }
    const closeProps = async () => {
      await evaluate(`(() => {
        const d=document.querySelector('[data-testid=object-props-dialog]'); if(!d)return false
        const cancel=[...d.querySelectorAll('button')].find((b)=>b.textContent.trim()==='取消')
        if(cancel){cancel.click(); return true}
        d.querySelector('button[aria-label]')?.click(); return true
      })()`)
      await sleep(220)
    }
    /** 对话框里「字体」下拉：选项集合里含 黑体 的那个 select */
    const dialogFont = () => evaluate(`(() => {
      const s=[...document.querySelectorAll('[data-testid=object-props-dialog] select')].find((e)=>[...e.options].some((o)=>o.value==='黑体'))
      return s?.value ?? null
    })()`)
    const dialogPt = () => evaluate(`(() => {
      const s=[...document.querySelectorAll('[data-testid=object-props-dialog] select')].find((e)=>[...e.options].some((o)=>o.value==='24') && [...e.options].some((o)=>o.value==='72'))
      return s?.value ?? null
    })()`)
    const dialogAlign = () => evaluate(`(() => {
      const s=[...document.querySelectorAll('[data-testid=object-props-dialog] select')].find((e)=>[...e.options].map((o)=>o.value).join(',')==='left,center,right,justify')
      return s?.value ?? null
    })()`)
    // DIFF-89（round-143）：真机「字体」页的 `下划线(&U)` 是**复选框**（probe-r201-textprops-font-tree.txt:
    // `Button text='下划线(&U)'`），复刻版原来把它做成「按下态按钮」——按 dump 改成复选框后，
    // 这里读它是否勾选（判定强度不变：仍是"格式栏改了 → 对话框同源反映"）。
    const dialogUnderlinePressed = () => evaluate(`(() => {
      const c=document.querySelector('[data-testid="object-props-dialog"] [data-testid="text-font-underline"]')
      return !!c && c.type === 'checkbox' && c.checked === true
    })()`)
    const dialogReverseChecked = () => evaluate(`(() => {
      const l=[...document.querySelectorAll('[data-testid=object-props-dialog] label')].find((e)=>e.textContent.includes('黑底白字'))
      return l?.querySelector('input[type=checkbox]')?.checked === true
    })()`)
    // round-143：真机「字体」页的颜色是 `颜色(&C)...` **按钮**（Button 132×45），取色输入被藏在按钮后面
    // → 读那个隐藏输入的值（与格式栏同源，仍是值级判定）。
    const dialogColor = () => evaluate(`(() => {
      const i=document.querySelector('[data-testid="object-props-dialog"] [data-testid="text-font-color-input"]')
      return (i?.value || '').toUpperCase()
    })()`)
    const layerTypes = () => evaluate(`[...document.querySelectorAll('[data-testid=layer-object-row]')].map((e)=>e.getAttribute('data-object-type'))`)

    await sleep(1800)
    await evaluate('document.querySelector("button[aria-label=关闭]")?.click()')
    await key('n', { ctrlKey: true }); await sleep(320)
    if (await evaluate('!!document.querySelector("[data-testid=template-wizard]")')) {
      await click('[data-testid="wizard-next"]'); await sleep(320)
    }
    await click('[data-testid="new-label-select"]')
    if (!await waitFor('!!document.querySelector("canvas.upper-canvas")', 8000)) throw new Error('editor did not open')

    // 一个文字对象（格式栏绝大多数控件只对文字生效）+ 一个矩形对象（组合用）
    await click('[data-tool="text"]'); await dragCanvas(200, 130, 420, 210); await sleep(400)
    await click('[data-tool="rect"]'); await dragCanvas(200, 280, 360, 380); await sleep(400)

    // ---- A-122 格式栏控件集合与顺序 ----
    const fbTitles = await evaluate(`[...document.querySelectorAll('[data-testid=format-bar] [title]')].map((e)=>e.title)`)
    const wantedHead = ['字体', '字号', '粗体', '斜体', '下划线', '反白', '字体颜色', '背景颜色']
    const wantedDock = ['居左', '居中', '居右', '撑满（两端对齐）']
    const wantedTail = ['组合（将选中的多个对象组合为一个整体）', '取消组合', '属性']
    results['A-122 格式栏按帮助顺序含字体/字号/粗斜体/下划线/反白/颜色/文字停靠四项/组合/取消组合/属性'] =
      JSON.stringify(fbTitles.slice(0, 8)) === JSON.stringify(wantedHead) &&
      JSON.stringify(fbTitles.slice(8, 12)) === JSON.stringify(wantedDock) &&
      JSON.stringify(fbTitles.slice(-3)) === JSON.stringify(wantedTail) &&
      fbTitles.length === 15

    // 选中文字对象（图层行点选），后续控件才有作用对象
    const selectType = (type) => evaluate(`(() => {
      const row=[...document.querySelectorAll('[data-testid=layer-object-row]')].find((e)=>e.getAttribute('data-object-type')===${JSON.stringify(type)})
      if(!row)return false; if(row.getAttribute('data-selected')!=='true')row.click(); return true
    })()`)
    await selectType('text')
    await sleep(260)
    const textSelected = await evaluate(`[...document.querySelectorAll('[data-testid=layer-object-row]')].some((e)=>e.getAttribute('data-selected')==='true' && e.getAttribute('data-object-type')==='text')`)
    if (!textSelected) throw new Error('text object not selected')

    // ---- A-123 字体 ----
    const fontSet = await setValue(fb('字体'), '黑体'); await sleep(220)
    const fontBar = await fbValue('字体')
    await openProps('font')
    const fontDialog = await dialogFont()
    await closeProps()
    results['A-123 字体下拉改黑体后格式栏与属性对话框同步'] = fontSet && fontBar === '黑体' && fontDialog === '黑体'

    // ---- A-124 字号（磅） ----
    const ptSet = await setValue(fb('字号'), '24'); await sleep(220)
    const ptBar = await fbValue('字号')
    await openProps('font')
    const ptDialog = await dialogPt()
    await closeProps()
    results['A-124 字号下拉改 24 磅后格式栏与属性对话框同步（不回空）'] = ptSet && ptBar === '24' && ptDialog === '24'

    // ---- A-125 粗体 / A-126 斜体 ----
    await fbClick('粗体')
    const boldActive = await fbActive('粗体')
    await openProps('font')
    const boldStyle = await dlgText('[data-testid="text-font-style"]')
    const boldDialog = await evaluate('document.querySelector("[data-testid=object-props-dialog] [data-testid=text-font-style]")?.value')
    await closeProps()
    results['A-125 粗体按钮点击后格式栏按下且属性对话框字体样式为粗体'] = boldActive && boldDialog === 'bold' && boldStyle !== ''

    await fbClick('斜体')
    const italicActive = await fbActive('斜体')
    await openProps('font')
    const biDialog = await evaluate('document.querySelector("[data-testid=object-props-dialog] [data-testid=text-font-style]")?.value')
    await closeProps()
    results['A-126 斜体按钮点击后格式栏按下且属性对话框字体样式为粗斜体'] = italicActive && biDialog === 'boldItalic'

    // ---- A-127 下划线 ----
    await fbClick('下划线')
    const ulActive = await fbActive('下划线')
    await openProps('font')
    const ulDialog = await dialogUnderlinePressed()
    await closeProps()
    results['A-127 下划线按钮点击后格式栏按下且属性对话框下划线按钮处于按下态'] = ulActive && ulDialog

    // ---- A-128 反白 ----
    await fbClick('反白')
    const revActive = await fbActive('反白')
    await openProps('font')
    const revDialog = await dialogReverseChecked()
    await closeProps()
    results['A-128 反白按钮点击后格式栏按下且属性对话框黑底白字勾选'] = revActive && revDialog

    // ---- A-129 颜色 ----
    const colorOpened = await fbClick('字体颜色')
    const colorInput = '[data-testid="format-bar"] input[type=color]'
    await setValue(colorInput, '#FF0000'); await sleep(260)
    await fbClick('字体颜色'); await sleep(220)
    const colorHint = await evaluate(`[...document.querySelectorAll('[data-testid=format-bar] div')].map((e)=>e.textContent).find((t)=>t && t.includes('当前：')) || ''`)
    await fbClick('字体颜色'); await sleep(180)
    await openProps('font')
    const colorDialog = await dialogColor()
    await closeProps()
    results['A-129 颜色按钮取色后格式栏当前色与属性对话框颜色同步为 #FF0000'] =
      colorOpened && colorHint.toUpperCase().includes('#FF0000') && colorDialog === '#FF0000'

    // ---- A-130～A-133 文字停靠四项（逐项与属性对话框「对齐」核对） ----
    const DOCK = [['居左', 'left', 'A-130'], ['居中', 'center', 'A-131'], ['居右', 'right', 'A-132'], ['撑满（两端对齐）', 'justify', 'A-133']]
    for (const [title, value, id] of DOCK) {
      await fbClick(title)
      const active = await fbActive(title)
      await openProps('text')
      const align = await dialogAlign()
      await closeProps()
      results[`${id} 文字停靠「${title}」点击后属性对话框对齐=${value}`] = active && align === value
    }

    // ---- A-134/135/136 组合与取消组合 ----
    const groupDisabledAlone = await fbDisabled('组合（将选中的多个对象组合为一个整体）')
    const ungroupDisabledAlone = await fbDisabled('取消组合')
    await key('a', { ctrlKey: true }); await sleep(260)
    const groupEnabledTwo = !(await fbDisabled('组合（将选中的多个对象组合为一个整体）'))
    await fbClick('组合（将选中的多个对象组合为一个整体）')
    const grouped = (await layerTypes()).includes('group')
    await evaluate(`(() => {
      const row=[...document.querySelectorAll('[data-testid=layer-object-row]')].find((e)=>e.getAttribute('data-object-type')==='group')
      if(row && row.getAttribute('data-selected')!=='true')row.click(); return !!row
    })()`)
    await sleep(260)
    const ungroupEnabledGroup = !(await fbDisabled('取消组合'))
    await fbClick('取消组合')
    const afterUngroup = await layerTypes()
    results['A-134 组合按钮将两个对象合成为一个组合对象并可再取消组合'] =
      grouped && ungroupEnabledGroup && !afterUngroup.includes('group') && afterUngroup.length === 2
    results['A-135 组合按钮仅在选中两个及以上对象时可用'] = groupDisabledAlone && groupEnabledTwo
    results['A-136 取消组合按钮仅在选中组合对象时可用'] = ungroupDisabledAlone && ungroupEnabledGroup

    // ---- A-137 属性按钮 ----
    await evaluate(`(() => {
      const row=[...document.querySelectorAll('[data-testid=layer-object-row]')].find((e)=>e.getAttribute('data-object-type')==='text')
      if(row && row.getAttribute('data-selected')!=='true')row.click(); return !!row
    })()`)
    await sleep(240)
    await evaluate('document.querySelector(\'[data-testid="format-bar"] [title="属性"]\').click()')
    const propsOpened = await waitFor('!!document.querySelector("[data-testid=object-props-dialog]")')
    const propsTitle = await evaluate('document.querySelector("[data-testid=object-props-dialog]")?.textContent || ""')
    await closeProps()
    results['A-137 属性按钮打开对象属性对话框（标题=对象属性 - 文字）'] = propsOpened && propsTitle.includes('对象属性')

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
