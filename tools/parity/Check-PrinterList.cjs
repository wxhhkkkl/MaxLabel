/**
 * A2 判定（验收方 round-218，5 分钟小工具）
 *
 * 问题：真机「选择标签格式」的 `打印机(P):` 显示真实设备名 ✓，
 *   而我在 round-174 的复刻版截图里看到的是 `（未检测到打印机）` ✗。
 * 代码读下来只剩两种可能（见 parity/验收方逐项比对-施工清单.md 的 A‴ 节）：
 *   ① 对话框里那次 `listPrinters()` 返回了空（真缺口 ✗）
 *   ② 列表其实有值，只是"默认选中项"落在占位项（小问题 ✓）
 * 本脚本起一个实例、打开该对话框、把该组合框的 options 与 selectedIndex 打出来 ✓。
 *
 * 用法：起实例（带 --remote-debugging-port=9341）后 `MAXLABEL_DEBUG_PORT=9341 node tools/parity/Check-PrinterList.cjs`
 */
const path = require('path')
const http = require('http')
const WebSocket = require(path.join(__dirname, '..', '..', 'app', 'node_modules', 'ws'))

const PORT = Number(process.env.MAXLABEL_DEBUG_PORT || 9341)
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const getJson = (u) => new Promise((res, rej) => { http.get(u, (r) => { let d = ''; r.on('data', (c) => (d += c)); r.on('end', () => { try { res(JSON.parse(d)) } catch (e) { rej(e) } }) }).on('error', rej) })

async function main() {
  const pages = await getJson(`http://127.0.0.1:${PORT}/json/list`)
  const page = pages.find((p) => p.type === 'page')
  if (!page) { console.error('没找到页面'); process.exit(1) }
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
  const waitFor = async (expr, t = 8000) => { const t0 = Date.now(); while (Date.now() - t0 < t) { if (await ev(expr)) return true; await sleep(120) } return false }

  try {
    await ev('document.dispatchEvent(new KeyboardEvent("keydown",{key:"n",code:"KeyN",ctrlKey:true,bubbles:true,cancelable:true}))')
    await sleep(700)
    if (await ev('!!document.querySelector("[data-testid=template-wizard]")')) { await ev('document.querySelector("[data-testid=wizard-next]")?.click()'); await sleep(900) }
    if (!(await waitFor('!!document.querySelector("[data-testid=new-label-dialog]")'))) throw new Error('没打开「选择标签格式」')
    await sleep(700)
    const info = await ev(`(() => {
      const d = document.querySelector('[data-testid=new-label-dialog]')
      const sels = [...d.querySelectorAll('select')].map((s) => ({
        testid: s.getAttribute('data-testid') || '(none)',
        options: [...s.options].map((o) => o.textContent.trim()),
        selectedIndex: s.selectedIndex,
        value: s.value,
      }))
      return { selects: sels, text: (d.textContent || '').includes('未检测到打印机') }
    })()`)
    const printer = info.selects.find((s) => /printer/i.test(s.testid)) || info.selects[0]
    console.log('# A2 判定：「选择标签格式」里的打印机组合框\n')
    console.log('对话框里是否出现"未检测到打印机"字样：' + (info.text ? '**是** ✗' : '否 ✓'))
    for (const s of info.selects) {
      console.log(`\n- 组合框 ${s.testid}：selectedIndex=${s.selectedIndex} value=${JSON.stringify(s.value)}`)
      s.options.forEach((o, i) => console.log(`    ${i === s.selectedIndex ? '▶' : ' '} [${i}] ${o}`))
    }
    console.log('\n结论口径：')
    if (!printer || printer.options.length <= 1) console.log('  → **可能 ①：列表为空 → 真缺口** ✗（listPrinters() 那次没取到 ✓ 需查 IPC/时序 ✓）')
    else console.log('  → **可能 ②：列表有值，只是默认选中项不对 → 小问题** ✓（应回落到第一个真实打印机 ✓）')
  } catch (e) {
    console.log('ERR ' + e.message)
  } finally {
    try { ws.close() } catch { /* 忽略 */ }
  }
}
main().catch((e) => { console.error('ERR ' + e.message); process.exit(1) })
