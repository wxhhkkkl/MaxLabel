/*
 * 复刻版（MaxLabel）界面截图工装 —— P4「四件套」里「复刻图」那一件的采集器。
 *
 * 与 app/scripts/ui-v*.cjs 的关系：那些是**断言**脚本（属于循环的回归清单），本文件只负责**出图**，
 * 放在 tools/parity 下，不进回归清单、不占 test:ui 独占锁（自己起实例、自己收摊）。
 *
 * 用法：
 *   node tools/parity/Capture-CloneShot.cjs --port 9333 --scene choose --out parity/reference/maxlabel/clone-choose-label-r111.png
 *   scene: choose（选择标签格式）| custom（标签格式设置）| editor（编辑器）
 *
 * 前置：调用方需先起一个带 --remote-debugging-port 的实例（见 tools/parity/steps 或 loop 的启动方式），
 *      跑完自行清理；本脚本只连 CDP、点界面、截图。
 */
const http = require('http')
const path = require('path')
const fs = require('fs')
const WebSocket = require(path.join(__dirname, '..', '..', 'app', 'node_modules', 'ws'))

function getJson(url) {
  return new Promise((resolve, reject) => {
    http.get(url, (res) => { let d = ''; res.on('data', (c) => { d += c }); res.on('end', () => { try { resolve(JSON.parse(d)) } catch (e) { reject(e) } }) }).on('error', reject)
  })
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
function attach(wsUrl) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(wsUrl)
    let id = 0
    const pending = new Map()
    ws.on('message', (raw) => {
      const m = JSON.parse(raw.toString())
      const it = pending.get(m.id)
      if (!it) return
      pending.delete(m.id)
      if (m.error) it.reject(new Error(m.error.message))
      else it.resolve(m.result)
    })
    ws.on('open', () => resolve({
      ws,
      send: (method, params = {}) => new Promise((res, rej) => { const i = ++id; pending.set(i, { resolve: res, reject: rej }); ws.send(JSON.stringify({ id: i, method, params })) })
    }))
    ws.on('error', reject)
  })
}
function argOf(name, def) {
  const i = process.argv.indexOf('--' + name)
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : def
}

;(async () => {
  const port = Number(argOf('port', process.env.MAXLABEL_DEBUG_PORT || 9222))
  const scene = argOf('scene', 'choose')
  const out = argOf('out', path.join(__dirname, '..', '..', 'parity', 'reference', 'maxlabel', `clone-${scene}.png`))
  const pages = await getJson(`http://127.0.0.1:${port}/json/list`)
  const page = pages.find((p) => p.type === 'page')
  if (!page) throw new Error('没有找到页面（实例没起或端口不对）')
  const c = await attach(page.webSocketDebuggerUrl)
  const ev = async (e) => {
    const r = await c.send('Runtime.evaluate', { expression: e, awaitPromise: true, returnByValue: true })
    if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || r.exceptionDetails.text)
    return r.result?.value
  }
  const waitFor = async (expr, timeout = 8000) => { const t0 = Date.now(); while (Date.now() - t0 < timeout) { if (await ev(expr)) return true; await sleep(90) } return false }

  await sleep(1200)
  await ev('document.querySelector("button[aria-label=关闭]")?.click()')
  if (scene === 'start') {
    // 起始页不建文档，直接截；登录场景必须先进入编辑器，因为复刻版 CloudDialog
    // 与真机登录窗口一样依赖当前文档上下文。
    await sleep(600)
  } else {
  // 冷启动 → 模板向导 → 新建
  await ev('document.dispatchEvent(new KeyboardEvent("keydown",{key:"n",code:"KeyN",ctrlKey:true,bubbles:true,cancelable:true}))')
  await sleep(500)
  if (await ev('!!document.querySelector("[data-testid=template-wizard]")')) {
    await ev('document.querySelector("[data-testid=wizard-next]")?.click()')
    await sleep(400)
  }
  if (!(await waitFor('!!document.querySelector("[data-testid=new-label-dialog]")'))) throw new Error('选择标签格式对话框没打开')
  if (scene === 'custom') {
    await ev('document.querySelector("[data-testid=new-label-custom]")?.click()')
    if (!(await waitFor('!!document.querySelector("[data-testid=custom-label-dialog]")'))) throw new Error('标签格式设置对话框没打开')
    await sleep(500)
  }
  if (scene === 'install') {
    // 安装打印机（真机对照图：probe-07-install-printer.png）——入口在「选择标签格式」对话框的「安装」按钮。
    // 注意：本场景**不要**进编辑器，真机那张是"尚未建文档"的独立对话框。
    await ev('document.querySelector("[data-testid=new-label-install]")?.click()')
    if (!(await waitFor('!!document.querySelector(\'[data-testid="printer-install-dialog"]\')', 6000))) throw new Error('安装打印机对话框没打开')
    await sleep(600)
  }
  if (scene === 'editor' || scene === 'menu' || scene.startsWith('menu-') || scene === 'login' || scene === 'toolbar' || scene === 'print') {
    // menu 场景也要**先进编辑器**再展开菜单 —— 否则拍到的是"无文档态"的菜单（保存/另存为/打印…都会是禁用或缺失），
    // 与真机那张"有文档态"的菜单不可比（round-121 踩过：并排图两边状态不同，菜单项数量对不上）。
    await ev('document.querySelector("[data-testid=new-label-select]")?.click()')
    if (!(await waitFor('!!document.querySelector("canvas.upper-canvas")'))) throw new Error('没进编辑器')
    await sleep(800)
  }
  if (scene === 'props' || scene === 'propsbarcode') {
    // 对象属性对话框：建一个条码对象（工具只是"选中"，画布落点才建对象），再双击它打开属性页
    // propsbarcode = 额外切到「条码」页（真机对照图 verifier-20c-barcode-page.png 拍的是条码页）——
    // round-124 发现 `props` 场景停在**常规**页，拿它当「条码页」的并排证据是错的。
    await ev('document.querySelector("[data-testid=new-label-select]")?.click()')
    if (!(await waitFor('!!document.querySelector("canvas.upper-canvas")'))) throw new Error('没进编辑器')
    await sleep(600)
    await ev(`(() => { const b=document.querySelector('[data-tool="barcode"]'); if(b && !b.disabled) b.click() })()`)
    await sleep(250)
    const rect = await ev(`(() => { const el=document.querySelector('canvas.upper-canvas'); const r=el.getBoundingClientRect(); return { left:r.left, top:r.top, width:r.width, height:r.height } })()`)
    const px = rect.left + rect.width * 0.35
    const py = rect.top + rect.height * 0.35
    const send = (type, n, buttons) => c.send('Input.dispatchMouseEvent', { type, x: Math.round(px), y: Math.round(py), button: 'left', buttons, clickCount: n })
    await send('mousePressed', 1, 1); await send('mouseReleased', 1, 0)
    await sleep(600)
    let opened = false
    for (const [dx, dy] of [[12, 10], [24, 12], [40, 16], [8, 6]]) {
      const x = Math.round(px + dx), y = Math.round(py + dy)
      const ev2 = (type, n, buttons) => c.send('Input.dispatchMouseEvent', { type, x, y, button: 'left', buttons, clickCount: n })
      await ev2('mousePressed', 1, 1); await ev2('mouseReleased', 1, 0); await sleep(50)
      await ev2('mousePressed', 2, 1); await ev2('mouseReleased', 2, 0)
      if (await waitFor('!!document.querySelector(\'[data-testid="object-props-dialog"]\')', 2500)) { opened = true; break }
    }
    if (!opened) throw new Error('双击对象没打开属性对话框')
    await sleep(600)
    if (scene === 'propsbarcode') {
      const tab = await ev(`(() => { const t=document.querySelector('[data-testid="object-props-tab-barcode"]'); if(!t) return false; t.click(); return true })()`)
      if (!tab) throw new Error('属性对话框里找不到「条码」页签')
      await sleep(600)
    }
  }
  if (scene === 'menu' || scene.startsWith('menu-')) {
    // 菜单展开态。scene='menu' → 文件(F)（真机对照图 verifier-r43-file-menu.png）；
    // scene='menu-<suffix>' → 指定菜单（round-150 新增，用于覆盖 编辑/查看/工具/排列/数据库/账户/云马通/选项/窗口/帮助 一族）。
    const MENUS = {
      file: '文件(F)', edit: '编辑(E)', view: '查看(V)', tool: '工具(T)', arrange: '排列(A)',
      database: '数据库(D)', account: '账户(A)', cloud: '云马通(C)', options: '选项(O)',
      window: '窗口(W)', help: '帮助(H)',
    }
    const suffix = scene === 'menu' ? 'file' : scene.slice('menu-'.length)
    const title = MENUS[suffix]
    if (!title) throw new Error('未知菜单后缀：' + suffix)
    const clicked = await ev(`(() => { const b=document.querySelector('[data-menu-title="${title}"]'); if(!b) return false; b.click(); return true })()`)
    if (!clicked) throw new Error(`菜单标题未找到：${title}`)
    await sleep(450)
  }
  if (scene === 'datasource' || scene === 'propsfont' || scene === 'propsgeneral') {
    // 对象属性 → 「数据源」页（真机对照图：parity/reference/labelshop/r88-textprops-p1.png，round-88 实拍）
    // 复用 props 场景的建对象+双击链路，然后点「数据源」页签。
    await ev('document.querySelector("[data-testid=new-label-select]")?.click()')
    if (!(await waitFor('!!document.querySelector("canvas.upper-canvas")'))) throw new Error('没进编辑器')
    await sleep(600)
    // round-183 修正：真机对照图（r88-textprops-p1/p2/p4）都是「**文字**属性」✓，
    //   而这里原来一律建**条码**对象 ✗ → 抓到的属性页与真机**不是同一对象类型** ✗，字体页在条码对象下本来就是空的 ✓，
    //   所以那个"空白字体页"是**状态差异**、不是缺陷 ✗。→ 数据源/字体/常规三页改用**文字工具** ✓。
    const useText = (scene === 'datasource' || scene === 'propsfont' || scene === 'propsgeneral')
    await ev(`(() => { const b=document.querySelector('[data-tool="${useText ? 'text' : 'barcode'}"]'); if(b && !b.disabled) b.click() })()`)
    await sleep(300)
    // 在画布上落点 → 再双击打开「对象属性」
    const drect = await ev(`(() => { const el=document.querySelector('canvas.upper-canvas'); const r=el.getBoundingClientRect(); return { left:r.left, top:r.top, width:r.width, height:r.height } })()`)
    const dpx = drect.left + drect.width * 0.35
    const dpy = drect.top + drect.height * 0.35
    const dm = (type, n, buttons) => c.send('Input.dispatchMouseEvent', { type, x: Math.round(dpx), y: Math.round(dpy), button: 'left', buttons, clickCount: n })
    await dm('mousePressed', 1, 1); await dm('mouseReleased', 1, 0)
    await sleep(500)
    let dopened = false
    for (const [dx, dy] of [[12, 10], [24, 12], [40, 16]]) {
      const x = Math.round(dpx + dx), y = Math.round(dpy + dy)
      const dm2 = (type, n, buttons) => c.send('Input.dispatchMouseEvent', { type, x, y, button: 'left', buttons, clickCount: n })
      await dm2('mousePressed', 1, 1); await dm2('mouseReleased', 1, 0); await sleep(50)
      await dm2('mousePressed', 2, 1); await dm2('mouseReleased', 2, 0)
      if (await waitFor('!!document.querySelector(\'[data-testid="object-props-dialog"]\')', 2500)) { dopened = true; break }
    }
    if (!dopened) throw new Error('双击对象没打开属性对话框')
    await sleep(400)
    // 按场景切到目标页签（round-151 参数化：数据源页 / 字体页 / 常规页）
    const TAB_NAME = { datasource: '数据源', propsfont: '字体', propsgeneral: '常规' }[scene]
    const tabClicked = await ev(`(() => { const b=[...document.querySelectorAll('[data-testid^="object-props-tab-"]')].find((x)=>(x.textContent||'').trim()==='${TAB_NAME}'); if(!b) return false; b.click(); return true })()`)
    if (!tabClicked) throw new Error('属性页签未找到：' + TAB_NAME)
    await sleep(500)
  }
  if (scene === 'printdialog') {
    // 打印对话框（真机对照图：parity/reference/labelshop/probe-63-30-print-dialog.png）
    // round-159 踩坑：右侧面板的「打印」按钮走的是 `handlePrintNow` —— **直接开印**（按钮变「取消当前操作」，没有对话框 ✗）。
    // 打印对话框是「文件(F) → 打印(P)...」那条链（`handlePrint(false)` → `openPrintDialog()`）✓。
    await ev('document.querySelector("[data-testid=new-label-select]")?.click()')
    if (!(await waitFor('!!document.querySelector("canvas.upper-canvas")'))) throw new Error('没进编辑器')
    await sleep(700)
    await ev(`document.querySelector('[data-menu-title="文件(F)"]')?.click()`)
    await sleep(350)
    await ev(`(() => { const it=[...document.querySelectorAll('[data-menu-item]')].find((e)=>e.offsetParent && (e.textContent||'').trim().startsWith('打印')); if(it) it.click() })()`)
    if (!(await waitFor('!!document.querySelector(\'[data-testid="print-dialog"]\')', 6000))) {
      const diag = await ev(`JSON.stringify({
        hasCanvas: !!document.querySelector('canvas.upper-canvas'),
        dialogs: document.querySelectorAll('[role=dialog]').length,
        modalRoots: [...document.querySelectorAll('[data-testid$="-dialog"],[data-testid$="-overlay"]')].map(e=>e.getAttribute('data-testid')),
        text: (document.body.innerText||'').replace(/\\s+/g,' ').slice(-160)
      })`)
      throw new Error('打印对话框没打开；诊断=' + diag)
    }
    await sleep(600)
  }
  if (scene === 'about') {
    // 帮助(H) → 关于（真机对照图：parity/reference/labelshop/66-dlg-about.png）
    await ev('document.querySelector("[data-testid=new-label-select]")?.click()')
    if (!(await waitFor('!!document.querySelector("canvas.upper-canvas")'))) throw new Error('没进编辑器')
    await sleep(700)
    await ev(`document.querySelector('[data-menu-title="帮助(H)"]')?.click()`)
    await sleep(300)
    await ev(`(() => { const it=[...document.querySelectorAll('[data-menu-item]')].find((e)=>e.offsetParent && (e.textContent||'').includes('关于')); if(it) it.click() })()`)
    if (!(await waitFor('!!document.querySelector(\'[data-testid="about-ok"]\')', 6000))) throw new Error('关于对话框没打开')
    await sleep(500)
  }
  if (scene === 'templateprops') {
    // 文件(F) → 模板属性设置(M)... → TemplatePropsDialog（testid: template-props-tabs / template-props-apply）
    // round-133 两个坑：① 菜单项 `disabled: deps.isStart` —— 在启始页时**点了没反应**，必须先建文档；
    //                  ② 对话框的 testid 不是 "template-props-dialog"，得等 `template-props-tabs`。
    await ev('document.querySelector("[data-testid=new-label-select]")?.click()')
    if (!(await waitFor('!!document.querySelector("canvas.upper-canvas")'))) throw new Error('没进编辑器')
    await sleep(700)
    await ev(`document.querySelector('[data-menu-title="文件(F)"]')?.click()`)
    await sleep(300)
    await ev(`(() => { const it=[...document.querySelectorAll('[data-menu-item]')].find((e)=>e.offsetParent && (e.textContent||'').includes('模板属性设置')); if(it) it.click() })()`)
    if (!(await waitFor('!!document.querySelector(\'[data-testid="template-props-tabs"]\')', 6000))) throw new Error('模板属性设置对话框没打开')
    await sleep(500)
  }
  if (scene === 'printerport' || scene === 'printerportbox') {
    // 打印机属性 → 端口页（真机对照图：probe-15-cloudbox-port.png）。
    // 走右侧打印面板的「设置」按钮（testid print-printer-settings），它直接开 PrinterSettings（四页签：首选项/端口/自定义命令/工具）。
    // printerportbox 额外把「类型」切到 cloudbox —— 真机那张对照图选的正是「蜂打打云盒」，
    // 只有同态才比得出字段集（round-135 的候选差异 b 就要求同态复核）。
    await ev('document.querySelector("[data-testid=new-label-select]")?.click()')
    if (!(await waitFor('!!document.querySelector("canvas.upper-canvas")'))) throw new Error('没进编辑器')
    await sleep(700)
    await ev('document.querySelector(\'[data-testid="print-printer-settings"]\')?.click()')
    if (!(await waitFor('!!document.querySelector(\'[data-testid="printer-settings-port-tab"]\')', 6000))) throw new Error('打印机设置对话框没打开')
    await ev('document.querySelector(\'[data-testid="printer-settings-port-tab"]\')?.click()')
    if (!(await waitFor('!!document.querySelector(\'[data-testid="printer-settings-port"]\')', 4000))) throw new Error('端口页没出现')
    if (scene === 'printerportbox') {
      const ok = await ev(`(() => { const s=document.querySelector('[data-testid="printer-port-type"]'); if(!s) return false;
        const o=[...s.options].find((x)=>x.value==='cloudbox' || (x.textContent||'').includes('蜂打打云盒'));
        if(!o) return false; s.value=o.value; s.dispatchEvent(new Event('change',{bubbles:true})); return true })()`)
      if (!ok) throw new Error('端口类型里找不到「蜂打打云盒」选项')
      await sleep(600)
    }
    await sleep(500)
  }
  if (scene === 'login') {
    // 账户(A) → 登录... → CloudDialog（真机对照图：round119-print-dialog.png = 真机「登录 LabelShop」对话框）
    const accountMenuOpened = await ev(`(() => { const b=[...document.querySelectorAll('[data-menu-title]')].find((e)=>(e.textContent||'').trim().startsWith('账户')); if(!b) return false; b.click(); return true })()`)
    if (!accountMenuOpened) throw new Error('账户菜单未找到')
    await sleep(300)
    const loginItemClicked = await ev(`(() => { const it=[...document.querySelectorAll('[data-menu-item]')].find((e)=>e.offsetParent && (e.textContent||'').includes('登录')); if(!it) return false; it.click(); return true })()`)
    if (!loginItemClicked) throw new Error('账户菜单中未找到登录项')
    if (!(await waitFor('/邮箱|云端模板/.test(document.body.innerText)', 6000))) {
      // round-157 自诊断：把"当时有没有文档 / 有没有对话框 / 正文开头"打出来，省得下次再猜 ✗
      const diag = await ev(`JSON.stringify({
        hasCanvas: !!document.querySelector('canvas.upper-canvas'),
        dialogs: document.querySelectorAll('[role=dialog]').length,
        text: (document.body.innerText||'').replace(/\\s+/g,' ').slice(0,120)
      })`)
      throw new Error('登录对话框没打开；诊断=' + diag)
    }
    await sleep(600)
  }
  if (scene === 'preview') {
    // 打印预览（文件 → 打印预览(V)）—— 这条链同时是"渲染 → 打印"的**端到端可视证据** ✓
    // 真机对照图：parity/reference/labelshop/verifier-r47-print-preview.png（round-47 实拍）
    // ⚠️ 同态提醒：真机那张是 round-47 的"孔洞模板"状态 ✗，与本场景的默认模板**不是同一状态** ✗
    //    → 引用前要么把真机拍成同状态，要么在证据文本里写明"状态不同、只比预览窗体结构" ✓。
    await ev('document.querySelector("[data-testid=new-label-select]")?.click()')
    if (!(await waitFor('!!document.querySelector("canvas.upper-canvas")'))) throw new Error('没进编辑器')
    await sleep(700)
    await ev(`document.querySelector('[data-menu-title="文件(F)"]')?.click()`)
    await sleep(350)
    await ev(`(() => { const it=[...document.querySelectorAll('[data-menu-item]')].find((e)=>e.offsetParent && (e.textContent||'').trim().startsWith('打印预览')); if(it) it.click() })()`)
    await sleep(1500)
  }
  if (scene === 'optionsmenu') {
    // 选项(O) 菜单展开态（真机对照图：parity/reference/labelshop/r100-options-menu.png = 真机「选项」菜单两项）
    await ev('document.querySelector("[data-testid=new-label-select]")?.click()')
    if (!(await waitFor('!!document.querySelector("canvas.upper-canvas")'))) throw new Error('没进编辑器')
    await sleep(600)
    await ev(`document.querySelector('[data-menu-title="选项(O)"]')?.click()`)
    await sleep(500)
  }
  if (scene === 'toolbar') {
    // 主工具栏最右端 » → 添加或删除按钮(A) ▸（真机对照图：91-toolbar-customize-submenu.png）。
    // 真机那张是在**启始页**拍的（原版启始页也带工具栏）；复刻版工具栏只在编辑器内渲染 →
    // 两侧都是"工具栏可见"态，子菜单内容可比；这一状态差异已在矩阵证据列写明。
    // 同一个实例里连续跑多个场景时，上一个场景（如 menu）可能把菜单栏留着展开 —— 先关掉再截，避免污染。
    await ev('document.dispatchEvent(new KeyboardEvent("keydown",{key:"Escape",code:"Escape",bubbles:true,cancelable:true}))')
    await sleep(300)
    await ev('document.querySelector(\'[data-testid="toolbar-customize"]\')?.click()')
    if (!(await waitFor('!!document.querySelector(\'[data-testid="toolbar-customize-menu"]\')', 3000))) throw new Error('「添加或删除按钮」一级菜单没打开')
    await ev('document.querySelector(\'[data-testid="toolbar-customize-root"]\')?.click()')
    if (!(await waitFor('!!document.querySelector(\'[data-testid="toolbar-customize-submenu"]\')', 3000))) throw new Error('二级子菜单没打开')
    await sleep(500)
  }
  if (scene === 'print') {
    // 打印对话框（真机对照图：63-dlg-print.png）。Ctrl+P 与真机同（打印面板的「打印」按钮也会开同一个对话框）。
    await ev('window.dispatchEvent(new KeyboardEvent("keydown",{key:"p",code:"KeyP",ctrlKey:true,bubbles:true,cancelable:true}))')
    if (!(await waitFor('!!document.querySelector(\'[data-testid="print-dialog"]\')', 6000))) throw new Error('打印对话框没打开')
    await sleep(600)
  }
  if (scene === 'sysset') {
    // 选项(O) → 系统选项(C)…（真机对照图：probe-r112-sysset*.png 四页）
    await ev(`document.querySelector('[data-menu-title="选项(O)"]')?.click()`)
    await sleep(250)
    await ev(`(() => { const it=[...document.querySelectorAll('[data-menu-item]')].find((e)=>e.offsetParent && (e.textContent||'').includes('系统选项')); if(it) it.click() })()`)
    if (!(await waitFor('!!document.querySelector(\'[data-testid="options-dialog"]\')', 6000))) throw new Error('系统设置对话框没打开')
    await sleep(500)
  }
  } // ← 关闭 "非 start 场景" 分支
  const shot = await c.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false })
  fs.mkdirSync(path.dirname(out), { recursive: true })
  fs.writeFileSync(out, Buffer.from(shot.data, 'base64'))
  console.log('[capture] scene=' + scene + ' → ' + out + ' (' + fs.statSync(out).size + ' bytes)')
  c.ws.close()
})().catch((e) => { console.error('ERR', e.message); process.exit(1) })
