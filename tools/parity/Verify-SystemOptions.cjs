/*
 * 「系统设置」（菜单项叫「系统选项(C)...」）验收工装 —— DIFF-71 的目标状态检查。
 *
 * 真机取证：parity/reference/labelshop/PROBE-round112-sysset.md（四页全部拍全）
 *   页签（左→右）= 常规 / 打印和数据库 / 编辑 / 系统
 *   常规页四个分组框 = 语言 / 单位 / 非打印对象 / 其它
 *   底排按钮 = 确定 / 取消 / 帮助（真机的 `应用(&A)` 是**隐藏**控件）
 * 本工装按"真机目标"断言，所以在 DIFF-71 完成前**预期会红**（红的条数就是还差多少）。
 *
 * 用法：node tools/parity/Verify-SystemOptions.cjs [--port 9333]
 * 前置：调用方自己起一个带 --remote-debugging-port 的实例（不占 test:ui 锁）。
 */
const http = require('http')
const path = require('path')
const WebSocket = require(path.join(__dirname, '..', '..', 'app', 'node_modules', 'ws'))

const EXPECT_TABS = ['常规', '打印和数据库', '编辑', '系统']
const EXPECT_GROUPS = ['options-group-语言', 'options-group-单位', 'options-group-非打印对象', 'options-group-其它']
const EXPECT_LABELS = ['界面语言(L):', '标尺单位(U):', '输出非打印对象(P)', '不选中非打印对象(N)', '允许运行脚本(S)']

function getJson(url) {
  return new Promise((resolve, reject) => {
    http.get(url, (res) => { let d = ''; res.on('data', (c) => d += c); res.on('end', () => { try { resolve(JSON.parse(d)) } catch (e) { reject(e) } }) }).on('error', reject)
  })
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
function attach(wsUrl) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(wsUrl)
    let id = 0
    const pending = new Map()
    ws.on('message', (raw) => { const m = JSON.parse(raw.toString()); const it = pending.get(m.id); if (!it) return; pending.delete(m.id); if (m.error) it.reject(new Error(m.error.message)); else it.resolve(m.result) })
    ws.on('open', () => resolve({ ws, send: (method, params = {}) => new Promise((res, rej) => { const i = ++id; pending.set(i, { resolve: res, reject: rej }); ws.send(JSON.stringify({ id: i, method, params })) }) }))
    ws.on('error', reject)
  })
}
function argOf(name, def) { const i = process.argv.indexOf('--' + name); return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : def }

;(async () => {
  const port = Number(argOf('port', process.env.MAXLABEL_DEBUG_PORT || 9222))
  const pages = await getJson(`http://127.0.0.1:${port}/json/list`)
  const page = pages.find((p) => p.type === 'page')
  if (!page) throw new Error('没有找到页面（实例没起或端口不对）')
  const c = await attach(page.webSocketDebuggerUrl)
  const ev = async (e) => { const r = await c.send('Runtime.evaluate', { expression: e, awaitPromise: true, returnByValue: true }); if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || r.exceptionDetails.text); return r.result?.value }
  const waitFor = async (expr, timeout = 8000) => { const t0 = Date.now(); while (Date.now() - t0 < timeout) { if (await ev(expr)) return true; await sleep(90) } return false }

  await sleep(1200)
  await ev('document.querySelector("button[aria-label=关闭]")?.click()')
  await ev('document.dispatchEvent(new KeyboardEvent("keydown",{key:"n",code:"KeyN",ctrlKey:true,bubbles:true,cancelable:true}))')
  await sleep(500)
  if (await ev('!!document.querySelector("[data-testid=template-wizard]")')) { await ev('document.querySelector("[data-testid=wizard-next]")?.click()'); await sleep(400) }
  if (await waitFor('!!document.querySelector("[data-testid=new-label-dialog]")')) await ev('document.querySelector("[data-testid=new-label-select]")?.click()')
  if (!(await waitFor('!!document.querySelector("canvas.upper-canvas")', 9000))) throw new Error('没能进入编辑器')

  // 打开：选项(O) 菜单 → 系统选项(C)…
  await ev(`document.querySelector('[data-menu-title="选项(O)"]')?.click()`)
  await sleep(250)
  await ev(`(() => { const it=[...document.querySelectorAll('[data-menu-item]')].find((e)=>e.offsetParent && (e.textContent||'').includes('系统选项')); if(it) it.click() })()`)
  if (!(await waitFor('!!document.querySelector("[data-testid=options-dialog]")', 6000))) throw new Error('系统设置对话框没打开')

  const info = await ev(`(() => {
    const d=document.querySelector('[data-testid="options-dialog"]')
    const tabs=[...d.querySelectorAll('button')].map((b)=>(b.textContent||'').trim()).filter((t)=>['常规','标签','打印和数据库','编辑','系统'].includes(t))
    const title=[...d.querySelectorAll('div,span,h1,h2')].map((e)=>(e.textContent||'').trim()).find((t)=>t==='系统设置'||t==='系统选项')||''
    const groups=${JSON.stringify(EXPECT_GROUPS)}.filter((g)=>!!d.querySelector('[data-testid="'+g+'"]'))
    const text=(d.textContent||'')
    const labels=${JSON.stringify(EXPECT_LABELS)}.filter((l)=>text.includes(l))
    const btns=[...d.querySelectorAll('button')].map((b)=>({t:(b.textContent||'').trim(), hidden:b.hidden||b.offsetParent===null}))
    return { tabs, title, groups, labels, hasOk:btns.some((b)=>b.t==='确定'), hasCancel:btns.some((b)=>b.t==='取消'), hasHelp:btns.some((b)=>b.t==='帮助'), visibleApply:btns.some((b)=>b.t.startsWith('应用') && !b.hidden) }
  })()`)

  const out = {}
  out[`标题=系统设置（实测「${info.title}」）`] = info.title === '系统设置'
  out[`页签 = ${EXPECT_TABS.join('/')}（实测 ${JSON.stringify(info.tabs)}）`] = JSON.stringify(info.tabs) === JSON.stringify(EXPECT_TABS)
  out['常规页四个分组框（语言/单位/非打印对象/其它）'] = info.groups.length === 4
  out[`常规页字段原文（${EXPECT_LABELS.length} 项）`] = info.labels.length === EXPECT_LABELS.length
  out['底排 确定/取消/帮助 齐备'] = info.hasOk && info.hasCancel && info.hasHelp
  out['没有可见的「应用」按钮（真机为隐藏控件）'] = info.visibleApply === false

  let pass = 0
  for (const [k, v] of Object.entries(out)) { console.log((v ? 'PASS ' : 'FAIL ') + k); if (v) pass++ }
  console.log(`\n${pass}/${Object.keys(out).length} PASS`)
  c.ws.close()
  process.exit(pass === Object.keys(out).length ? 0 : 1)
})().catch((e) => { console.error('ERR', e.message); process.exit(2) })
