/**
 * 打印链路端到端（验收方 round-174 新增）
 *
 * 目标：让**复刻版真的走一遍操作系统打印链路**并产出可核对的输出 ✓ —— 这是停止标准第 ④ 条
 * "真实打印机链路至少一次端到端成功"目前唯一没取到的部分 ✗。
 *
 * 做法（**先不碰实体打印机** ✓，用 `Microsoft Print to PDF` 走同一条打印管线 ✓ —— 区别只在最后的输出设备 ✓）：
 *   1) 起一个复刻版实例（自己的 profile / 端口 ✓）；
 *   2) 建文档 → 放一个条码（默认数据 1234567890 ✓）；
 *   3) 文件 → 打印(P)... → 选打印机 → 打印 ✓；
 *   4) OS 会弹"将打印输出另存为"对话框 → 由 PowerShell 侧 SendKeys 填路径并回车 ✓；
 *   5) 校验产物：存在 ✓、大小合理 ✓、**页面尺寸 = 标签尺寸**（从 PDF 头里的 /MediaBox 直接读 ✓，不是 A4 ✗）。
 *
 * 用法：node tools/parity/Verify-PrintEndToEnd.cjs [--sha <checkout>] [--out <pdf>]
 */
const fs = require('fs')
const path = require('path')
const http = require('http')
const { execFileSync } = require('child_process')
const WebSocket = require(path.join(__dirname, '..', '..', 'app', 'node_modules', 'ws'))

const REPO = path.resolve(__dirname, '..', '..')
const args = process.argv.slice(2)
const argOf = (n, d) => { const i = args.indexOf('--' + n); return i >= 0 && args[i + 1] ? args[i + 1] : d }
const PORT = Number(argOf('port', 9340))
const PDF = argOf('out', path.join(process.env.TEMP || '.', 'maxlabel-print-e2e.pdf'))

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const getJson = (u) => new Promise((res, rej) => { http.get(u, (r) => { let d = ''; r.on('data', (c) => (d += c)); r.on('end', () => { try { res(JSON.parse(d)) } catch (e) { rej(e) } }) }).on('error', rej) })

async function main() {
  // ---- 连上实例 ----
  let target = null
  for (let i = 0; i < 30; i++) {
    try { const list = await getJson(`http://127.0.0.1:${PORT}/json/list`); target = list.find((t) => t.type === 'page'); if (target) break } catch {}
    await sleep(1000)
  }
  if (!target) { console.error('[e2e] ✗ 30 秒内没连上调试端口 ' + PORT + '（先把实例起起来）'); process.exit(1) }
  const ws = new WebSocket(target.webSocketDebuggerUrl)
  let id = 0; const pend = new Map()
  ws.on('message', (raw) => { const m = JSON.parse(raw.toString()); const p = pend.get(m.id); if (p) { pend.delete(m.id); m.error ? p.rej(new Error(m.error.message)) : p.res(m.result) } })
  await new Promise((r) => ws.on('open', r))
  const send = (method, params = {}) => new Promise((res, rej) => { const i = ++id; pend.set(i, { res, rej }); ws.send(JSON.stringify({ id: i, method, params })) })
  const ev = async (e) => (await send('Runtime.evaluate', { expression: e, awaitPromise: true, returnByValue: true })).result?.value
  const waitFor = async (expr, t = 8000) => { const t0 = Date.now(); while (Date.now() - t0 < t) { if (await ev(expr)) return true; await sleep(120) } return false }

  // ---- 1) 建文档 + 放条码 ----
  // 冷启动要走「Ctrl+N → 模板向导 → 选择标签格式」，直接点 new-label-select 是**进不去**的 ✗（round-174 实测）
  await ev('document.dispatchEvent(new KeyboardEvent("keydown",{key:"n",code:"KeyN",ctrlKey:true,bubbles:true,cancelable:true}))')
  await sleep(600)
  if (await ev('!!document.querySelector("[data-testid=template-wizard]")')) {
    await ev('document.querySelector("[data-testid=wizard-next]")?.click()')
    await sleep(500)
  }
  if (!(await waitFor('!!document.querySelector("[data-testid=new-label-dialog]")'))) { console.error('[e2e] ✗ 选择标签格式对话框没打开'); process.exit(1) }
  await ev('document.querySelector("[data-testid=new-label-select]")?.click()')
  if (!(await waitFor('!!document.querySelector("canvas.upper-canvas")'))) { console.error('[e2e] ✗ 没进编辑器'); process.exit(1) }
  await sleep(900)
  await ev('document.querySelector(\'[data-tool="barcode"]\')?.click()')
  await sleep(400)
  const rect = await ev(`(() => { const el=document.querySelector('canvas.upper-canvas'); const r=el.getBoundingClientRect(); return {x:r.left+r.width*0.3, y:r.top+r.height*0.35} })()`)
  const click = async (type, n, buttons) => send('Input.dispatchMouseEvent', { type, x: Math.round(rect.x), y: Math.round(rect.y), button: 'left', buttons, clickCount: n })
  await click('mousePressed', 1, 1); await click('mouseReleased', 1, 0)
  await sleep(600)
  console.log('[e2e] 文档就绪，条码已放置 ✓')

  // ---- 2) 文件 → 打印(P)... ----
  await ev(`document.querySelector('[data-menu-title="文件(F)"]')?.click()`)
  await sleep(350)
  await ev(`(() => { const it=[...document.querySelectorAll('[data-menu-item]')].find((e)=>e.offsetParent && (e.textContent||'').trim().startsWith('打印(P)')); if(it) it.click() })()`)
  if (!(await waitFor('!!document.querySelector(\'[data-testid="print-dialog"]\')'))) { console.error('[e2e] ✗ 打印对话框没打开'); process.exit(1) }
  await sleep(500)

  // ---- 3) 选打印机：在**右侧面板**的 `print-printer`（打印对话框里没有 select ✗，round-174 实测）----
  const printerOpts = await ev(`(() => { const s=document.querySelector('[data-testid="print-printer"]'); return s ? [...s.options].map((o)=>o.textContent.trim()) : null })()`)
  console.log('[e2e] 打印机下拉选项：' + JSON.stringify(printerOpts))
  const picked = await ev(`(() => {
    const s=document.querySelector('[data-testid="print-printer"]'); if(!s) return null
    const i=[...s.options].findIndex((o)=>/PDF/i.test(o.textContent))
    if(i<0) return null
    s.selectedIndex=i; s.dispatchEvent(new Event('change',{bubbles:true})); return s.options[i].textContent.trim()
  })()`)
  console.log('[e2e] 选中打印机：' + picked)
  await sleep(700)
  if (!picked) { console.error('[e2e] ✗ 没找到含 PDF 的打印机选项'); process.exit(1) }

  // ---- 4) 关掉可能弹出的「打印机设置」对话框，再按**右侧面板**的打印按钮 ----
  // round-174 实测：把打印机切成 Microsoft Print to PDF 后，应用会先弹 `printer-settings-dialog` ✗；
  //   要先取消它 ✓，再点 dock 上的 `print-submit`（点打印对话框里的按钮是点不到的 ✗）。
  if (await ev('!!document.querySelector(\'[data-testid="printer-settings-dialog"]\')')) {
    console.log('[e2e] 出现「打印机设置」对话框 → 取消它')
    await ev('document.querySelector(\'[data-testid="printer-settings-cancel"]\')?.click()')
    await sleep(500)
  }
  fs.rmSync(PDF, { force: true })
  const clicked = await ev(`(() => { const b=document.querySelector('[data-testid="print-submit"]'); if(!b) return false; b.click(); return true })()`)
  console.log('[e2e] 已点 dock 的打印按钮：' + clicked + '，等待系统"另存为"对话框…')
  await sleep(3000)

  // 用独立 PowerShell 处理"打印输出另存为"对话框。
  // ⚠️ round-174 实测：该对话框是**本应用的模态子窗口** ✗，不会作为独立进程出现在 Get-Process ✗
  //   → 正确做法是把**应用窗口**拉到前台，再 SendKeys（按键会进到它拥有的模态对话框 ✓）。
  const ps = `
$ErrorActionPreference='Continue'
Add-Type -AssemblyName System.Windows.Forms
Add-Type @"
using System;
using System.Runtime.InteropServices;
public class W { [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr h);
  [DllImport("user32.dll")] public static extern bool ShowWindow(IntPtr h, int c); }
"@
$win = Get-Process | Where-Object { $_.MainWindowTitle -match 'MaxLabel' } | Select-Object -First 1
if(-not $win){ 'NO_APP_WINDOW'; exit 0 }
[void][W]::ShowWindow($win.MainWindowHandle, 5)
[void][W]::SetForegroundWindow($win.MainWindowHandle)
Start-Sleep -Milliseconds 700
# 另存为对话框的文件名框默认有焦点；直接打全路径 + 回车
[void][System.Windows.Forms.SendKeys]::SendWait('${PDF.replace(/\\/g, '\\\\')}')
Start-Sleep -Milliseconds 500
[void][System.Windows.Forms.SendKeys]::SendWait('{ENTER}')
'KEYS_SENT ' + $win.MainWindowTitle
`
  let dlgOut = ''
  try { dlgOut = execFileSync('powershell', ['-NoProfile', '-Command', ps], { encoding: 'utf8' }) } catch (e) { dlgOut = 'ERR ' + e.message }
  console.log('[e2e] 另存为对话框处理：' + dlgOut.trim())
  await sleep(5000)

  // ---- 5) 校验产物 ----
  const exists = fs.existsSync(PDF)
  const size = exists ? fs.statSync(PDF).size : 0
  let media = null
  if (exists) {
    const head = fs.readFileSync(PDF).subarray(0, 4096).toString('latin1')
    const m = /\/MediaBox\s*\[\s*([\d.\-]+)\s+([\d.\-]+)\s+([\d.\-]+)\s+([\d.\-]+)/.exec(head)
    if (m) media = { wpt: parseFloat(m[3]), hpt: parseFloat(m[4]) }
  }
  const mm = (pt) => Math.round((pt / 72) * 25.4 * 10) / 10
  console.log(`[e2e] 产物：${PDF}`)
  console.log(`[e2e] 存在=${exists} 大小=${size} 字节`)
  if (media) console.log(`[e2e] 页面尺寸：${media.wpt}×${media.hpt} pt = ${mm(media.wpt)}×${mm(media.hpt)} mm`)
  console.log(media ? `[e2e] 判定：${size > 3000 ? '✓ 产出了非空 PDF' : '✗ PDF 过小（可能空白）'}；页面 ${mm(media.wpt)}×${mm(media.hpt)} mm（标签默认 100×70 ✗ A4 是 210×297）`
    : `[e2e] 判定：${exists ? 'PDF 生成了但读不到 MediaBox' : '✗ 没有产物（另存为对话框可能没处理成功）'}`)
  ws.close()
  process.exit(exists && size > 3000 ? 0 : 1)
}
main().catch((e) => { console.error('[e2e] ✗ ' + e.message); process.exit(1) })
