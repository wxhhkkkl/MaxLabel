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
    // 真机下拉**逐项原文**（round-106 真机枚举，见 parity/reference/labelshop/probe-round106-custom-label-combos.txt）：
    //   形状 = 方角矩形 / 圆角矩形 / 圆形      ← 注意是「方角」不是「直角」
    //   孔洞 = 无 / 圆洞 / 矩形
    out['⑤b 形状下拉文本 = 方角矩形/圆角矩形/圆形'] = !!(shape && JSON.stringify(shape.opts) === JSON.stringify(['方角矩形', '圆角矩形', '圆形']))
    out['⑤b 孔洞下拉文本 = 无/圆洞/矩形'] = !!(hole && JSON.stringify(hole.opts) === JSON.stringify(['无', '圆洞', '矩形']))

    const btn = await evaluate(`(()=>{
      const d=document.querySelector('[data-testid="custom-label-dialog"]')
      if(!d) return {found:false}
      const bs=[...d.querySelectorAll('button')].filter((b)=>(b.textContent||'').trim().startsWith('应用'))
      return bs.length? {found:true, visible: bs[0].offsetParent!==null, disabled: bs[0].disabled} : {found:false}
    })()`)
    // 真机口径（2026-09-21 更正）：`应用(&A)` 在控件树里是 **`[ ]` 隐藏**，截图 `r107-hole-rect-20.png` 底部只有 确定/取消/帮助。
    // 所以正确形态是「没有可见的应用按钮」——不是"有且禁用"。这条断言先前写反了，会让复刻版多出一个真机没有的按钮还判过。
    out['⑥ 没有可见的「应用」按钮（真机为隐藏控件）'] = !(btn && btn.found && btn.visible)

    out['⑦ 预览行形如 100.00 x 70.00 毫米 [4行 2列]'] = /-?\d+\.\d{2}\s*x\s*-?\d+\.\d{2}\s*毫米\s*\[\s*\d+\s*行\s*\d+\s*列\s*\]/.test(text)
    out['⑧ 页内没有「圆角半径」字段'] = !/圆角半径/.test(text)

    // ⑨ 行为级检查：孔洞选「矩形」时**必须真的画出矩形切孔**（round-26 发现复刻版只加了下拉项、几何没实现；
    //    ui-v130 只断言了选项文本 ['无','圆洞','矩形']，选矩形后其实没有孔 —— 这条检查就是补这个洞）。
    const rectHole = await evaluate(`(()=>{
      const sel=document.querySelector('[data-testid="custom-label-hole"]')
      if(!sel) return { ok:false, why:'没有孔洞下拉' }
      const size=document.querySelector('[data-testid="custom-label-hole-size"]')
      const proto=Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype,'value').set
      proto.call(sel,'rectangle'); sel.dispatchEvent(new Event('change',{bubbles:true}))
      if(size){ const ip=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set; ip.call(size,'10'); size.dispatchEvent(new Event('input',{bubbles:true})); size.dispatchEvent(new Event('change',{bubbles:true})) }
      const svg=document.querySelector('[data-testid="custom-label-dialog"] svg')
      const d=svg?.querySelector('path')?.getAttribute('d')||''
      const subs=d.split('M').slice(1)
      const lineOnly=subs.filter((s)=>s && !/A/.test(s)).length   // 只有直线的子路径 = 矩形切孔
      return { ok: lineOnly>0 && size?.disabled===false, disabled: size?.disabled, subs: subs.length, lineOnly, d: d.slice(0,220) }
    })()`)
    out['⑨ 选「矩形」孔洞后真的出现矩形切孔且尺寸框可用'] = !!(rectHole && rectHole.ok)

    // ⑩ 真机 round-44 取证：`孔洞=圆洞` 且尺寸>0 时，**预览里真的画孔**（8 个卡片中心各有小圆，见
    //    parity/reference/labelshop/verifier-r44-hole-circle-20b.png）。复刻版必须同样画出**弧线切孔**，
    //    且尺寸=0 时不画孔（`无` 与 `尺寸 0` 都不画）——这条把真机的"会画孔"钉进回归。
    const circleHole = await evaluate(`(async()=>{
      const wait=(ms)=>new Promise((r)=>setTimeout(r,ms))
      const selOf=()=>document.querySelector('[data-testid="custom-label-hole"]')
      const sizeOf=()=>document.querySelector('[data-testid="custom-label-hole-size"]')
      if(!selOf()||!sizeOf()) return { ok:false, why:'缺控件' }
      const setv=(el,v,setter)=>{ setter.call(el,String(v)); el.dispatchEvent(new Event('input',{bubbles:true})); el.dispatchEvent(new Event('change',{bubbles:true})) }
      const sset=Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype,'value').set
      const iset=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set
      const read=()=>{ const svg=document.querySelector('[data-testid="custom-label-dialog"] svg'); const d=svg?.querySelector('path')?.getAttribute('d')||''; const subs=d.split('M').slice(1); return { subs: subs.length, outlineArc: subs[0]?/A/.test(subs[0]):false, cutArc: subs[1]?/A/.test(subs[1]):false, d: d.slice(0,200) } }
      // 关键三条：① 改完字段要**等 React 重渲染**再读；② **每次操作前重新取元素**（重渲染后旧引用可能脱离文档）；
      // ③ 判"有没有孔"要看**子路径条数**与**第二条子路径**——轮廓本身是圆角矩形、天然含弧，
      //    所以"整条 d 不含弧"这种判法永远不成立（round-62 实测：这条曾让 ⑩ 假红一次）。
      const sel0=selOf(); sset.call(sel0,'circle'); sel0.dispatchEvent(new Event('change',{bubbles:true})); await wait(200)
      setv(sizeOf(),'20',iset); await wait(350)
      const withHole=read()
      setv(sizeOf(),'0',iset); await wait(350)
      const zeroHole=read()
      return { ok: withHole.subs===2 && withHole.cutArc===true && zeroHole.subs===1, withHole, zeroHole }
    })()`)
    out['⑩ 选「圆洞」尺寸>0 时预览画弧线切孔、尺寸=0 时不画'] = !!(circleHole && circleHole.ok)
    if (!(circleHole && circleHole.ok)) console.log('DEBUG ⑩', JSON.stringify(circleHole))

    /* ⑪ round-112 新增（DIFF-73）：预览必须画**整张拼版**（列数×行数 个格子，每格正中带序号 1..N，先行后列）。
     *   真机证据：parity/review/cmp-custom-r114.png 左半（真机 4行×2列=8 格带编号）。
     *   判据只认 DOM：预览 svg 里"内容为纯整数的 <text>"= 格子序号，集合必须恰好是 {1..cols*rows}。 */
    const grid = await evaluate(`(() => {
      const d = document.querySelector('[data-testid="custom-label-dialog"]'); if (!d) return null
      const cols = Number((d.querySelector('[data-testid="new-label-custom-cols"]')||{}).value || 0)
      const rows = Number((d.querySelector('[data-testid="new-label-custom-rows"]')||{}).value || 0)
      const prev = d.querySelector('[data-testid="custom-label-preview"]'); if (!prev) return null
      const texts = [...prev.querySelectorAll('text')].map((t)=>(t.textContent||'').trim()).filter((s)=>/^[0-9]+$/.test(s)).map(Number)
      const uniq = [...new Set(texts)].sort((a,b)=>a-b)
      const expect = Array.from({length: cols*rows}, (_,i)=>i+1)
      return { cols, rows, uniq, expect, ok: JSON.stringify(uniq)===JSON.stringify(expect) }
    })()`)
    out['⑪ 预览画整张拼版：格子序号 = {1..列数×行数}（真机 4×2=8 格带编号）'] = !!(grid && grid.ok)
    if (!(grid && grid.ok)) console.log('DEBUG ⑪', JSON.stringify(grid))

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
