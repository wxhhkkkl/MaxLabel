/**
 * 真实打印机端到端：把 MaxLabel 里的一条**条码**打到**物理打印机**上（验收方 round-261 新增）
 *
 * 为什么要它：round-216 的工装证明了"点「打印」会走到**系统打印对话框**" ✓，
 * 但当时用 `Microsoft Print to PDF` → 后面还有一层"另存为"对话框 ✗，我没走完 ✗。
 * 现在用户接了**真机**（HP LaserJet Pro M329，WSD 端口）✓：
 *   - 因为 `webContents.print({ silent:false, deviceName: 选中的打印机 })` ✓ 会把**该设备预选**进对话框 ✓，
 *     所以只要机器人在对话框里**按确认** ✓，纸就会出来 ✓ —— 不再有"另存为"这一步 ✓✓。
 *
 * 用法：
 *   起一个带 CDP 的实例后（端口默认 9344）：
 *     node tools/parity/Print-BarcodeToRealPrinter.cjs "HP7E6C81 (HP LaserJet Pro M329)"
 *   只探测不打印：加 --dry
 */
const path = require('path')
const http = require('http')
const { execFileSync } = require('child_process')
const WebSocket = require(path.join(__dirname, '..', '..', 'app', 'node_modules', 'ws'))

const PORT = Number(process.env.MAXLABEL_DEBUG_PORT || 9344)
const args = process.argv.slice(2).filter((a) => a !== '--dry')
const DRY = process.argv.includes('--dry')
const TARGET = args[0] || 'HP7E6C81 (HP LaserJet Pro M329)'

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const getJson = (u) => new Promise((res, rej) => { http.get(u, (r) => { let d = ''; r.on('data', (c) => (d += c)); r.on('end', () => { try { res(JSON.parse(d)) } catch (e) { rej(e) } }) }).on('error', rej) })

/** 给标题匹配的窗口发按键（我 round-217 的那招 ✓；用 ArrayList 收集，避免 $script: 作用域坑 ✗） */
function sendKeysToWindow (titlePattern, keys) {
  const ps = `
$ErrorActionPreference='Continue'
Add-Type -AssemblyName System.Windows.Forms
Add-Type @"
using System; using System.Text; using System.Runtime.InteropServices;
public class F {
  [DllImport("user32.dll")] public static extern bool EnumWindows(EnumWindowsProc cb, IntPtr p);
  [DllImport("user32.dll")] public static extern int GetWindowText(IntPtr h, StringBuilder s, int n);
  [DllImport("user32.dll")] public static extern bool IsWindowVisible(IntPtr h);
  [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr h);
  [DllImport("user32.dll")] public static extern bool ShowWindow(IntPtr h, int c);
  public delegate bool EnumWindowsProc(IntPtr h, IntPtr p);
}
"@
$found = New-Object System.Collections.ArrayList
$cb = [F+EnumWindowsProc]{ param($h,$p)
  if([F]::IsWindowVisible($h)){
    $sb=New-Object System.Text.StringBuilder 512; [void][F]::GetWindowText($h,$sb,512)
    if($sb.Length -gt 0 -and $sb.ToString() -match '${titlePattern}'){ [void]$found.Add(@{ h=$h; t=$sb.ToString() }) }
  }
  return $true }
[void][F]::EnumWindows($cb,[IntPtr]::Zero)
if($found.Count -eq 0){ 'NO_WINDOW'; exit 0 }
[void][F]::ShowWindow($found[0].h,5); [void][F]::SetForegroundWindow($found[0].h); Start-Sleep -Milliseconds 500
[System.Windows.Forms.SendKeys]::SendWait('${keys}')
'SENT: ' + $found[0].t
`
  try { return execFileSync('powershell', ['-NoProfile', '-Command', ps], { encoding: 'utf8' }).trim() } catch (e) { return 'ERR ' + e.message }
}

/** 当前打印队列（用于"到底有没有送出去"的客观判据 ✓） */
function spoolJobs (printer) {
  const ps = `$ErrorActionPreference='Continue'; $j=@(Get-PrintJob -PrinterName '${printer.replace(/'/g, "''")}' -ErrorAction SilentlyContinue); if($j.Count -eq 0){'NO_JOB'} else { $j | ForEach-Object { $_.Id.ToString() + ':' + $_.DocumentName + ':' + $_.JobStatus } }`
  try { return execFileSync('powershell', ['-NoProfile', '-Command', ps], { encoding: 'utf8' }).trim() } catch (e) { return 'ERR ' + e.message }
}

async function main () {
  const pages = await getJson(`http://127.0.0.1:${PORT}/json/list`)
  const page = pages.find((p) => p.type === 'page')
  if (!page) { console.error('没找到页面（实例没起或端口不对）'); process.exit(1) }
  const ws = new WebSocket(page.webSocketDebuggerUrl)
  let id = 0; const pend = new Map()
  ws.on('message', (raw) => { const m = JSON.parse(raw.toString()); const p = pend.get(m.id); if (p) { pend.delete(m.id); m.error ? p.rej(new Error(m.error.message)) : p.res(m.result) } })
  await new Promise((r) => ws.on('open', r))
  const send = (method, params = {}) => new Promise((res, rej) => { const i = ++id; pend.set(i, { res, rej }); ws.send(JSON.stringify({ id: i, method, params })) })
  const ev = async (e) => {
    const r = await send('Runtime.evaluate', { expression: e, awaitPromise: true, returnByValue: true })
    if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || r.exceptionDetails.text)
    return r.result?.value
  }
  const waitFor = async (expr, t = 10000) => { const t0 = Date.now(); while (Date.now() - t0 < t) { if (await ev(expr)) return true; await sleep(150) } return false }

  try {
    console.log(`[print] 目标打印机：${TARGET}${DRY ? '（--dry：只探测，不真打）' : ''}`)

    // ① 进编辑器
    await ev('document.dispatchEvent(new KeyboardEvent("keydown",{key:"n",code:"KeyN",ctrlKey:true,bubbles:true,cancelable:true}))')
    await sleep(700)
    if (await ev('!!document.querySelector("[data-testid=template-wizard]")')) { await ev('document.querySelector("[data-testid=wizard-next]")?.click()'); await sleep(800) }
    if (await ev('!!document.querySelector("[data-testid=new-label-dialog]")')) { await ev('document.querySelector("[data-testid=new-label-select]")?.click()'); await sleep(1500) }
    if (!(await waitFor('!!document.querySelector("canvas.upper-canvas")', 15000))) throw new Error('没进编辑器')

    // ② 放一个**条码**对象（真机上就是"条码"工具 ✓）
    await ev('document.querySelector(\'[data-tool="barcode"]\')?.click()')
    await sleep(400)
    const rect = await ev(`(() => { const el=document.querySelector('canvas.upper-canvas'); const r=el.getBoundingClientRect(); return { x: r.left + r.width*0.35, y: r.top + r.height*0.35 } })()`)
    const click = (type, n, buttons, x, y) => send('Input.dispatchMouseEvent', { type, x: Math.round(x), y: Math.round(y), button: 'left', buttons, clickCount: n })
    await click('mousePressed', 1, 1, rect.x, rect.y); await click('mouseReleased', 1, 0, rect.x, rect.y)
    await sleep(900)
    const placed = await ev(`(() => { const c=document.querySelector('canvas.upper-canvas'); return !!c })()`)
    console.log('[print] 条码对象已放置：' + placed)

    // ③ 把右侧面板的打印机切成**目标真机**
    const ok = await ev(`(() => {
      const s = document.querySelector('[data-testid=print-printer]')
      if (!s) return 'NO_SELECT'
      const opt = [...s.options].find((o) => o.textContent.trim() === ${JSON.stringify(TARGET)})
      if (!opt) return 'NO_OPTION:' + [...s.options].map((o)=>o.textContent.trim()).join('|')
      s.value = opt.value
      s.dispatchEvent(new Event('change', { bubbles: true }))
      return 'OK:' + s.options[s.selectedIndex].textContent.trim()
    })()`)
    console.log('[print] 选中打印机 → ' + ok)
    if (String(ok).startsWith('NO_')) throw new Error('没能在下拉里选中目标打印机：' + ok)
    await sleep(800)

    // ④ 点「打印」→ 会弹**系统打印对话框**（因为产品用的是 silent:false ✓，且 deviceName 已预选 ✓）
    const jobsBefore = spoolJobs(TARGET)
    console.log('[print] 打印前队列：' + jobsBefore)
    if (DRY) { console.log('[print] --dry 到此为止 ✓'); return }
    await ev(`document.querySelector('[data-testid="printer-settings-cancel"]')?.click()`)  // 若有"打印机设置"挡住先关掉
    await sleep(400)
    const clicked = await ev(`(() => { const b=document.querySelector('[data-testid="print-submit"]'); if(!b) return false; b.click(); return true })()`)
    console.log('[print] 已点「打印」：' + clicked)

    // ⑤ 处理系统对话框：等它出现 → 发回车（deviceName 已把目标机预选 ✓，回车即"打印" ✓）
    let seen = ''
    for (let i = 0; i < 10; i++) {
      await sleep(600)
      seen = sendKeysToWindow('打印|Print', '{ENTER}')
      if (/SENT:/.test(seen)) { console.log('[print] 第 ' + (i + 1) + ' 次尝试 → ' + seen); break }
    }
    if (!/SENT:/.test(seen)) console.log('[print] ⚠️ 没抓到打印对话框（可能直接静默送出，或对话框标题不同）→ 继续看队列');

    // ⑥ 客观判据：队列里有没有作业 ✓（真机会一闪而过 ✓，所以多探几次）
    let jobsAfter = 'NO_JOB'
    for (let i = 0; i < 12; i++) {
      await sleep(700)
      jobsAfter = spoolJobs(TARGET)
      if (jobsAfter !== 'NO_JOB') { console.log('[print] ✓ 队列中看到作业：' + jobsAfter); break }
    }
    if (jobsAfter === 'NO_JOB') console.log('[print] ⚠️ 队列里没看到作业（可能已瞬间打完 ✓ 或没送出去 ✗）→ 请看打印机是否出纸');
    console.log('[print] 结束 ✓ —— 请检查打印机是否出纸')
  } catch (e) {
    console.log('ERR ' + e.message)
  } finally {
    try { ws.close() } catch { /* 忽略 */ }
  }
}
main().catch((e) => { console.error('ERR ' + e.message); process.exit(1) })
