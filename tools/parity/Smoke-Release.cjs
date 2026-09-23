/**
 * 发布产物冒烟测试（验收方 round-154 新增）
 *
 * 目的：验证**打包产物**（app/release/win-unpacked/MaxLabel.exe）能真的启动并渲染出界面，
 * 而不是只验证开发态（`electron .`）。这是"发布可用性"的直接证据。
 *
 * 做法：用独立 user-data-dir 启动打包 exe（不污染用户数据 ✓）+ 开 CDP → 截图 + 断言关键元素。
 * 用法：node tools/parity/Smoke-Release.cjs
 */
const fs = require('fs')
const path = require('path')
const http = require('http')
const { spawn } = require('child_process')
const WebSocket = require(path.join(__dirname, '..', '..', 'app', 'node_modules', 'ws'))

const REPO = path.resolve(__dirname, '..', '..')
const EXE = path.join(REPO, 'app', 'release', 'win-unpacked', 'MaxLabel.exe')
const OUT = path.join(REPO, 'parity', 'reference', 'maxlabel', 'release-smoke.png')
const PROFILE = path.join(process.env.TEMP || '.', 'maxlabel-release-smoke')
const PORT = 9344

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const getJson = (u) => new Promise((res, rej) => { http.get(u, (r) => { let d = ''; r.on('data', (c) => (d += c)); r.on('end', () => res(JSON.parse(d))) }).on('error', rej) })

async function main() {
  if (!fs.existsSync(EXE)) { console.error('[smoke] ✗ 找不到打包产物：' + EXE); process.exit(1) }
  const sizeMB = (fs.statSync(EXE).size / 1024 / 1024).toFixed(1)
  console.log(`[smoke] 产物：${path.relative(REPO, EXE)}（${sizeMB} MB）`)
  fs.rmSync(PROFILE, { recursive: true, force: true })

  const child = spawn(EXE, [`--remote-debugging-port=${PORT}`, `--user-data-dir=${PROFILE}`], { detached: false, stdio: 'ignore' })
  console.log(`[smoke] 已启动 pid=${child.pid}，等待 CDP…`)

  let target = null
  for (let i = 0; i < 40; i++) {
    await sleep(1000)
    try {
      const list = await getJson(`http://127.0.0.1:${PORT}/json/list`)
      target = list.find((t) => t.type === 'page' && t.webSocketDebuggerUrl)
      if (target) break
    } catch { /* 还没起来 */ }
  }
  if (!target) { try { child.kill() } catch {} ; console.error('[smoke] ✗ 40 秒内没等到 CDP 目标（应用可能没起来）'); process.exit(1) }
  console.log('[smoke] CDP 已连上：' + target.url)

  const ws = new WebSocket(target.webSocketDebuggerUrl)
  let id = 0
  const pend = new Map()
  ws.on('message', (raw) => { const m = JSON.parse(raw.toString()); const p = pend.get(m.id); if (p) { pend.delete(m.id); m.error ? p.rej(new Error(m.error.message)) : p.res(m.result) } })
  await new Promise((r) => ws.on('open', r))
  const send = (method, params = {}) => new Promise((res, rej) => { const i = ++id; pend.set(i, { res, rej }); ws.send(JSON.stringify({ id: i, method, params })) })
  const ev = async (e) => (await send('Runtime.evaluate', { expression: e, awaitPromise: true, returnByValue: true })).result?.value

  await sleep(3000)
  const info = await ev(`JSON.stringify({
    title: document.title,
    menus: [...document.querySelectorAll('[data-menu-title]')].map(e=>e.textContent.trim()),
    hasStart: !!document.querySelector('[data-testid=new-label-select]') || /起始页/.test(document.body.innerText),
    bodyLen: (document.body.innerText||'').length
  })`)
  const shot = await send('Page.captureScreenshot', { format: 'png' })
  fs.writeFileSync(OUT, Buffer.from(shot.data, 'base64'))
  console.log('[smoke] 截图：' + path.relative(REPO, OUT))

  try { ws.close() } catch {}
  try { child.kill() } catch {}
  await sleep(1500)

  const parsed = JSON.parse(info || '{}')
  console.log('[smoke] 页面信息：' + info)
  const ok = parsed.bodyLen > 100 && (parsed.menus || []).length >= 5
  console.log(ok ? '[smoke] ✓ 打包产物可启动并渲染出界面（菜单栏 ' + parsed.menus.length + ' 项、正文 ' + parsed.bodyLen + ' 字）'
                 : '[smoke] ✗ 界面看起来不正常（正文过短或没有菜单栏）')
  process.exit(ok ? 0 : 1)
}

main().catch((e) => { console.error('[smoke] ✗ 异常：' + e.message); process.exit(1) })
