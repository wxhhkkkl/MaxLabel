/*
 * 需求清单「其它」8 条逐条对齐（round-115）。
 *
 * 判据来自原版真机取证（parity/reference/labelshop/INDEX.md）与原版自带帮助：
 *   - 270 文件操作 分享       真机文件菜单「分享(I)...」在未登录时为灰（INDEX 50/probe-19/20）；
 *                            帮助说明云模板保存/分享需要登录
 *   - 271 UNDO/REDO          帮助 shortcut_main.html「CTRL+Z 撤消上步操作」「CTRL+Y 重做撤消的操作」；
 *                            编辑菜单 `撤销(U) Ctrl+Z` / `恢复(R) Ctrl+Y`（INDEX 51 图）
 *   - 272 显示 标签旋转        查看菜单 →「标签旋转」子菜单：正常显示/左旋90度/右旋90度/旋转180度（INDEX 52 图）
 *   - 273 显示 放大显示        查看菜单「放大(I) Ctrl+=」；工具菜单也有「放大(I)」
 *   - 274 显示 缩小显示        查看菜单「缩小(O) Ctrl+-」
 *   - 275 显示 适合窗口        查看菜单「撑满窗口(W) Ctrl+Alt+0」；工具菜单「适合窗口(W)」
 *   - 280 关于 激活/更改设置   真机「关于」对话框（66-dlg-about.png）：
 *                            `签赋 LabelShop [ 标准版 - 未激活 ]  (6.39.2511) 32位` / `产品ID: 未激活` /
 *                            按钮「激活」/ 公司行 / 官网链接 / 两行版权敬告 / 「确定」；
 *                            账户菜单另有 `账号和授权管理...`（未登录时禁用）
 *   - 282 关于 表格功能        表格对象的行高列宽/边框/合并单元格/「不能直接排入文字、条码」提示
 *                            （帮助 label_object_page_table.html；ui-v102/ui-v76/ui-v116 已覆盖）
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
    await client.send('Runtime.enable')
    const evaluate = async (expression) => {
      const result = await client.send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true })
      if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description || result.exceptionDetails.text)
      return result.result?.value
    }
    const click = (selector) => evaluate(`(() => { const e=document.querySelector(${JSON.stringify(selector)}); if(!e || e.disabled)return false; e.click(); return true })()`)
    const waitFor = async (expression, timeout = 5000) => {
      const started = Date.now()
      while (Date.now() - started < timeout) {
        if (await evaluate(expression)) return true
        await sleep(80)
      }
      return false
    }
    const key = (name, options = {}) => evaluate(`(() => { const e=new KeyboardEvent('keydown',${JSON.stringify({ key: name, code: name, bubbles: true, cancelable: true, ...options })}); window.dispatchEvent(e); return true })()`)
    const text = (selector) => evaluate(`document.querySelector(${JSON.stringify(selector)})?.textContent || ''`)
    const visibleItems = () => evaluate(`([...document.querySelectorAll('[data-menu-item]')].filter((e)=>e.offsetParent).map((e)=>({ label:e.getAttribute('data-menu-item'), disabled:e.getAttribute('data-menu-disabled')==='true', shortcut:e.getAttribute('data-menu-shortcut')||'' })))`)
    const openMenu = async (title) => {
      await evaluate(`(() => { const b=document.querySelector('[data-menu-title=${JSON.stringify(title)}]'); if(!b)return false; if(!b.parentElement.querySelector('[data-menu-item],[data-menu-divider]')) b.click(); return true })()`)
      await sleep(200)
      return visibleItems()
    }
    const closeMenu = async (title) => {
      await evaluate(`(() => { const b=document.querySelector('[data-menu-title=${JSON.stringify(title)}]'); if(!b)return false; if(b.parentElement.querySelector('[data-menu-item],[data-menu-divider]')) b.click(); return true })()`)
      await sleep(160)
    }
    const clickItem = async (label) => { const ok = await click(`[data-menu-item=${JSON.stringify(label)}]`); await sleep(280); return ok }
    const zoomMode = () => evaluate(`document.querySelector('[data-testid="zoom-control"]')?.getAttribute('data-zoom-mode')`)
    const zoomValue = () => evaluate(`Number(document.querySelector('[data-testid="zoom-level"]')?.value || 0)`)

    await sleep(1600)
    await evaluate('document.querySelector("button[aria-label=关闭]")?.click()')
    await key('n', { ctrlKey: true }); await sleep(420)
    if (await evaluate('!!document.querySelector("[data-testid=template-wizard]")')) {
      await click('[data-testid="wizard-next"]'); await sleep(380)
    }
    await click('[data-testid="new-label-select"]')
    await waitFor('!!document.querySelector("canvas.upper-canvas")', 9000)
    await sleep(400)

    // ---------- 270 文件操作 分享 ----------
    const fileItems = await openMenu('文件(F)')
    const share = fileItems.find((item) => item.label.startsWith('分享'))
    await closeMenu('文件(F)')
    results['270 文件菜单含「分享(I)...」，未登录时与真机一致为禁用'] =
      Boolean(share) && share.disabled === true
    // 菜单项在菜单关闭时不在 DOM 里，故用「打开文件菜单时读到的顺序」核对：
    // 真机顺序 新建/新建条幅飘带/打开/关闭/保存/另存为/分享/…（INDEX 50 图 + PROBE-round108）
    const shareIndex = fileItems.findIndex((item) => item.label.startsWith('分享'))
    results['270 「分享」在文件菜单里的位置与真机一致（紧随「另存为」之后）'] =
      shareIndex > 0 && fileItems[shareIndex - 1].label.startsWith('另存为')

    // ---------- 271 UNDO / REDO ----------
    const editItems = await openMenu('编辑(E)')
    const undoItem = editItems.find((item) => item.label.startsWith('撤销'))
    const redoItem = editItems.find((item) => item.label.startsWith('恢复'))
    await closeMenu('编辑(E)')
    // 造一个可撤销的动作：拖出一个矩形
    await click('[data-tool="rect"]'); await sleep(160)
    await evaluate(`(() => { const c=document.querySelector('canvas.upper-canvas'); const b=c.getBoundingClientRect(); const p=(x,y,buttons=1)=>({bubbles:true,cancelable:true,view:window,clientX:b.left+x,clientY:b.top+y,button:0,buttons}); c.dispatchEvent(new MouseEvent('mousedown',p(120,120))); c.dispatchEvent(new MouseEvent('mousemove',p(220,200))); c.dispatchEvent(new MouseEvent('mouseup',{...p(220,200,0),buttons:0})); return true })()`)
    await sleep(450)
    const afterCreate = await evaluate(`document.querySelectorAll('[data-testid=layer-object-row]').length`)
    await key('z', { ctrlKey: true }); await sleep(360)
    const afterUndo = await evaluate(`document.querySelectorAll('[data-testid=layer-object-row]').length`)
    await key('y', { ctrlKey: true }); await sleep(360)
    const afterRedo = await evaluate(`document.querySelectorAll('[data-testid=layer-object-row]').length`)
    results['271 UNDO/REDO：Ctrl+Z 撤消上一步、Ctrl+Y 重做（帮助 shortcut_main.html）'] =
      Boolean(undoItem) && undoItem.shortcut === 'Ctrl+Z' && Boolean(redoItem) && redoItem.shortcut === 'Ctrl+Y' &&
      afterCreate === 1 && afterUndo === 0 && afterRedo === 1

    // ---------- 272 标签旋转 ----------
    const escape = async () => { await evaluate(`window.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true,cancelable:true}))`); await sleep(180) }
    await escape()
    await openMenu('查看(V)')
    const viewItems = await visibleItems()
    const hasRotationSubmenu = viewItems.some((item) => item.label === '标签旋转')
    await clickItem('标签旋转'); await sleep(220)
    const labelRotation = (await visibleItems())
      .filter((item) => ['正常显示', '左旋90度', '右旋90度', '旋转180度'].includes(item.label))
      .map((item) => item.label)
    const rotated = await clickItem('左旋90度') && (await waitFor(`(() => { const el=document.querySelector('[data-testid=label-board-rotator]'); if(!el)return false; const m=new DOMMatrixReadOnly(getComputedStyle(el).transform); return m.b < -0.5 })()`, 3000))
    await escape()
    await openMenu('查看(V)')
    await clickItem('标签旋转'); await sleep(220)
    const restored = await clickItem('正常显示') && (await waitFor(`(() => { const el=document.querySelector('[data-testid=label-board-rotator]'); if(!el)return false; const m=new DOMMatrixReadOnly(getComputedStyle(el).transform); return Math.abs(m.b) < 0.05 })()`, 3000))
    results['272 查看菜单标签旋转四项齐全且左旋 90 度真的把板面逆时针转过去'] =
      hasRotationSubmenu && JSON.stringify(labelRotation) === JSON.stringify(['正常显示', '左旋90度', '右旋90度', '旋转180度']) && rotated && restored

    // ---------- 273/274/275 放大 / 缩小 / 适合窗口 ----------
    await escape()
    await openMenu('查看(V)')
    const zoomItems = (await visibleItems()).map((item) => item.label)
    const zoomBefore = await zoomValue()
    const zoomInOk = await clickItem('放大(I)') && (await waitFor(`Number(document.querySelector('[data-testid="zoom-level"]')?.value||0) > ${zoomBefore}`, 3000))
    const afterZoomIn = await zoomValue()
    await escape()
    await openMenu('查看(V)')
    const zoomOutOk = await clickItem('缩小(O)') && (await waitFor(`Number(document.querySelector('[data-testid="zoom-level"]')?.value||0) < ${afterZoomIn}`, 3000))
    await escape()
    await openMenu('查看(V)')
    const fitOk = await clickItem('撑满窗口(W)') && (await waitFor(`document.querySelector('[data-testid="zoom-control"]')?.getAttribute('data-zoom-mode') === 'win'`, 3000))
    results['273/274 查看菜单「放大(I)」/「缩小(O)」改变显示比例（帮助 menu_view.html）'] =
      zoomItems.includes('放大(I)') && zoomItems.includes('缩小(O)') && zoomInOk && zoomOutOk
    results['275 查看菜单「撑满窗口(W)」进入窗口适应模式（Ctrl+Alt+0）'] = fitOk && (await zoomMode()) === 'win'

    // ---------- 280 关于 激活 / 更改设置 ----------
    const accountItems = await openMenu('账户(A)')
    const accountLabels = accountItems.map((item) => item.label)
    const accountAuthDisabled = accountItems.find((item) => item.label.startsWith('账号和授权管理'))?.disabled
    await closeMenu('账户(A)')
    await openMenu('帮助(H)')
    const aboutClicked = await clickItem('关于(A)...')
    await waitFor('!!document.querySelector("[data-testid=about-dialog]")', 4000)
    const aboutText = await text('[data-testid="about-dialog"]')
    const versionLine = await text('[data-testid="about-version-line"]')
    const productId = await text('[data-testid="about-product-id"]')
    const hasQr = await evaluate(`!!document.querySelector('[data-testid="about-qr"]')`)
    const activateOpened = await click('[data-testid="about-activate"]') && (await waitFor('!!document.querySelector("[data-testid=license-dialog]")', 4000) || await waitFor(`document.body.innerText.includes('授权与激活')`, 4000))
    await evaluate(`document.querySelector('[aria-label="关闭"]')?.click()`)
    await sleep(260)
    results['280 账户菜单含「账号和授权管理...」（未登录禁用）与「试用管理...」'] =
      accountLabels.includes('账号和授权管理...') && accountLabels.includes('试用管理...') && accountAuthDisabled === true
    results['280 关于对话框结构同真机 66 图：版本行含当前版本、产品ID、激活按钮、官网链接、版权敬告、确定'] =
      aboutClicked && /MaxLabel \[ 标准版 - (未激活|已激活) \]/.test(versionLine) && /\(\d+\.\d+\.\d+\)/.test(versionLine) &&
      productId.includes('产品ID') && aboutText.includes('激活') && hasQr &&
      aboutText.includes('github.com') && aboutText.includes('敬告') && aboutText.includes('确定')
    results['280 关于对话框的「激活」按钮进入「授权与激活」对话框'] = activateOpened === true

    // ---------- 282 表格功能 ----------
    await click('[data-tool="table"]'); await sleep(180)
    await evaluate(`(() => { const c=document.querySelector('canvas.upper-canvas'); const b=c.getBoundingClientRect(); const p=(x,y,buttons=1)=>({bubbles:true,cancelable:true,view:window,clientX:b.left+x,clientY:b.top+y,button:0,buttons}); c.dispatchEvent(new MouseEvent('mousedown',p(60,240))); c.dispatchEvent(new MouseEvent('mousemove',p(240,360))); c.dispatchEvent(new MouseEvent('mouseup',{...p(240,360,0),buttons:0})); return true })()`)
    await sleep(500)
    await click('[data-tool="select"]'); await sleep(200)
    await evaluate(`(() => { const r=[...document.querySelectorAll('[data-testid=layer-object-row]')].find((e)=>e.dataset.objectType==='table'); if(r && r.dataset.selected!=='true') r.click(); return !!r })()`)
    await sleep(300)
    await evaluate(`window.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',code:'Enter',altKey:true,bubbles:true,cancelable:true}))`)
    await waitFor('!!document.querySelector("[data-testid=object-props-dialog]")', 5000)
    await click('[data-testid="object-props-tab-table"]'); await sleep(300)
    const tableDlg = await text('[data-testid="object-props-dialog"]')
    const rowHeights = await evaluate(`document.querySelectorAll('[data-testid^="table-row-height-"]').length`)
    const colWidths = await evaluate(`document.querySelectorAll('[data-testid^="table-col-width-"]').length`)
    const mergeEntry = await evaluate(`!!document.querySelector('[data-testid="table-merge-apply"]')`)
    results['282 表格对象功能：行高/列宽/边框/合并单元格/不可直排提示齐全（帮助 label_object_page_table.html）'] =
      tableDlg.includes('行高') && tableDlg.includes('列宽') && tableDlg.includes('边框宽度') &&
      tableDlg.includes('合并单元格') && tableDlg.includes('不能直接排入') &&
      rowHeights > 0 && colWidths > 0 && mergeEntry === true
    await evaluate(`document.querySelector('[data-testid=object-props-dialog] button[aria-label]')?.click()`)
    await sleep(260)

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
