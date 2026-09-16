/* A-60～A-68 菜单栏四个菜单的逐项点击行为（排列 / 窗口 / 账户 / 帮助）。
 * 依据：真机截图 `54-editor-menu-arrange.png`、`57-editor-menu-window.png`、
 *       `58-editor-menu-help.png`、`59-editor-menu-account.png`（见 parity/reference/labelshop/INDEX.md）
 *       与帮助 `menu_align.html`、`menu_windows.html`、`menu_help.html`。 */
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
    const waitFor = async (expression, timeout = 3000) => {
      const started = Date.now()
      while (Date.now() - started < timeout) {
        if (await evaluate(expression)) return true
        await sleep(80)
      }
      return false
    }
    const pressEscape = () => evaluate(`(() => { const e=new KeyboardEvent('keydown',{key:'Escape',bubbles:true,cancelable:true}); window.dispatchEvent(e); document.dispatchEvent(e); return true })()`)
    const pressKey = (k, o = {}) => evaluate(`(() => { const e=new KeyboardEvent('keydown',${JSON.stringify({ key: k, code: k, bubbles: true, cancelable: true, ...o })}); window.dispatchEvent(e); document.dispatchEvent(e); return true })()`)
    const dragCanvas = (x1, y1, x2, y2) => evaluate(`(() => {
      const c=document.querySelector('canvas.upper-canvas')||document.querySelector('canvas'); if(!c)return false
      const b=c.getBoundingClientRect()
      const p=(x,y,buttons=1)=>({bubbles:true,cancelable:true,view:window,clientX:b.left+x,clientY:b.top+y,button:0,buttons})
      c.dispatchEvent(new MouseEvent('mousedown',p(${x1},${y1})))
      c.dispatchEvent(new MouseEvent('mousemove',p(${x2},${y2})))
      c.dispatchEvent(new MouseEvent('mouseup',{...p(${x2},${y2},0),buttons:0})); return true
    })()`)
    /** 在画布上点一下：Fabric 的选中态只有画布点击会改（图层行点击只换 selectedId） */
    const clickCanvas = (x, y) => evaluate(`(() => {
      const c=document.querySelector('canvas.upper-canvas')||document.querySelector('canvas'); if(!c)return false
      const b=c.getBoundingClientRect()
      const p=(bt)=>({bubbles:true,cancelable:true,view:window,clientX:b.left+${x},clientY:b.top+${y},button:0,buttons:bt})
      c.dispatchEvent(new MouseEvent('mousedown',p(1)))
      c.dispatchEvent(new MouseEvent('mouseup',{...p(0),buttons:0})); return true
    })()`)

    const menuLabels = () => evaluate(`[...document.querySelectorAll('[data-menu-item]')].filter((e)=>e.offsetParent).map((e)=>e.getAttribute('data-menu-item'))`)
    const menuDisabled = (label) => evaluate(`(() => { const e=[...document.querySelectorAll('[data-menu-item]')].find((x)=>x.offsetParent&&x.getAttribute('data-menu-item')===${JSON.stringify(label)}); return e? e.getAttribute('data-menu-disabled')==='true' : null })()`)
    const menuShortcut = (label) => evaluate(`(() => { const e=[...document.querySelectorAll('[data-menu-item]')].find((x)=>x.offsetParent&&x.getAttribute('data-menu-item')===${JSON.stringify(label)}); return e? (e.getAttribute('data-menu-shortcut')||'') : null })()`)
    /** 展开某个顶级菜单（已展开则为空操作），返回其可见项（含已展开的子菜单，按 DOM 顺序） */
    const openMenu = async (title) => {
      await evaluate(`(() => { const b=document.querySelector('[data-menu-title=${JSON.stringify(title)}]'); if(!b) return false; if(!b.parentElement.querySelector('[data-menu-item],[data-menu-divider]')) b.click(); return true })()`)
      await sleep(180)
      return menuLabels()
    }
    const closeMenu = async (title) => {
      await evaluate(`(() => { const b=document.querySelector('[data-menu-title=${JSON.stringify(title)}]'); if(!b) return false; if(b.parentElement.querySelector('[data-menu-item],[data-menu-divider]')) b.click(); return true })()`)
      await sleep(150)
    }
    const openSub = async (parent) => { await click(`[data-menu-item=${JSON.stringify(parent)}]`); await sleep(180) }
    const clickItem = async (label) => { const ok = await click(`[data-menu-item=${JSON.stringify(label)}]`); await sleep(250); return ok }
    const rows = () => evaluate(`[...document.querySelectorAll('[data-testid=layer-object-row]')].map((e)=>({ type:e.getAttribute('data-object-type'), id:e.getAttribute('data-object-id'), sel:e.getAttribute('data-selected')==='true', x:Number(e.getAttribute('data-object-x')), y:Number(e.getAttribute('data-object-y')), rot:Number(e.getAttribute('data-object-rotation')), text:e.textContent }))`)
    const lockedCount = async () => (await rows()).filter((r) => r.text.indexOf('🔒') >= 0).length
    /** 编辑菜单「全选(A)」：与 Ctrl+A 同一回调，但菜单点击更稳定 */
    const selectAll = async () => {
      await openMenu('编辑(E)')
      await click(`[data-menu-item="全选(A)"]`)
      await sleep(320)
    }

    await sleep(1800)
    await evaluate('document.querySelector("button[aria-label=关闭]")?.click()')
    await pressKey('n', { ctrlKey: true }); await sleep(340)
    if (await evaluate('!!document.querySelector("[data-testid=template-wizard]")')) {
      await click('[data-testid="wizard-next"]'); await sleep(320)
    }
    await click('[data-testid="new-label-select"]')
    if (!await waitFor('!!document.querySelector("canvas.upper-canvas")', 8000)) throw new Error('editor did not open')

    // ============ A-60 排列菜单：空文档（无选中对象）时的禁用规则 ============
    const arrangeLabels = await openMenu('排列(A)')
    const arrangeWanted = ['组合(G)', '取消组合(U)', '对齐', '尺寸', '间距', '旋转', '位置锁定', '移到最前', '前移', '后移', '移到最后']
    results['A-60 排列菜单项与顺序同真机 54-editor-menu-arrange.png'] =
      JSON.stringify(arrangeLabels) === JSON.stringify(arrangeWanted)
    results['A-60 排列菜单快捷键同真机（组合 Ctrl+G / 取消组合 Ctrl+U / 位置锁定 Ctrl+L / 移到最后 Ctrl+B）'] =
      (await menuShortcut('组合(G)')) === 'Ctrl+G' && (await menuShortcut('取消组合(U)')) === 'Ctrl+U' &&
      (await menuShortcut('位置锁定')) === 'Ctrl+L' && (await menuShortcut('移到最后')) === 'Ctrl+B'
    const noneSel = {}
    for (const label of arrangeWanted) noneSel[label] = await menuDisabled(label)
    results['A-60 空文档未选中对象时排列菜单 12 项全部禁用（同真机 54 图）'] =
      Object.values(noneSel).every((v) => v === true)
    await closeMenu('排列(A)')

    // 两个对象：文字 + 矩形（对齐/层序需要两个对象）
    await click('[data-tool="text"]'); await dragCanvas(200, 130, 420, 210); await sleep(400)
    await click('[data-tool="rect"]'); await dragCanvas(260, 280, 420, 380); await sleep(400)
    const baseRows = await rows()
    if (baseRows.length !== 2) throw new Error('expected 2 objects, got ' + baseRows.length)

    // 画布当前选中的是最后创建的对象（矩形）；图层窗体检视顺序为「最前对象在最上」
    const rectX = async () => (await rows()).find((r) => r.type === 'rect').x
    const rectRot = async () => (await rows()).find((r) => r.type === 'rect').rot

    // A-60 位置锁定：点击后对象被锁定，再次点击取消（帮助「设置或取消被选取对象的锁定属性」）
    const lockedBefore = await lockedCount()
    await openMenu('排列(A)')
    await clickItem('位置锁定')
    const lockedOn = await lockedCount()
    await openMenu('排列(A)')
    await clickItem('位置锁定')
    const lockedOff = await lockedCount()
    results['A-60 排列→位置锁定 点击后选中对象加上锁定标记、再次点击取消'] =
      lockedBefore === 0 && lockedOn === 1 && lockedOff === 0

    // ================= A-61 排列→对齐 =================
    await openMenu('排列(A)')
    await openSub('对齐')
    const subAll = await menuLabels()
    const alignChildren = subAll.slice(subAll.indexOf('对齐') + 1, subAll.indexOf('尺寸'))
    const alignWanted = ['左对齐', '右对齐', '顶对齐', '底对齐', '垂直中齐', '水平中齐', '水平居中', '垂直居中', '标签顶部', '标签左侧', '标签右侧', '标签底部']
    results['A-61 排列→对齐 子菜单 12 项与帮助顺序一致'] = JSON.stringify(alignChildren) === JSON.stringify(alignWanted)

    // A-61 点击「标签左侧」把对象贴到标签左边界（x=0）
    await clickItem('标签左侧')
    results['A-61 点击「标签左侧」后选中对象 x 落到标签左边界 0'] = (await rectX()) === 0

    // ================= A-62 尺寸 / 间距 / 旋转 / 层次顺序 =================
    await openMenu('排列(A)')
    await openSub('尺寸')
    const sizeAll = await menuLabels()
    const sizeChildren = sizeAll.slice(sizeAll.indexOf('尺寸') + 1, sizeAll.indexOf('间距'))
    results['A-62 排列→尺寸 子菜单 3 项与帮助一致'] = JSON.stringify(sizeChildren) === JSON.stringify(['宽度相同', '高度相同', '宽度高度相同'])
    await closeMenu('排列(A)')

    await openMenu('排列(A)')
    await openSub('间距')
    const distAll = await menuLabels()
    const distChildren = distAll.slice(distAll.indexOf('间距') + 1, distAll.indexOf('旋转'))
    results['A-62 排列→间距 子菜单 2 项与帮助一致'] = JSON.stringify(distChildren) === JSON.stringify(['水平间距相同', '垂直间距相同'])
    await closeMenu('排列(A)')

    await openMenu('排列(A)')
    await openSub('旋转')
    const rotateAll = await menuLabels()
    const rotateChildren = rotateAll.slice(rotateAll.indexOf('旋转') + 1, rotateAll.indexOf('位置锁定'))
    results['A-62 排列→旋转 子菜单 3 项与帮助一致'] = JSON.stringify(rotateChildren) === JSON.stringify(['左旋90度', '旋转180度', '右旋90度'])

    // A-62 点击「左旋90度」后对象角度变为 90
    await clickItem('左旋90度')
    results['A-62 点击「左旋90度」后选中对象 rotation=90'] = (await rectRot()) === 90

    // A-62 层次顺序：图层窗体检视顺序为「最前对象在最上」
    const firstTypeBefore = (await rows())[0].type
    await openMenu('排列(A)')
    await clickItem('移到最后')
    const firstTypeBack = (await rows())[0].type
    await openMenu('排列(A)')
    await clickItem('移到最前')
    const firstTypeFront = (await rows())[0].type
    results['A-62 「移到最后」/「移到最前」改变对象层次顺序'] =
      firstTypeBack !== firstTypeBefore && firstTypeFront === firstTypeBefore

    // A-60 多选时的可用性：编辑菜单「全选(A)」后组合转为可用（取消组合仍需选中组合对象）
    await selectAll()
    await openMenu('排列(A)')
    const multiSel = {
      group: await menuDisabled('组合(G)'), ungroup: await menuDisabled('取消组合(U)'),
      align: await menuDisabled('对齐'), size: await menuDisabled('尺寸'), dist: await menuDisabled('间距'),
      rotate: await menuDisabled('旋转'), lock: await menuDisabled('位置锁定'), order: await menuDisabled('移到最前')
    }
    await closeMenu('排列(A)')
    results['A-60 全选两个对象后排列菜单转为可用（组合需 ≥2 对象故可用；取消组合需选中组合对象故仍禁用）'] =
      multiSel.group === false && multiSel.align === false && multiSel.size === false &&
      multiSel.dist === false && multiSel.rotate === false && multiSel.lock === false &&
      multiSel.order === false && multiSel.ungroup === true

    // ================= A-63 / A-64 / A-65 窗口菜单 =================
    const windowLabels = await openMenu('窗口(W)')
    results['A-63 窗口菜单含「新建窗口(N)」且按序号列出已打开文档并给当前项打勾（真机 57 图）'] =
      windowLabels[0] === '新建窗口(N)' && windowLabels.length >= 2 &&
      windowLabels.slice(1).every((l) => /^\d+ /.test(l)) &&
      await evaluate(`!![...document.querySelectorAll('[data-menu-item]')].find((x)=>x.offsetParent&&x.getAttribute('data-menu-checked')==='true')`)
    results['A-63 新建窗口在单窗口多标签复刻版中禁用（等价替代：原版为 MDI 子窗口）'] =
      (await menuDisabled('新建窗口(N)')) === true
    results['A-64/A-65 窗口菜单不含「层叠/平铺/排列图标」（同真机 57-editor-menu-window.png；帮助 menu_windows.html 对应段落已过时）'] =
      !windowLabels.includes('层叠(C)') && !windowLabels.includes('平铺(T)') && !windowLabels.includes('排列图标(A)')
    await closeMenu('窗口(W)')

    // ================= A-66 / A-67 账户菜单 =================
    const accountLabels = await openMenu('账户(A)')
    results['A-66 账户菜单含「登录...」「注销...」，未登录时登录可用、注销禁用（真机 59 图）'] =
      accountLabels[0] === '登录...' && accountLabels.includes('注销...') &&
      (await menuDisabled('登录...')) === false && (await menuDisabled('注销...')) === true
    results['A-67 账户菜单含「账号和授权管理...」「试用管理...」「演示和体验...」，未登录时前两项禁用、演示和体验可用'] =
      accountLabels.includes('账号和授权管理...') && accountLabels.includes('试用管理...') && accountLabels.includes('演示和体验...') &&
      (await menuDisabled('账号和授权管理...')) === true && (await menuDisabled('试用管理...')) === true &&
      (await menuDisabled('演示和体验...')) === false
    await clickItem('演示和体验...')
    const getStartedOpened = await waitFor('!!document.querySelector("[data-testid=get-started-dialog]")')
    results['A-67 点击「演示和体验...」打开新手入门对话框'] = getStartedOpened
    await pressEscape(); await sleep(320)
    await closeMenu('账户(A)')

    // ================= A-68 帮助菜单 =================
    const helpLabels = await openMenu('帮助(H)')
    const helpDividers = await evaluate(`[...document.querySelectorAll('[data-menu-divider]')].filter((e)=>e.offsetParent).length`)
    results['A-68 帮助菜单项与顺序同真机 58-editor-menu-help.png'] =
      JSON.stringify(helpLabels) === JSON.stringify(['帮助主题(H)', '在线网站(W)', '查找更新版本', '关于(A)...'])
    results['A-68 帮助菜单分组含两条分隔线（帮助主题 | 在线网站 + 查找更新版本 | 关于）'] = helpDividers === 2
    results['A-68 「帮助主题(H)」不显示 F1 快捷键文本（同真机截图，F1 键位仍有效）'] = (await menuShortcut('帮助主题(H)')) === ''
    await clickItem('帮助主题(H)')
    const helpOpened = await waitFor('!!document.querySelector("[data-testid=help-dialog]")')
    results['A-68 点击「帮助主题(H)」打开帮助主题对话框'] = helpOpened

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
