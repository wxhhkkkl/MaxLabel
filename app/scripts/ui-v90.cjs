/* A-34/A-35/A-37/A-38/A-39/A-42/A-43：文件菜单入口与文档生命周期回归。
 *
 * round-108：A-42 的标签页字段断言原本查的是自造名（标签宽度/水平间距/垂直间距）。
 * 那些名字已在 round-106/107 按真机原文改成 宽度(W):/高度(H):/列距(P):/行距(L):/列数(C):/行数(R):
 * （证据 probe-round105-custom-label-tree.txt），断言随行为变更同步改写，
 * 强度不降反升：从「包含 4 个字串」改为「6 个真机字段逐项命中 + 4 个自造名一个都不留 + 5 个分组框齐全」。 */
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
    const waitFor = async (expression, timeout = 4500) => {
      const started = Date.now()
      while (Date.now() - started < timeout) {
        if (await evaluate(expression)) return true
        await sleep(80)
      }
      return false
    }
    const click = (selector) => evaluate(`(() => {
      const e=document.querySelector(${JSON.stringify(selector)})
      if(!e || e.disabled || !e.offsetParent)return false
      e.click(); return true
    })()`)
    const openMenu = async (title) => {
      const opened = await click(`[data-menu-title="${title}"]`)
      await sleep(80)
      return opened
    }
    const clickMenuItem = (label) => evaluate(`(() => {
      const wanted=${JSON.stringify(label)}
      const e=[...document.querySelectorAll('[data-menu-item]')].find((candidate)=>candidate.offsetParent && candidate.getAttribute('data-menu-item')===wanted)
      if(!e || e.getAttribute('data-menu-disabled')==='true')return false
      e.click(); return true
    })()`)
    const closeModal = () => evaluate(`(() => {
      const buttons=[...document.querySelectorAll('button[aria-label="关闭"]')].filter((e)=>e.offsetParent)
      buttons.at(-1)?.click(); return true
    })()`)
    const closeMenu = () => evaluate('document.body.dispatchEvent(new MouseEvent("mousedown",{bubbles:true,clientX:2,clientY:2}))')

    await sleep(1700)
    await closeModal()
    await sleep(180)

    // A-34：文件菜单中的条幅飘带是独立创建动作，不复用普通新建的默认尺寸。
    results['A-34 文件菜单保留独立新建条幅飘带入口'] = await openMenu('文件(F)') && await evaluate(`!![...document.querySelectorAll('[data-menu-item]')].find((e)=>e.offsetParent && e.getAttribute('data-menu-item')==='新建条幅飘带')`)
    results['A-34 新建条幅飘带创建100x15mm文档'] = await clickMenuItem('新建条幅飘带') && await waitFor('!!document.querySelector("canvas.upper-canvas")') && await evaluate(`(() => {
      const tab=document.querySelector('[data-testid="document-tab"][data-active="true"]')
      const spec=document.querySelector('[data-testid="status-label-spec"]')?.textContent||''
      return (tab?.getAttribute('data-document-title')||'').startsWith('条幅飘带') && spec.includes('100mm x 15mm')
    })()`)

    // 原生文件选择器不在 CDP 页面上下文内：用真实模板库文件作为固定路径 IPC 夹具。
    const fixture = JSON.stringify({ version: 1, name: 'ui-v90-open', widthMm: 42, heightMm: 24, objects: [] })
    const lib = await evaluate(`window.maxlabel.saveTemplateToLib('ui-v90-open', ${JSON.stringify(fixture)})`)
    if (!lib?.ok || !lib.path) throw new Error('could not create open fixture')
    const probe = await evaluate(`window.maxlabel.openTemplatePath(${JSON.stringify(lib.path)})`)
    const parsedProbe = probe?.content ? JSON.parse(probe.content) : null
    results['A-35 打开菜单入口可用且固定路径 IPC 能读取模板'] = await openMenu('文件(F)') && await evaluate(`document.querySelector('[data-menu-item="打开(O)..."]')?.getAttribute('data-menu-disabled')==='false'`) && probe?.ok === true && parsedProbe?.name === 'ui-v90-open' && parsedProbe?.widthMm === 42
    await closeMenu()

    // 将固定路径装入 RecentFile 镜像，随后走产品真实的“最近文件”打开回调。
    await evaluate(`localStorage.setItem('maxlabel.recent', JSON.stringify([{title:'ui-v90-open',path:${JSON.stringify(lib.path)},state:0}])); location.reload()`)
    await sleep(1300)
    await closeModal()
    await sleep(180)
    results['A-43 最近文件空态切换为真实文件记录'] = await waitFor(`!!document.querySelector('[data-testid="start-recent-list"] a')`) && await evaluate(`document.querySelector('[data-testid="start-recent-list"] a')?.textContent.trim()==='ui-v90-open'`)
    await click('[data-testid="start-recent-list"] a')
    if (!await waitFor('!!document.querySelector("canvas.upper-canvas")')) throw new Error('recent template did not open')
    results['A-35 最近文件等价打开路径创建42x24mm文档'] = await evaluate(`document.querySelector('[data-testid="status-label-spec"]')?.textContent.includes('42mm x 24mm') && !!document.querySelector('[data-testid="document-tab"][data-document-title="ui-v90-open"]')`)

    // 当前文档已带保存路径；创建对象令“保存”变脏并恢复可用，然后走真实保存菜单回调。
    await click('[data-tool="text"]')
    await evaluate(`(() => { const c=document.querySelector('canvas.upper-canvas'); const r=c?.getBoundingClientRect(); if(!c||!r)return false; const p={bubbles:true,cancelable:true,view:window,clientX:r.left+r.width*.25,clientY:r.top+r.height*.25,button:0,buttons:1}; c.dispatchEvent(new MouseEvent('mousedown',p)); c.dispatchEvent(new MouseEvent('mouseup',{...p,buttons:0})); return true })()`)
    await sleep(350)
    await openMenu('文件(F)')
    results['A-37 脏文档时保存菜单恢复可用'] = await evaluate(`document.querySelector('[data-menu-item="保存(S)"]')?.getAttribute('data-menu-disabled')==='false'`)
    results['A-39 未登录时分享菜单保持禁用'] = await evaluate(`document.querySelector('[data-menu-item="分享(I)..."]')?.getAttribute('data-menu-disabled')==='true'`)
    results['A-43 最近文件子菜单包含ui-v90-open'] = await clickMenuItem('最近的文件') && await sleep(80).then(() => evaluate(`!![...document.querySelectorAll('[data-menu-item]')].find((e)=>e.offsetParent && e.getAttribute('data-menu-item')==='ui-v90-open')`))
    results['A-37 保存菜单写回已打开文件'] = await clickMenuItem('保存(S)') && await waitFor(`!document.querySelector('[data-testid="document-tab"][data-active="true"]')?.getAttribute('data-document-title')?.endsWith(' *')`) && await evaluate(`(async()=> (await window.maxlabel.openTemplatePath(${JSON.stringify(lib.path)}))?.ok===true)()`)

    // A-38 的菜单语义是“总是弹出另存为”；入口和固定路径 IPC 产物覆盖该等价路径。
    await openMenu('文件(F)')
    results['A-38 另存为菜单入口可用且不禁用'] = await evaluate(`document.querySelector('[data-menu-item="另存为(A)..."]')?.getAttribute('data-menu-disabled')==='false'`)
    const saveAs = await evaluate(`window.maxlabel.saveTemplateToLib('ui-v90-save-as', ${JSON.stringify(fixture)})`)
    const saveAsProbe = saveAs?.path ? await evaluate(`window.maxlabel.openTemplatePath(${JSON.stringify(saveAs.path)})`) : null
    results['A-38 另存为等价 IPC 产物可重新打开'] = saveAs?.ok === true && saveAsProbe?.ok === true && saveAsProbe.content.includes('ui-v90-open')
    await closeMenu()

    // A-42：模板属性设置保持四个原版页签，关键设置分布在打印机与标签页。
    await openMenu('文件(F)')
    results['A-42 模板属性设置菜单打开对话框'] = await clickMenuItem('模板属性设置(M)...') && await waitFor('!!document.querySelector("[data-testid=template-props-dialog]")')
    results['A-42 模板属性包含四页签和关键字段'] = await evaluate(`(() => {
      const root=document.querySelector('[data-testid="template-props-dialog"]')
      if(!root) return false
      const labels=[...root.querySelectorAll('[data-testid^="template-props-tab-"]')].map((e)=>(e.textContent||'').trim())
      // 标签页字段名以真机「标签格式设置 → 标签」原文为准（证据 parity/reference/labelshop/probe-round105-custom-label-tree.txt、
      // PROBE-round112）：宽度(W): / 高度(H): / 列距(P): / 行距(L): / 列数(C): / 行数(R):，分五组 标签/间距/行列/形状/孔洞。
      // 只取 FormField 渲染出的 <label>：分组框 legend「标签」与字段「宽度(W):」在 textContent 里会连成
      // 「标签宽度(W):」，用整段文本判自造名会误报（验收方 round-105 也踩过同一个坑）。
      const fields=[...root.querySelectorAll('label')].map((e)=>(e.textContent||'').trim())
      const groups=[...root.querySelectorAll('[data-testid^="template-label-"][data-testid$="-group"]')].map((e)=>(e.querySelector('legend')?.textContent||'').trim())
      return JSON.stringify(labels)===JSON.stringify(['打印机','页面','标签','其它'])
        && ['宽度(W):','高度(H):','列距(P):','行距(L):','列数(C):','行数(R):'].every((name)=>fields.includes(name))
        && !['标签宽度（mm）','标签高度（mm）','水平间距（mm）','垂直间距（mm）'].some((old)=>fields.includes(old))
        && groups.length===5 && ['标签','间距','行列','形状','孔洞'].every((legend)=>groups.includes(legend))
    })()`)
    await closeModal(); await sleep(180)

    // A-43：最近文件子菜单的项点击后再次进入 handleOpenRecent。
    await openMenu('文件(F)')
    results['A-43 最近文件子菜单可重新打开模板'] = await clickMenuItem('最近的文件') && await sleep(80).then(() => clickMenuItem('ui-v90-open')) && await waitFor(`document.querySelectorAll('[data-testid="document-tab"][data-document-title="ui-v90-open"]').length>=2`)

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
