/* 三项帮助明列项的 UI 回归（2026-09-17 需求清单比对后补齐）：
   ① 标签纸颜色（帮助 label_page_page.html：颜色只在编辑标签时显示，不输出底色）
   ② 图片「无效图片」处理方式（帮助 label_object_page_picture.html）
   ③ 图片可变颜色仅单色黑白图（帮助 color_main.html，属性页提示） */
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
    const waitFor = async (expression, timeout = 5000) => {
      const started = Date.now()
      while (Date.now() - started < timeout) { if (await evaluate(expression)) return true; await sleep(80) }
      return false
    }
    const pixelAt = (fx, fy) => evaluate(`(() => {
      const c=document.querySelector('canvas.lower-canvas'); if(!c) return null
      const ctx=c.getContext('2d'); const d=ctx.getImageData(Math.round(c.width*${fx}), Math.round(c.height*${fy}), 1, 1).data
      return d[0]+','+d[1]+','+d[2]
    })()`)
    const key = (name, options = {}) => evaluate(`(() => { const e=new KeyboardEvent('keydown',${JSON.stringify({ key: name, code: name, bubbles: true, cancelable: true, ...options })}); window.dispatchEvent(e); document.dispatchEvent(e); return e.defaultPrevented })()`)

    // ---- 进入编辑态：先验证「系统预定义格式页面信息不可修改」 ----
    await sleep(1600)
    await evaluate('document.querySelector("button[aria-label=关闭]")?.click()')
    await sleep(400)
    await key('n', { ctrlKey: true })
    await sleep(600)
    if (await evaluate('!!document.querySelector("[data-testid=template-wizard]")')) { await click('[data-testid=wizard-next]'); await sleep(500) }
    await click('[data-testid="new-label-select"]')
    if (!await waitFor('!!document.querySelector("canvas.upper-canvas")')) throw new Error('editor did not open')
    await sleep(600)

    await evaluate('document.querySelector("button[title=\'标签格式设置\']")?.click()')
    if (!await waitFor('!!document.querySelector("[data-testid=template-props-tab-label]")')) throw new Error('标签格式设置未打开')
    await click('[data-testid=template-props-tab-label]')
    await sleep(500)
    results['标签页不显示「标签纸颜色」字段'] = await evaluate('!document.querySelector("[data-testid=template-label-color]")')
    await click('[data-testid="template-props-tab-page"]')
    await sleep(300)
    results['页面页有「标签纸颜色」字段且系统预定义格式不可改'] = await evaluate('!!document.querySelector("[data-testid=template-label-color]") && document.querySelector("[data-testid=template-label-color]").disabled === true')
    await evaluate(`(() => { const b=[...document.querySelectorAll('button')].find(x=>x.textContent.trim()==='取消'); if(b) b.click(); return true })()`)
    await sleep(500)

    // ---- ① 自定义格式：选色 → 画布底色变化 ----
    const before = await pixelAt(0.5, 0.5)
    await key('n', { ctrlKey: true })
    await sleep(600)
    if (await evaluate('!!document.querySelector("[data-testid=template-wizard]")')) { await click('[data-testid=wizard-next]'); await sleep(500) }
    await click('[data-testid="new-label-custom"]')
    await sleep(400)
    await click('[data-testid="custom-label-confirm"]')
    await sleep(1500)
    await evaluate('document.querySelector("button[title=\'标签格式设置\']")?.click()')
    if (!await waitFor('!!document.querySelector("[data-testid=template-props-tab-label]")')) throw new Error('标签格式设置未打开（自定义）')
    await click('[data-testid=template-props-tab-label]')
    await sleep(500)
    await click('[data-testid="template-props-tab-page"]')
    await sleep(300)
    results['自定义格式下页面颜色字段可改'] = await evaluate('document.querySelector("[data-testid=template-label-color]").disabled === false')
    results['默认底色为白色'] = (await evaluate('document.querySelector("[data-testid=template-label-color]").value')) === '#ffffff'
    await click("[aria-label='标签纸颜色 #fff8e1']")
    await sleep(400)
    results['选中预设色后字段值更新'] = (await evaluate('document.querySelector("[data-testid=template-label-color]").value')) === '#fff8e1'
    await evaluate(`(() => { const b=[...document.querySelectorAll('button')].find(x=>x.textContent.trim()==='确定'); if(b) b.click(); return true })()`)
    await sleep(1200)
    const after = await pixelAt(0.5, 0.5)
    results['标签编辑底色随颜色变化（仅编辑期）'] = after === '255,248,225'
    results['底色变化前是白色'] = before === '255,255,255'

    // ---- ② 图片「无效图片」处理方式 ----
    await evaluate('document.querySelector("button[title=\'选择工具：图片\']")?.click()')
    await sleep(300)
    const box = await evaluate(`(() => { const r=document.querySelector('canvas.upper-canvas').getBoundingClientRect(); return { left:r.left, top:r.top } })()`)
    const mouse = (type, x, y, buttons = 1) => client.send('Input.dispatchMouseEvent', { type, x, y, button: 'left', buttons, clickCount: type === 'mousePressed' ? 1 : 0 })
    const drag = async (x1, y1, x2, y2) => {
      await mouse('mouseMoved', x1, y1, 0); await sleep(80)
      await mouse('mousePressed', x1, y1, 1)
      for (let i = 1; i <= 6; i++) { await mouse('mouseMoved', x1 + (x2 - x1) * i / 6, y1 + (y2 - y1) * i / 6, 1); await sleep(30) }
      await mouse('mouseReleased', x2, y2, 0); await sleep(500)
    }
    await drag(box.left + 160, box.top + 300, box.left + 320, box.top + 400)
    await evaluate('document.querySelector("button[title=\'选择工具：选取\']")?.click()')
    await sleep(300)
    await key('Enter', { altKey: true })
    if (!await waitFor('!!document.querySelector("[data-testid=image-missing-behavior]")', 4000)) {
      // Alt+Enter 未打开时退回双击
      await mouse('mouseMoved', box.left + 240, box.top + 350, 0)
      await mouse('mousePressed', box.left + 240, box.top + 350, 1)
      await mouse('mouseReleased', box.left + 240, box.top + 350, 0)
      await sleep(200)
      await mouse('mousePressed', box.left + 240, box.top + 350, 1)
      await mouse('mouseReleased', box.left + 240, box.top + 350, 0)
      await sleep(600)
    }
    const hasBehavior = await waitFor('!!document.querySelector("[data-testid=object-props-dialog]")', 4000)
    // 切到「图片」页签（图片相关字段只在该页渲染）
    if (hasBehavior) {
      await evaluate(`(() => { const t=[...document.querySelectorAll('[data-testid^=object-props-tab-]')].find(e=>e.textContent.trim()==='图片'); if(t) t.click(); return !!t })()`)
      await sleep(500)
    }
    const fieldReady = await waitFor('!!document.querySelector("[data-testid=image-missing-behavior]")', 4000)
    // 真机图片属性页签 = 图片 / 常规（PROBE-verifier-object-tabs.md，verifier-31-image-props.png）
    const imageTabs = await evaluate(`([...document.querySelectorAll('[data-testid="object-props-dialog"] [data-testid^="object-props-tab-"]')].map((e)=>(e.textContent||'').trim()))`)
    results['图片属性页签按真机 = 图片 / 常规'] = JSON.stringify(imageTabs) === JSON.stringify(['图片', '常规'])
    results['图片页有「无效图片」处理方式'] = fieldReady
    if (fieldReady) {
      results['「无效图片」默认中止输出'] = (await evaluate('document.querySelector("[data-testid=image-missing-behavior]").value')) === 'error'
      results['「无效图片」含三项处理方式'] = await evaluate(`(() => {
        const opts=[...document.querySelector('[data-testid=image-missing-behavior]').options].map(o=>o.value)
        return JSON.stringify(opts)===JSON.stringify(['error','skip','placeholder'])
      })()`)
      // ---- ③ 图片可变颜色单色提示（变色设置在「常规」页；真机图片属性页签 = 图片 / 常规）----
      // 可变颜色区仅在打印机支持彩色（Windows 驱动）时出现；指令直连时显示
      // 「变色设置不可用」说明（帮助 getstart_color.html）。两者必见其一。
      await evaluate(`(() => { const t=[...document.querySelectorAll('[data-testid^=object-props-tab-]')].find(e=>e.textContent.trim()==='常规'); if(t) t.click(); return !!t })()`)
      await sleep(500)
      results['图片页给出单色黑白说明或打印机不支持说明'] = await evaluate(`(() => {
        const mono=document.querySelector('[data-testid=color-change-image-hint]')
        const blocked=document.querySelector('[data-testid=color-change-printer-note]')
        if (blocked) return (blocked.textContent||'').indexOf('变色设置不可用')>=0
        return !!mono && (mono.textContent||'').indexOf('单色')>=0
      })()`)
    }

    let pass = 0
    for (const [name, value] of Object.entries(results)) {
      console.log((value ? 'PASS ' : 'FAIL ') + name + ' => ' + value)
      if (value === true) pass++
    }
    console.log(`\n${pass}/${Object.keys(results).length} PASS`)
    client.ws.close()
    process.exit(pass === Object.keys(results).length ? 0 : 1)
  } catch (error) {
    console.error('ERR', error.message)
    if (client) client.ws.close()
    process.exit(2)
  }
})()
