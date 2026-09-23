/**
 * A1 复核（验收方 round-219）：打印对话框里的「打印机 名称 / 位置」到底显示了什么？
 *
 * 背景：我 round-174 从并排图 `cmp-printdialog-558732e.png` 判"真机 `Microsoft Print to PDF` / `PORTPROMPT:` ✓，
 * 复刻版 `打印机` / `Windows 打印机驱动端口` ✗"。但 round-218 证明我这类"看截图下结论"的做法会踩**取样时机**的坑 ✗
 * （A2 的"未检测到打印机"就是这么误判的 ✓）。
 * 所以这次**不看截图** ✓：直接把打印对话框里控件的**实际取值**读出来 ✓。
 *
 * 用法：起实例（--remote-debugging-port=9343）后 `MAXLABEL_DEBUG_PORT=9343 node tools/parity/Check-PrintDialogFields.cjs`
 */
const path = require('path')
const http = require('http')
const WebSocket = require(path.join(__dirname, '..', '..', 'app', 'node_modules', 'ws'))

const PORT = Number(process.env.MAXLABEL_DEBUG_PORT || 9343)
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
    // 进编辑器：Ctrl+N → 向导下一步 → 选默认格式
    await ev('document.dispatchEvent(new KeyboardEvent("keydown",{key:"n",code:"KeyN",ctrlKey:true,bubbles:true,cancelable:true}))')
    await sleep(700)
    if (await ev('!!document.querySelector("[data-testid=template-wizard]")')) { await ev('document.querySelector("[data-testid=wizard-next]")?.click()'); await sleep(800) }
    if (await ev('!!document.querySelector("[data-testid=new-label-dialog]")')) { await ev('document.querySelector("[data-testid=new-label-select]")?.click()'); await sleep(1400) }
    if (!(await waitFor('!!document.querySelector("canvas.upper-canvas")'))) throw new Error('没进编辑器')
    await sleep(600)
    // 文件(F) → 打印(P)...
    await ev(`document.querySelector('[data-menu-title="文件(F)"]')?.click()`)
    await sleep(350)
    await ev(`(() => { const it=[...document.querySelectorAll('[data-menu-item]')].find((e)=>e.offsetParent && /^打印\\(P\\)/.test((e.textContent||'').trim())); if(it) it.click(); return !!it })()`)
    if (!(await waitFor('!!document.querySelector(\'[data-testid="print-dialog"]\')', 6000))) throw new Error('没打开打印对话框')
    await sleep(1200)   // ★ 给"取打印机信息"留时间 —— A2 的教训就是取样太早 ✗
    const info = await ev(`(() => {
      const d = document.querySelector('[data-testid="print-dialog"]')
      const grab = (sel) => [...d.querySelectorAll(sel)].map((el) => ({
        testid: el.getAttribute('data-testid') || '', tag: el.tagName.toLowerCase(),
        value: el.value !== undefined ? el.value : '', text: (el.textContent || '').trim().slice(0, 80),
      }))
      return { selects: grab('select'), inputs: grab('input'), texts: (d.textContent || '').slice(0, 600) }
    })()`)
    console.log('# A1 复核：打印对话框里的实际取值（不看截图 ✓）\n')
    console.log('组合框：')
    for (const s of info.selects) {
      const opts = await ev(`(() => { const d=document.querySelector('[data-testid="print-dialog"]'); const s=[...d.querySelectorAll('select')].find(x=>(x.getAttribute('data-testid')||'')===${JSON.stringify(s.testid)}); return s ? [...s.options].map(o=>o.textContent.trim()) : [] })()`)
      console.log(`  - ${s.testid} = ${JSON.stringify(s.value)}  选项(${opts.length})：${opts.slice(0, 8).join(' | ')}`)
    }
    console.log('\n只读/文本类字段：')
    for (const i of info.inputs) console.log(`  - ${i.testid} (${i.tag}) = ${JSON.stringify(i.value)}`)
    console.log('\n对话框可见文本（前 300 字）：\n  ' + info.texts.replace(/\s+/g, ' ').slice(0, 300))
    console.log('\n判定口径：若"名称/位置"里出现 `打印机`/`Windows 打印机驱动端口` 这类**占位词** ✗ → 仍是缺口；')
    console.log('          若出现真实设备名（如 Microsoft Print to PDF / OneNote）与端口（如 PORTPROMPT:）✓ → A1 也是取样问题 ✓')
  } catch (e) {
    console.log('ERR ' + e.message)
  } finally {
    try { ws.close() } catch { /* 忽略 */ }
  }
}
main().catch((e) => { console.error('ERR ' + e.message); process.exit(1) })
