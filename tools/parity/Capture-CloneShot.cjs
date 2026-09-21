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
  if (scene === 'editor') {
    await ev('document.querySelector("[data-testid=new-label-select]")?.click()')
    if (!(await waitFor('!!document.querySelector("canvas.upper-canvas")'))) throw new Error('没进编辑器')
    await sleep(800)
  }
  if (scene === 'props') {
    // 对象属性对话框：建一个条码对象（工具只是"选中"，画布落点才建对象），再双击它打开属性页
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
  }
  if (scene === 'menu') {
    // 文件(F) 菜单展开态（真机对照图：verifier-r43-file-menu.png）
    await ev(`document.querySelector('[data-menu-title="文件(F)"]')?.click()`)
    await sleep(400)
  }
  if (scene === 'sysset') {
    // 选项(O) → 系统选项(C)…（真机对照图：probe-r112-sysset*.png 四页）
    await ev(`document.querySelector('[data-menu-title="选项(O)"]')?.click()`)
    await sleep(250)
    await ev(`(() => { const it=[...document.querySelectorAll('[data-menu-item]')].find((e)=>e.offsetParent && (e.textContent||'').includes('系统选项')); if(it) it.click() })()`)
    if (!(await waitFor('!!document.querySelector(\'[data-testid="options-dialog"]\')', 6000))) throw new Error('系统设置对话框没打开')
    await sleep(500)
  }
  const shot = await c.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false })
  fs.mkdirSync(path.dirname(out), { recursive: true })
  fs.writeFileSync(out, Buffer.from(shot.data, 'base64'))
  console.log('[capture] scene=' + scene + ' → ' + out + ' (' + fs.statSync(out).size + ' bytes)')
  c.ws.close()
})().catch((e) => { console.error('ERR', e.message); process.exit(1) })
