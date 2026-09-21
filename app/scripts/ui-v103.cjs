/* A-177~A-185 / A-257~A-265：系统选项（＝系统设置）各页选项的**生效行为**回归。
 *
 * 帮助出处 `config_general.html`：
 *  - 界面语言：设置签赋 LabelShop 界面的语言
 *  - 标尺单位：编辑时所使用的长度单位，可选公制「毫米」和英制「英寸」
 *  - 输出非打印对象：可以输出具有非打印属性的对象
 *  - 不选中非打印对象：具有非打印输出属性的对象不能被选中，仅作为背景显示
 *  - 允许执行脚本：设置是否可以执行脚本变量中的 VBScript
 *  - 启动时运行模板向导：设置是否在启动时启动模板向导对话框
 *  - 标签工作区背景颜色 / 恢复默认
 * 前几轮只盘点了「选项行存在」，本脚本对每一项断言**开关生效后的可见结果**。
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
    const click = (selector) => evaluate(`(() => { const e=document.querySelector(${JSON.stringify(selector)}); if(!e || e.disabled) return false; e.click(); return true })()`)
    const waitFor = async (expression, timeout = 3000) => {
      const started = Date.now()
      while (Date.now() - started < timeout) { if (await evaluate(expression)) return true; await sleep(80) }
      return false
    }
    const key = (name, options = {}) => evaluate(`(() => { const e=new KeyboardEvent('keydown',${JSON.stringify({ key: name, code: name, bubbles: true, cancelable: true, ...options })}); window.dispatchEvent(e); document.dispatchEvent(e); return e.defaultPrevented })()`)
    const setValue = (selector, value) => evaluate(`(() => { const e=document.querySelector(${JSON.stringify(selector)}); if(!e) return false; const proto = e instanceof HTMLSelectElement ? HTMLSelectElement.prototype : e instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype; Object.getOwnPropertyDescriptor(proto,'value').set.call(e, ${JSON.stringify(String(value))}); e.dispatchEvent(new Event('input',{bubbles:true})); e.dispatchEvent(new Event('change',{bubbles:true})); return true })()`)
    const clickMenuItem = async (label) => {
      const ok = await evaluate(`(() => { const e=[...document.querySelectorAll('[data-menu-item]')].find((c)=>c.offsetParent && (c.textContent||'').includes(${JSON.stringify(label)})); if(!e) return false; e.click(); return true })()`)
      await sleep(220); return ok
    }
    const openOptions = async () => {
      await evaluate(`document.querySelector('[data-menu-title="选项(O)"]')?.click()`)
      await sleep(200)
      await clickMenuItem('系统选项(C)')
      await sleep(300)
      return evaluate('!!document.querySelector("[data-testid=options-dialog]")')
    }
    // 按 Row 的标签文案取该行的控件（选项对话框每一行是「标签 div + 控件」两列结构）。
    const rowControl = (label) => evaluate(`(() => {
      const dlg=document.querySelector('[data-testid=options-dialog]'); if(!dlg) return null
      const span=[...dlg.querySelectorAll('span')].find((s)=>(s.textContent||'').trim()===${JSON.stringify(label)})
      if(!span) return null
      const row=span.closest('div')?.parentElement
      if(!row) return null
      const ctl=row.querySelector('select,input,button')
      if(!ctl) return null
      return { tag: ctl.tagName, type: ctl.type || '', value: ctl.value, text: (ctl.textContent||'').trim(), checked: ctl.checked === true }
    })()`)
    const setRow = async (label, value) => {
      const ok = await evaluate(`(() => {
        const dlg=document.querySelector('[data-testid=options-dialog]'); if(!dlg) return false
        const span=[...dlg.querySelectorAll('span')].find((s)=>(s.textContent||'').trim()===${JSON.stringify(label)})
        if(!span) return false
        const row=span.closest('div')?.parentElement; if(!row) return false
        const e=row.querySelector('select,input'); if(!e) return false
        const proto = e instanceof HTMLSelectElement ? HTMLSelectElement.prototype : HTMLInputElement.prototype
        Object.getOwnPropertyDescriptor(proto,'value').set.call(e, ${JSON.stringify(String(value))})
        e.dispatchEvent(new Event('input',{bubbles:true})); e.dispatchEvent(new Event('change',{bubbles:true})); return true
      })()`)
      await sleep(150); return ok
    }
    // 复选框：按行标签点击该行 input
    const toggleRow = async (label, checked) => {
      const ok = await evaluate(`(() => {
        const dlg=document.querySelector('[data-testid=options-dialog]'); if(!dlg) return false
        const span=[...dlg.querySelectorAll('span')].find((s)=>(s.textContent||'').trim()===${JSON.stringify(label)})
        if(!span) return false
        const row=span.closest('div')?.parentElement; if(!row) return false
        const e=row.querySelector('input[type=checkbox]'); if(!e) return false
        if(e.checked !== ${checked ? 'true' : 'false'}) e.click()
        return e.checked === ${checked ? 'true' : 'false'}
      })()`)
      await sleep(180); return ok
    }
    const saveOptions = async () => { await evaluate(`(() => { const b=[...document.querySelectorAll('[data-testid=options-dialog] button')].find((x)=>(x.textContent||'').trim()==='确定'); b?.click(); return !!b })()`); await sleep(400) }
    // 真机「系统设置」的常规项与「启动时运行模板向导」同在「常规」页（probe-r112-sysset.png）。
    const setTab = async (name) => {
      const ok = await evaluate(`(() => { const dlg=document.querySelector('[data-testid=options-dialog]'); if(!dlg) return false; const b=[...dlg.querySelectorAll('button')].find((x)=>(x.textContent||'').trim()===${JSON.stringify(name)}); if(!b) return false; b.click(); return true })()`)
      await sleep(220); return ok
    }
    const closeOptions = async () => {
      await evaluate(`(() => { const b=[...document.querySelectorAll('[data-testid=options-dialog] button')].find((x)=>(x.textContent||'').trim()==='取消'); b?.click(); return !!b })()`)
      await waitFor('!document.querySelector("[data-testid=options-dialog]")', 2000)
      await sleep(350)
    }
    const storedOptions = () => evaluate(`(() => { try { return JSON.parse(localStorage.getItem('maxlabel.options') || '{}') } catch { return {} } })()`)
    const workspaceBg = () => evaluate(`(() => { const v=document.querySelector('[data-testid=workspace-viewport]'); return v?.parentElement ? getComputedStyle(v.parentElement).backgroundColor : '' })()`)
    const clickCanvas = (x, y, double = false) => evaluate(`(() => {
      const host = document.querySelector('[data-testid="workspace-viewport"] canvas.upper-canvas') || document.querySelector('canvas.upper-canvas')
      if (!host) return false
      const box = host.getBoundingClientRect(); const clientX = box.left + ${Number(x) || 0}; const clientY = box.top + ${Number(y) || 0}
      const opts = { bubbles: true, cancelable: true, view: window, clientX, clientY, detail: ${double ? 2 : 1}, button: 0, buttons: 1 }
      host.dispatchEvent(new MouseEvent('mousedown', opts)); host.dispatchEvent(new MouseEvent('mouseup', { ...opts, buttons: 0 }))
      host.dispatchEvent(new MouseEvent('click', { ...opts, buttons: 0 }))
      ${double ? "host.dispatchEvent(new MouseEvent('dblclick', { ...opts, buttons: 0 }))" : ''}
      return true
    })()`)
    // 对象在视口中的中心点：由图层行暴露的毫米坐标 + 编辑区矩形的 px/mm 比例换算，
    // 保证命中判定落在对象内部（按画布左上角固定偏移量点击会落在对象边缘之外）。
    const objectCenter = () => evaluate(`(() => {
      const row=document.querySelector('[data-testid=layer-object-row]'); const area=document.querySelector('[data-testid=template-edit-area]')
      if(!row||!area) return null
      const r=area.getBoundingClientRect(); const w=Number(area.dataset.widthMm), h=Number(area.dataset.heightMm)
      if(!(r.width>0) || !(w>0) || !(h>0)) return null
      const x=Number(row.dataset.objectX), y=Number(row.dataset.objectY), ow=Number(row.dataset.objectW), oh=Number(row.dataset.objectH)
      return { x: r.left + (x+ow/2)*(r.width/w), y: r.top + (y+oh/2)*(r.height/h) }
    })()`)
    const clickPoint = (pt, double = false) => evaluate(`(() => {
      const el=document.elementFromPoint(${Number(pt.x)}, ${Number(pt.y)}); if(!el) return false
      const o={bubbles:true,cancelable:true,view:window,clientX:${Number(pt.x)},clientY:${Number(pt.y)},detail:${double ? 2 : 1},button:0,buttons:1}
      el.dispatchEvent(new MouseEvent('mousedown',o)); el.dispatchEvent(new MouseEvent('mouseup',{...o,buttons:0})); el.dispatchEvent(new MouseEvent('click',{...o,buttons:0}))
      ${double ? "el.dispatchEvent(new MouseEvent('dblclick',{...o,buttons:0}))" : ''}
      return true })()`)
    // 标签外的空白点：用于把选中状态清空（属性对话框关闭时会保留 Fabric 选中）。
    const emptyPoint = () => evaluate(`(() => {
      const area=document.querySelector('[data-testid=template-edit-area]'); const vp=document.querySelector('[data-testid=workspace-viewport]')
      if(!area||!vp) return null
      const a=area.getBoundingClientRect(), v=vp.getBoundingClientRect()
      if (v.bottom - a.bottom > 24) return { x: (a.left+a.right)/2, y: a.bottom + 12 }
      if (a.top - v.top > 24) return { x: (a.left+a.right)/2, y: a.top - 12 }
      if (v.right - a.right > 24) return { x: a.right + 12, y: (a.top+a.bottom)/2 }
      if (a.left - v.left > 24) return { x: a.left - 12, y: (a.top+a.bottom)/2 }
      return null
    })()`)
    const selectedRows = () => evaluate(`([...document.querySelectorAll('[data-testid=layer-object-row]')].filter((e)=>e.dataset.selected==='true').map((e)=>e.dataset.objectId))`)
    const objectInfo = () => evaluate(`(() => { const el=document.querySelector('[data-testid=status-object-info]'); if(!el) return null; return [...el.querySelectorAll('span')].slice(1).map((s)=>s.textContent||'').join('').trim() })()`)

    await sleep(1800)
    await evaluate('document.querySelector("button[aria-label=关闭]")?.click()')
    await key('n', { ctrlKey: true }); await sleep(320)
    if (await evaluate('!!document.querySelector("[data-testid=template-wizard]")')) { await click('[data-testid=wizard-next]'); await sleep(320) }
    await click('[data-testid="new-label-select"]')
    if (!await waitFor('!!document.querySelector("canvas.upper-canvas")')) throw new Error('editor did not open')

    // ---- 1) 入口与整页文案（A-177 / A-257）----
    if (!await openOptions()) throw new Error('系统选项对话框未打开')
    const dialog = await evaluate(`(() => {
      const dlg=document.querySelector('[data-testid=options-dialog]')
      const spans=[...dlg.querySelectorAll('span')].map((s)=>(s.textContent||'').trim())
      const title=(dlg.children[0]?.textContent||'').trim()
      const tabs=[...dlg.querySelectorAll('[data-testid^=options-tab-]')].map((b)=>(b.textContent||'').trim())
      const hasReset=[...dlg.querySelectorAll('button')].some((b)=>(b.textContent||'').trim()==='恢复默认')
      const groups=[...dlg.querySelectorAll('[data-testid^=options-group-]')].map((g)=>g.dataset.testid)
      return { title, spans, tabs, hasReset, groups }
    })()`)
    const NEED_ROWS = ['界面语言(L):', '标尺单位(U):', '输出非打印对象(P)', '不选中非打印对象(N)', '允许运行脚本(S)', '启动时运行模板向导', '自动旋转输出页面', '新建对象后自动打开属性页', '标签工作区背景颜色：']
    // 真机「系统设置」的页签：顺序与文案逐项相等（probe-r112-sysset.md 第一节：常规/打印和数据库/编辑/系统 4 页）
    const SHOT_TABS = ['常规', '打印和数据库', '编辑', '系统']
    // 真机「系统设置 → 常规」的四个分组框（probe-r112-sysset.png / probe-r112-sysset-tree.txt）——
    // 整数组全等：多出/少掉任何一个分组框都要报错（复刻版扩展项刻意不用 options-group- 前缀）
    const NEED_GROUPS = ['options-group-语言', 'options-group-单位', 'options-group-非打印对象', 'options-group-其它']
    const NEED_HINTS = ['编辑标签时使用的长度单位', '可以输出具有非打印属性的对象', '非打印对象仅作为背景显示，不能被选中', '允许执行脚本变量中的脚本，实现高级数据处理', '打印时让内容自动跟随纸张的旋转方向']
    results['A-177/A-257 选项(O)→系统选项(C)... 打开「系统设置」对话框：标题按真机 + 常规页四个分组框（语言/单位/非打印对象/其它）+ 字段按真机原文 + 恢复默认 + 页签'] =
      dialog.title === '系统设置' && NEED_ROWS.every((r) => dialog.spans.includes(r)) && dialog.hasReset &&
      JSON.stringify(dialog.groups) === JSON.stringify(NEED_GROUPS) &&
      JSON.stringify(dialog.tabs) === JSON.stringify(SHOT_TABS) && NEED_HINTS.every((h) => dialog.spans.includes(h))

    // ---- 2) 界面语言（A-177 / A-257）----
    const lang = await rowControl('界面语言(L):')
    const langOptions = await evaluate(`(() => {
      const dlg=document.querySelector('[data-testid=options-dialog]')
      const span=[...dlg.querySelectorAll('span')].find((s)=>(s.textContent||'').trim()==='界面语言(L):')
      const sel=span?.closest('div')?.parentElement?.querySelector('select')
      return sel ? [...sel.options].map((o)=>({ value:o.value, text:(o.textContent||'').trim() })) : null
    })()`)
    results['A-177/A-257 界面语言下拉仅「简体中文」且默认选中'] =
      lang?.tag === 'SELECT' && lang.value === 'zh-CN' && Array.isArray(langOptions) &&
      langOptions.length === 1 && langOptions[0].value === 'zh-CN' && langOptions[0].text === '简体中文'

    // ---- 3) 标尺单位（A-178 / A-258）----
    const mmState = await rowControl('标尺单位(U):')
    await setRow('标尺单位(U):', 'inch')
    await saveOptions()
    await closeOptions()
    const inchTitle = await evaluate(`document.querySelector('[data-testid=status-cursor]')?.getAttribute('title') || ''`)
    await evaluate(`document.querySelector('[data-testid=workspace-viewport] canvas.upper-canvas')?.dispatchEvent(new MouseEvent('mousemove', { bubbles: true }))`)
    const point = await evaluate(`(() => {
      const canvas=document.querySelector('[data-testid="workspace-viewport"] canvas.upper-canvas'); const rect=canvas?.getBoundingClientRect()
      return rect && rect.width>0 ? { x: rect.left + Math.min(30, rect.width/2), y: rect.top + Math.min(30, rect.height/2) } : null
    })()`)
    let cursorInch = ''
    if (point) {
      for (let attempt = 0; attempt < 3; attempt += 1) {
        await client.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: point.x, y: point.y })
        await evaluate(`document.querySelector('[data-testid="workspace-viewport"] canvas.upper-canvas')?.dispatchEvent(new MouseEvent('mousemove', { bubbles: true, clientX: ${point.x}, clientY: ${point.y} }))`)
        await sleep(180)
        cursorInch = await evaluate(`document.querySelector('[data-testid="status-cursor"]')?.textContent?.trim() || ''`)
        if (/in$/.test(cursorInch)) break
      }
    }
    const storedUnit = await storedOptions()
    results['A-178/A-258 标尺单位改为「英寸（英制）」后鼠标位置按英寸显示且写入选项（编辑时长度单位生效）'] =
      mmState?.value === 'mm' && /英寸/.test(String(mmState?.text || '')) && storedUnit.unit === 'inch' &&
      inchTitle === '鼠标位置（in）' && /\d+\.\d{3},\s*-?\d+\.\d{3}\s*in/.test(cursorInch)

    // 复原为毫米（后续断言按帮助默认的公制口径）
    if (!await openOptions()) throw new Error('系统选项对话框未打开（复原单位）')
    await setRow('标尺单位(U):', 'mm')
    await saveOptions(); await closeOptions()
    await client.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: 2, y: 2 }); await sleep(120)
    const afterMm = await storedOptions()

    // ---- 4) 输出非打印对象（A-179 / A-259）----
    if (!await openOptions()) throw new Error('系统选项对话框未打开（输出非打印对象）')
    const pnpDefault = await rowControl('输出非打印对象(P)')
    await toggleRow('输出非打印对象(P)', false)
    await saveOptions(); await closeOptions()
    const pnpOff = await storedOptions()
    if (!await openOptions()) throw new Error('系统选项对话框未打开（回读）')
    const pnpReadback = await rowControl('输出非打印对象(P)')
    await toggleRow('输出非打印对象(P)', true)
    await saveOptions(); await closeOptions()
    const pnpOn = await storedOptions()
    results['A-179/A-259 输出非打印对象：默认勾选，取消勾选保存后 printNonPrintable=false 并回读为未勾选（打印上下文取该值）'] =
      pnpDefault?.checked === true && afterMm.unit === 'mm' && pnpOff.printNonPrintable === false &&
      pnpReadback?.checked === false && pnpOn.printNonPrintable === true

    // ---- 5) 不选中非打印对象（A-180 / A-260）----
    await click('[data-tool="text"]'); await clickCanvas(200, 180); await sleep(500)
    await click('[data-tool="select"]'); await clickCanvas(200, 180, true); await sleep(700)
    if (!await evaluate('!!document.querySelector("[data-testid=object-props-dialog]")')) throw new Error('对象属性对话框未打开')
    const readSuppress = () => evaluate(`(() => {
      const dlg=document.querySelector('[data-testid=object-props-dialog]'); if(!dlg) return null
      const label=[...dlg.querySelectorAll('label')].find((l)=>(l.textContent||'').includes('不打印输出'))
      const input=label?.querySelector('input[type=checkbox]'); return input ? input.checked : null
    })()`)
    const marked = await evaluate(`(() => {
      const dlg=document.querySelector('[data-testid=object-props-dialog]')
      const label=[...dlg.querySelectorAll('label')].find((l)=>(l.textContent||'').includes('不打印输出'))
      const input=label?.querySelector('input[type=checkbox]'); if(!input) return false
      if(!input.checked) input.click()
      return input.checked
    })()`)
    await sleep(400)
    const markedSettled = await readSuppress()
    // 属性对话框是事务式的（round-10）：改动先落本地草稿，点「确定」才提交，取消回滚。
    await evaluate(`(() => { const d=document.querySelector('[data-testid=object-props-dialog]'); const b=[...d.querySelectorAll('button')].find((x)=>(x.textContent||'').trim()==='确定'); b?.click(); return !!b })()`)
    await sleep(500)
    // 往返核验：重新双击对象打开属性页，「不打印输出」必须仍为勾选（写回文档而非对话框本地态）。
    const centerForReadback = await objectCenter()
    if (centerForReadback) await clickPoint(centerForReadback, true)
    await sleep(700)
    const markedReadback = await readSuppress()
    await evaluate('window.dispatchEvent(new KeyboardEvent("keydown",{key:"Escape",bubbles:true,cancelable:true}))'); await sleep(400)
    // 属性对话框关闭时会保留 Fabric 选中（见 LabelEditor 注释），先点标签外空白清空选中，
    // 这样后面观测到的选中状态只可能来自画布上对该对象的点击。
    const emptyPt = await emptyPoint()
    if (emptyPt) await clickPoint(emptyPt)
    await sleep(350)
    await evaluate(`(() => { const r=document.querySelector('[data-testid=layer-object-row][data-selected=true]'); if(!r) return false; r.click(); return true })()`)
    await sleep(350)
    if (!await openOptions()) throw new Error('系统选项对话框未打开（不选中非打印对象）')
    const dspDefault = await rowControl('不选中非打印对象(N)')
    const dspToggledOn = await toggleRow('不选中非打印对象(N)', true)
    await saveOptions(); await closeOptions()
    const dspStoredOn = (await storedOptions()).deselectNonPrintable
    await sleep(300)
    const center = await objectCenter()
    if (center) await clickPoint(center)
    await sleep(400)
    const selectedWhenOn = await selectedRows()
    const infoWhenOn = await objectInfo()
    if (!await openOptions()) throw new Error('系统选项对话框未打开（复原不选中非打印对象）')
    const dspToggledOff = await toggleRow('不选中非打印对象(N)', false)
    await saveOptions(); await closeOptions()
    const dspStoredOff = (await storedOptions()).deselectNonPrintable
    await sleep(300)
    const center2 = await objectCenter()
    // 取消勾选后画布重新可选中：模态卸载后的第一次点击偶发被吞，最多重试三次。
    for (let attempt = 0; attempt < 3 && center2; attempt += 1) {
      await clickPoint(center2)
      await sleep(450)
      if ((await selectedRows()).length) break
    }
    const selectedWhenOff = await selectedRows()
    const infoWhenOff = await objectInfo()
    const nonPrintableLocked = marked === true && markedSettled === true && markedReadback === true && dspDefault?.checked === false && selectedWhenOn.length === 0 &&
      !infoWhenOn && dspToggledOff === true && dspStoredOff === false && selectedWhenOff.length === 1
    if (!nonPrintableLocked) {
      console.log('DEBUG A-180', JSON.stringify({ marked, markedSettled, markedReadback, dspDefault: dspDefault?.checked, dspToggledOn, dspStoredOn, center: !!center, selectedWhenOn, infoWhenOn, dspToggledOff, dspStoredOff, center2: !!center2, selectedWhenOff, infoWhenOff }))
    }
    results['A-180/A-260 不选中非打印对象：默认不勾选；勾选后画布上的非打印对象不能被选中，取消勾选后恢复可选中'] = nonPrintableLocked

    // ---- 6) 允许执行脚本（A-181 / A-261）----
    if (!await openOptions()) throw new Error('系统选项对话框未打开（允许执行脚本）')
    const scriptDefault = await rowControl('允许运行脚本(S)')
    await toggleRow('允许运行脚本(S)', true)
    await saveOptions(); await closeOptions()
    const scriptOn = await storedOptions()
    if (!await openOptions()) throw new Error('系统选项对话框未打开（复原允许执行脚本）')
    await toggleRow('允许运行脚本(S)', false)
    await saveOptions(); await closeOptions()
    const scriptOff = await storedOptions()
    results['A-181/A-261 允许执行脚本：默认不勾选；勾选后 allowScript=true 写入选项（脚本变量解析与打印上下文取该值）'] =
      scriptDefault?.checked === false && scriptOn.allowScript === true && scriptOff.allowScript === false

    // ---- 7) 标签工作区背景颜色 / 恢复默认（A-184/A-185、A-264/A-265）----
    const bgBefore = await workspaceBg()
    if (!await openOptions()) throw new Error('系统选项对话框未打开（标签工作区背景颜色）')
    await setRow('标签工作区背景颜色：', '#ff0000')
    await saveOptions(); await closeOptions()
    await sleep(250)
    const bgAfter = await workspaceBg()
    if (!await openOptions()) throw new Error('系统选项对话框未打开（恢复默认）')
    const bgReadback = await rowControl('标签工作区背景颜色：')
    await evaluate(`(() => { const dlg=document.querySelector('[data-testid=options-dialog]'); const b=[...dlg.querySelectorAll('button')].find((x)=>(x.textContent||'').trim()==='恢复默认'); b?.click(); return !!b })()`)
    await sleep(200)
    await saveOptions(); await closeOptions()
    await sleep(250)
    const bgReset = await workspaceBg()
    results['A-184/A-264 标签工作区背景颜色改为红色后工作区底色立即跟随（写入选项并回读一致）'] =
      bgBefore !== 'rgb(255, 0, 0)' && bgAfter === 'rgb(255, 0, 0)' && String(bgReadback?.value || '').toLowerCase() === '#ff0000'
    results['A-185/A-265 「恢复默认」把标签工作区背景颜色还原为默认色（工作区底色复原）'] =
      bgReset === 'rgb(34, 189, 237)' && (await storedOptions()).workspaceBg === '#22BDED'

    // ---- 8) 启动时运行模板向导（A-182 / A-262）----
    if (!await openOptions()) throw new Error('系统选项对话框未打开（启动时运行模板向导）')
    await setTab('常规')
    const wizardDefault = await rowControl('启动时运行模板向导')
    await toggleRow('启动时运行模板向导', true)
    await saveOptions(); await closeOptions()
    const wizardStored = await storedOptions()
    await evaluate('location.reload()')
    await sleep(3200)
    const wizardShown = await waitFor('!!document.querySelector("[data-testid=template-wizard]")', 8000)
    results['A-182/A-262 启动时运行模板向导：勾选后重新启动应用即自动弹出模板向导'] =
      wizardDefault?.checked === false && wizardStored.startWithWizard === true && wizardShown === true

    // ---- 9) DIFF-71：真机四页签结构 + 「编辑」「系统」两页 + 复刻版扩展区 ----
    // 真机证据：probe-r112-sysset.md（常规/打印和数据库/编辑/系统 四页，逐页字段原文）
    // 上一节把「启动时运行模板向导」打开并重启了应用，这里先关掉向导再进系统设置
    if (await evaluate('!!document.querySelector("[data-testid=template-wizard]")')) {
      await evaluate(`(() => { const b=document.querySelector('[data-testid=wizard-cancel]'); b?.click(); return !!b })()`)
      await sleep(400)
    }
    if (!await openOptions()) throw new Error('系统选项对话框未打开（DIFF-71 页签结构）')
    await setTab('常规')
    const generalExt = await evaluate(`(() => {
      const dlg=document.querySelector('[data-testid=options-dialog]')
      const ext=dlg.querySelector('[data-testid=options-extensions]')
      const groups=[...dlg.querySelectorAll('[data-testid^=options-group-]')].map((g)=>g.dataset.testid)
      return { hasExt: !!ext, groups, extText: ext ? (ext.innerText||'') : '' }
    })()`)
    // 复刻版自造「标签」页被删后，那 6 项设置必须仍可找到（DIFF-71 要求：不许静默删功能）
    const EXT_LABELS = ['默认标签尺寸', '排列', '行列间隔', '外观形状', '显示标尺', '显示网格', '云服务器地址']
    results['DIFF-71 常规页保留复刻版扩展区（原「标签」页 6 项设置仍可找到，未静默删除）'] =
      generalExt.hasExt && EXT_LABELS.every((l) => generalExt.extText.includes(l)) &&
      JSON.stringify(generalExt.groups) === JSON.stringify(['options-group-语言', 'options-group-单位', 'options-group-非打印对象', 'options-group-其它'])

    await setTab('编辑')
    const editPage = await evaluate(`(() => {
      const dlg=document.querySelector('[data-testid=options-dialog]')
      const box=dlg.querySelector('[data-testid=table-keep-size-on-resize]')
      const g=dlg.querySelector('[data-testid=options-group-表格操作]')
      return { hasBox: !!box, checked: box ? box.checked : null, hasGroup: !!g, groupText: g ? (g.innerText||'') : '' }
    })()`)
    results['DIFF-71 编辑页按真机有「表格操作」分组框与「增删行列时，保持表格尺寸」（真机默认未勾选）'] =
      editPage.hasGroup && editPage.groupText.includes('增删行列时，保持表格尺寸') && editPage.hasBox && editPage.checked === false
    await toggleRow('增删行列时，保持表格尺寸', true)
    await saveOptions()
    const keepStored = await storedOptions()
    if (!await openOptions()) throw new Error('系统选项对话框未打开（表格尺寸全局默认回读）')
    await setTab('编辑')
    const keepBack = await evaluate(`(() => { const e=document.querySelector('[data-testid=table-keep-size-on-resize]'); return e ? e.checked : null })()`)
    results['DIFF-71 「增删行列时，保持表格尺寸」勾选后保存并回读（持久化到 maxlabel.options）'] =
      keepStored.tableKeepSizeOnResize === true && keepBack === true

    await setTab('系统')
    const sysPage = await evaluate(`(() => {
      const dlg=document.querySelector('[data-testid=options-dialog]')
      const g=dlg.querySelector('[data-testid=options-group-系统操作]')
      const b=dlg.querySelector('[data-testid=reset-window-layout]')
      return { hasGroup: !!g, hasBtn: !!b, btnText: b ? (b.textContent||'').trim() : '' }
    })()`)
    results['DIFF-71 系统页按真机有「系统操作」分组框与「恢复默认窗体布局」按钮'] =
      sysPage.hasGroup && sysPage.hasBtn && sysPage.btnText === '恢复默认窗体布局'

    await setTab('打印和数据库')
    const printPage = await evaluate(`(() => {
      const dlg=document.querySelector('[data-testid=options-dialog]')
      const g=dlg.querySelector('[data-testid=options-group-数据库]')
      const spans=[...dlg.querySelectorAll('span')].map((s)=>(s.textContent||'').trim())
      const c=[...dlg.querySelectorAll('input[type=checkbox]')].map((i)=>i.dataset.testid)
      return { hasGroup: !!g, groupText: g ? (g.innerText||'') : '', spans, testids: c }
    })()`)
    results['DIFF-71 打印和数据库页按真机有「数据库」分组框与「默认使用多个数据库连接(M)」'] =
      printPage.hasGroup && printPage.groupText.includes('默认使用多个数据库连接(M)') && printPage.testids.includes('use-multiple-database-connections')
    results['DIFF-71 复刻版原「标签」页签已从页签条移除（不再出现「标签」页签）'] =
      !await evaluate(`(() => { const dlg=document.querySelector('[data-testid=options-dialog]'); return [...dlg.querySelectorAll('[data-testid^=options-tab-]')].some((b)=>(b.textContent||'').trim()==='标签') })()`)

    await closeOptions()
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
