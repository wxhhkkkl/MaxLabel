/*
 * 验收方工装：把「真机标签格式设置对话框」的取证结论变成可复跑的检查（P0 验收用）。
 *
 *   $env:MAXLABEL_DEBUG_PORT=9222; node tools/parity/Verify-LabelFormatDialog.cjs
 *
 * 前置：clone 已在带 CDP 端口的调试模式下运行（`tools/parity/MaxLabelCtl.ps1 -Action run` 之类）。
 * **不要**在 `npm run test:ui` 跑着的时候用它（UI 回归有独占锁，且会互相干扰）。
 *
 * 检查项（每条都对应真机证据，见 parity/reference/labelshop/PROBE-round105.md 与
 * `probe-round105-custom-label-tree.txt`）：
 *   1. 「选择标签格式」的 标签名称(L) 下拉里**没有**「自定义」项（真机该下拉 42 项，无自定义）
 *   2. 点「自定义(N)」后打开的是**标签格式设置**对话框（不是内联展开宽高）
 *   3. 该对话框含 5 个分组框：标签 / 间距 / 行列 / 形状 / 孔洞
 *   4. 字段名用真机原文：宽度 / 高度 / 列距 / 行距 / 列数 / 行数（不是"标签宽度/水平间距"这类）
 *   5. 孔洞 下拉 3 项、形状 下拉 3 项
 *   6. 有 `应用` 按钮且为禁用态
 *   7. 页内有预览行，形如 `100.00 x 70.00 毫米 [4行 2列]`
 *   8. 页内**没有**「圆角半径」字段（真机无此字段）
 * 输出 PASS/FAIL 逐条清单 + 退出码（全过 0）。
 */
const http = require('http')
const path = require('path')
// 本脚本在 tools/parity 下，`ws` 装在 app/node_modules → 必须显式指路（否则 Cannot find module 'ws'）
const WebSocket = require(path.join(__dirname, '..', '..', 'app', 'node_modules', 'ws'))

function getJson(url) {
  return new Promise((resolve, reject) => {
    http.get(url, (res) => {
      let data = ''
      res.on('data', (c) => { data += c })
      res.on('end', () => { try { resolve(JSON.parse(data)) } catch (e) { reject(e) } })
    }).on('error', reject)
  })
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
function attach(wsUrl) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(wsUrl)
    let id = 0
    const pending = new Map()
    const send = (method, params = {}) => new Promise((res, rej) => {
      const mid = ++id
      pending.set(mid, { res, rej })
      ws.send(JSON.stringify({ id: mid, method, params }))
    })
    ws.on('message', (raw) => {
      const m = JSON.parse(raw.toString())
      const it = pending.get(m.id)
      if (!it) return
      pending.delete(m.id)
      if (m.error) it.rej(new Error(m.error.message)); else it.res(m.result)
    })
    ws.on('open', () => resolve({ ws, send }))
    ws.on('error', reject)
  })
}

;(async () => {
  let client
  const out = {}
  try {
    const port = process.env.MAXLABEL_DEBUG_PORT || 9222
    const pages = await getJson(`http://127.0.0.1:${port}/json/list`)
    const page = pages.find((p) => p.type === 'page')
    if (!page) throw new Error('没找到页面')
    client = await attach(page.webSocketDebuggerUrl)
    const evaluate = async (expression) => {
      const r = await client.send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true })
      if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || r.exceptionDetails.text)
      return r.result?.value
    }
    const waitFor = async (expr, timeout = 6000) => {
      const t0 = Date.now()
      while (Date.now() - t0 < timeout) { if (await evaluate(expr)) return true; await sleep(100) }
      return false
    }
    const click = (sel) => evaluate(`(()=>{const e=document.querySelector(${JSON.stringify(sel)}); if(!e||e.disabled)return false; e.click(); return true})()`)

    // 新建标签 → 选择标签格式
    await sleep(1200)
    await evaluate('document.querySelector("button[aria-label=关闭]")?.click()')
    await evaluate('window.dispatchEvent(new KeyboardEvent("keydown",{key:"n",code:"KeyN",ctrlKey:true,bubbles:true,cancelable:true}))')
    await sleep(200)
    await evaluate('window.dispatchEvent(new KeyboardEvent("keydown",{key:"n",code:"KeyN",ctrlKey:true,bubbles:true,cancelable:true}))')
    await sleep(600)
    if (await evaluate('!!document.querySelector("[data-testid=template-wizard]")')) { await click('[data-testid="wizard-next"]'); await sleep(500) }
    const onList = await waitFor('!!document.querySelector("[data-testid=new-label-format]")')
    out['到达「选择标签格式」对话框'] = onList

    // 1. 标签名称下拉里不能有「自定义」
    const fmtOptions = await evaluate('[...(document.querySelector("[data-testid=new-label-format]")?.options||[])].map(o=>o.textContent.trim())')
    out['① 标签名称下拉不含「自定义」项'] = Array.isArray(fmtOptions) && !fmtOptions.some((t) => t === '自定义')

    // 2. 点「自定义(N)」
    const clicked = await click('[data-testid="new-label-custom"]')
    out['② 能点到「自定义(N)」按钮'] = clicked === true
    await sleep(1200)
    // 关键：所有断言都必须**限定在新对话框子树内**。先前版本把「所有可见 *-dialog 的文本」拼起来判，
    // 结果把 `TemplatePropsDialog` 的自造字段名（标签宽度/水平间距/垂直间距）算成了本对话框的 FAIL —— 典型的误报源。
    const dialogInfo = await evaluate(`(()=>{
      const d=document.querySelector('[data-testid="custom-label-dialog"]')
      if(!d) return { found:false }
      const t=d.textContent||''
      const tabs=[...d.querySelectorAll('[data-testid^="custom-label-tab-"]')].map((e)=>(e.textContent||'').trim())
      return { found:true, visible: d.offsetParent!==null, tabs, text: t.slice(0,6000) }
    })()`)
    out['② 新对话框 custom-label-dialog 已出现'] = !!(dialogInfo && dialogInfo.found)
    out['② 含 打印机/页面/标签/其它 四个页签'] = !!(dialogInfo && dialogInfo.found && ['打印机', '页面', '标签', '其它'].every((k) => (dialogInfo.tabs || []).includes(k)))

    const text = (dialogInfo && dialogInfo.text) || ''
    out['③ 五个分组框（标签/间距/行列/形状/孔洞）'] = ['标签', '间距', '行列', '形状', '孔洞'].every((k) => text.includes(k))
    // 真机字段名是「宽度(W):」这一类；注意不能只用 includes('宽度')——「标签宽度」也含「宽度」，会放过自造名
    out['④ 字段名用真机原文（宽度(W)/高度(H)/列距(P)/行距(L)/列数(C)/行数(R)）'] =
      ['宽度(W):', '高度(H):', '列距(P):', '行距(L):', '列数(C):', '行数(R):'].every((k) => text.includes(k))
    // ④b 只能查「带（mm）后缀的自造名」。踩过的坑：textContent 会把分组框 legend「标签」与字段「宽度(W):」连成
    // 「标签宽度(W):」，用 /标签宽度/ 判会**误报**（round-25 实测）。TemplatePropsDialog 的自造名是带（mm）的，
    // 两者形态不同，这样判既不会误报、也仍然能抓到真的自造名。
    out['④b 不用自造名（标签宽度（mm）/水平间距（mm）/垂直间距（mm））'] = !/标签宽度（mm）|水平间距（mm）|垂直间距（mm）/.test(text)

    const combos = await evaluate(`(()=>{
      const d=document.querySelector('[data-testid="custom-label-dialog"]')
      if(!d) return []
      const sels=[...d.querySelectorAll('select')]
      return sels.map((s)=>({label:(s.getAttribute('aria-label')||s.dataset.testid||'').trim(), n:s.options.length, opts:[...s.options].map(o=>o.textContent.trim())}))
    })()`)
    const shape = (combos || []).find((c) => c.opts.includes('圆角矩形'))
    const hole = (combos || []).find((c) => c.opts.includes('圆洞'))
    out['⑤ 形状下拉 3 项'] = !!(shape && shape.n === 3)
    out['⑤ 孔洞下拉 3 项（真机 3 项）'] = !!(hole && hole.n === 3)

    const btn = await evaluate(`(()=>{
      const d=document.querySelector('[data-testid="custom-label-dialog"]')
      if(!d) return {found:false}
      const bs=[...d.querySelectorAll('button')].filter((b)=>(b.textContent||'').trim().startsWith('应用'))
      return bs.length? {found:true, disabled: bs[0].disabled} : {found:false}
    })()`)
    out['⑥ 有「应用」按钮且禁用'] = !!(btn && btn.found && btn.disabled === true)

    out['⑦ 预览行形如 100.00 x 70.00 毫米 [4行 2列]'] = /-?\d+\.\d{2}\s*x\s*-?\d+\.\d{2}\s*毫米\s*\[\s*\d+\s*行\s*\d+\s*列\s*\]/.test(text)
    out['⑧ 页内没有「圆角半径」字段'] = !/圆角半径/.test(text)

    // 收尾：关掉对话框，别留脏状态
    await evaluate(`(()=>{const ds=[...document.querySelectorAll('[role=dialog],[data-testid$="-dialog"]')].filter((d)=>d.offsetParent!==null); const b=ds.flatMap((d)=>[...d.querySelectorAll('button')]).find((x)=>(x.textContent||'').trim()==='取消'); if(b)b.click(); return !!b})()`)

    let pass = 0
    for (const [k, v] of Object.entries(out)) { console.log((v ? 'PASS ' : 'FAIL ') + k + ' => ' + v); if (v) pass++ }
    console.log(`\n${pass}/${Object.keys(out).length} PASS`)
    console.log('对话框 testid：' + JSON.stringify((dialogInfo && dialogInfo.testids) || []))
    console.log('下拉清单：' + JSON.stringify(combos || []))
    client.ws.close()
    process.exit(pass === Object.keys(out).length ? 0 : 1)
  } catch (e) {
    console.error('ERR', e.message)
    for (const [k, v] of Object.entries(out)) console.log((v ? 'PASS ' : 'FAIL ') + k + ' => ' + v)
    if (client) client.ws.close()
    process.exit(2)
  }
})()
