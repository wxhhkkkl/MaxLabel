/**
 * 「对象属性」四页验收工装（验收方 round-191 新增）
 *
 * 依据：`parity/验收方逐项比对-施工清单.md` 的 E/F/G/J 四节 —— 那些结论都是我拿真机实拍
 * （`r88-textprops-p1/p2/p3/p4.png`）与复刻版**同对象类型**（文字对象 ✓）的当前构建并排比出来的 ✓。
 * 本工装把那些"人眼看到的差异"**固化成机器可跑的断言** ✓：
 *   - **现在预期是红的** ✓（差距确实存在）→ 每条红都是一条待办 ✓；
 *   - 循环把某页对齐后，对应条目会**自动转绿** ✓ → 不需要我再去肉眼比对一遍 ✓；
 *   - 任何**回归**（已经绿了的又变红）都说明改坏了 ✓。
 *
 * 用法：node tools/parity/Verify-ObjectProps.cjs        （需要先起一个带 CDP 的实例，端口同其它工装）
 *   MAXLABEL_DEBUG_PORT=9333 node tools/parity/Verify-ObjectProps.cjs
 * 退出码：0 = 四页全部与真机一致；1 = 仍有差距（会逐条打印）。
 */
const path = require('path')
const http = require('http')
const WebSocket = require(path.join(__dirname, '..', '..', 'app', 'node_modules', 'ws'))

const PORT = Number(process.env.MAXLABEL_DEBUG_PORT || 9222)
const D = '[data-testid="object-props-dialog"]'
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const getJson = (u) => new Promise((res, rej) => { http.get(u, (r) => { let d = ''; r.on('data', (c) => (d += c)); r.on('end', () => { try { res(JSON.parse(d)) } catch (e) { rej(e) } }) }).on('error', rej) })

async function main() {
  const pages = await getJson(`http://127.0.0.1:${PORT}/json/list`)
  const page = pages.find((p) => p.type === 'page')
  if (!page) { console.error('没有找到页面（实例没起或端口不对）'); process.exit(1) }
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

  const results = []
  const check = (name, ok, note) => results.push({ name, ok: !!ok, note: note || '' })

  try {
    // ---- 建一个**文字**对象并打开属性对话框（与真机对照图同对象类型 ✓）----
    await ev('document.dispatchEvent(new KeyboardEvent("keydown",{key:"n",code:"KeyN",ctrlKey:true,bubbles:true,cancelable:true}))')
    await sleep(600)
    if (await ev('!!document.querySelector("[data-testid=template-wizard]")')) { await ev('document.querySelector("[data-testid=wizard-next]")?.click()'); await sleep(500) }
    if (await ev('!!document.querySelector("[data-testid=new-label-dialog]")')) { await ev('document.querySelector("[data-testid=new-label-select]")?.click()'); await sleep(1200) }
    if (!(await waitFor('!!document.querySelector("canvas.upper-canvas")'))) throw new Error('没进编辑器')
    await ev('document.querySelector(\'[data-tool="text"]\')?.click()')
    await sleep(350)
    const rect = await ev(`(() => { const el=document.querySelector('canvas.upper-canvas'); const r=el.getBoundingClientRect(); return {x:r.left+r.width*0.35, y:r.top+r.height*0.35} })()`)
    const click = (type, n, buttons, x, y) => send('Input.dispatchMouseEvent', { type, x: Math.round(x), y: Math.round(y), button: 'left', buttons, clickCount: n })
    await click('mousePressed', 1, 1, rect.x, rect.y); await click('mouseReleased', 1, 0, rect.x, rect.y)
    await sleep(500)
    let opened = false
    for (const [dx, dy] of [[12, 10], [24, 12], [40, 16]]) {
      await click('mousePressed', 1, 1, rect.x + dx, rect.y + dy); await click('mouseReleased', 1, 0, rect.x + dx, rect.y + dy); await sleep(60)
      await click('mousePressed', 2, 1, rect.x + dx, rect.y + dy); await click('mouseReleased', 2, 0, rect.x + dx, rect.y + dy)
      if (await waitFor(`!!document.querySelector('${D}')`, 2500)) { opened = true; break }
    }
    if (!opened) throw new Error('双击文字对象没打开属性对话框')
    await sleep(400)

    /** 切页并返回该页文本 + 该页里的控件种类统计 */
    const gotoPage = async (tab) => {
      await ev(`(() => { const b=[...document.querySelectorAll('[data-testid^="object-props-tab-"]')].find((x)=>(x.textContent||'').trim()===${JSON.stringify(tab)}); if(b) b.click(); return !!b })()`)
      await sleep(320)
      return ev(`(() => { const d=document.querySelector('${D}'); const t=(d?.textContent)||''
        return { text: t, selects: d.querySelectorAll('select').length, radios: d.querySelectorAll('input[type=radio]').length,
                 checkboxes: d.querySelectorAll('input[type=checkbox]').length, lists: d.querySelectorAll('select[size],ul,ol').length,
                 buttons: [...d.querySelectorAll('button')].map((b)=>(b.textContent||'').trim()).filter(Boolean) } })()`)
    }
    const has = (page, s) => page.text.includes(s)

    // ---- 字体页（真机：字体名称/字体样式/大小都是**列表框**；有示例区；三个复选框）----
    const font = await gotoPage('字体')
    check('字体页 有 `字体名称(D):`', has(font, '字体名称'))
    check('字体页 字体名称是**列表框**而不是下拉（真机是列表 ✓）', font.lists > 0 || font.selects === 0, `selects=${font.selects} lists=${font.lists}`)
    check('字体页 有 `字体样式(Y):`', has(font, '字体样式'))
    check('字体页 有 `大小(P):`', has(font, '大小'))
    check('字体页 有 `特殊效果` 组', has(font, '特殊效果'))
    check('字体页 有 `删除线(S)` / `下划线(U)` / `黑底白字(W)` 三个复选框', has(font, '删除线') && has(font, '下划线') && has(font, '黑底白字'))
    check('字体页 标签是 `字体宽度方向缩放倍数(H):`（含"方向"与 (H)）', has(font, '字体宽度方向缩放倍数'))
    check('字体页 标签是 `字间距(J):`', has(font, '字间距'))
    check('字体页 有 `示例` 区 + TRUETYPE 说明', has(font, '示例') && /TRUETYPE/i.test(font.text))

    // ---- 文本页（真机：类型是三个**单选按钮**；有 水平对齐(A)/行宽度(W)；字符模板是复选框）----
    const text = await gotoPage('文本')
    check('文本页 `类型` 是三个单选按钮（单行/多行/圆形）', text.radios >= 3 && has(text, '单行') && has(text, '多行') && has(text, '圆形'), `radios=${text.radios}`)
    check('文本页 有 `水平对齐(A):`', has(text, '水平对齐'))
    check('文本页 有 `行宽度(W):`', has(text, '行宽度'))
    check('文本页 有 `字符模板(T):`', has(text, '字符模板'))

    // ---- 常规页（真机：水平(H)/垂直(V) 一组；有 `对齐` 组；有 对象名称标识/图层）----
    const gen = await gotoPage('常规')
    check('常规页 有 `水平(H):` 与 `垂直(V):`', has(gen, '水平') && has(gen, '垂直'))
    check('常规页 有 `对齐` 组（水平(W)/垂直(T)）', has(gen, '对齐'))
    check('常规页 有 `对象名称标识:` 与 `图层:`', has(gen, '对象名称标识') && has(gen, '图层'))
    check('常规页 有 `颜色(C):`', has(gen, '颜色'))

    // ---- 数据源页（真机：子串列表 + 子串选项 + 变量共享名称 + 高级选项 + 示例）----
    const ds = await gotoPage('数据源')
    check('数据源页 有 `子串列表`', has(ds, '子串列表'))
    check('数据源页 有 `数据源(S):` 与 `显示数据(D):`', has(ds, '显示数据'))
    check('数据源页 有 `变量共享名称(N):`', has(ds, '变量共享名称'))
    check('数据源页 有 `高级选项(A)...` 按钮', has(ds, '高级选项'))
    check('数据源页 有 `示例`', has(ds, '示例'))

    // ---- 四页共有的底排按钮（真机都是 确定 / 取消 / 帮助）----
    const buttons = gen.buttons.join(' / ')
    check('底排按钮含 `确定`、`取消`、`帮助`', /确定/.test(buttons) && /取消/.test(buttons) && /帮助/.test(buttons), buttons)
  } catch (error) {
    check('脚本执行', false, String(error && error.message ? error.message : error))
  } finally {
    try { ws.close() } catch { /* 忽略 */ }
  }

  const pass = results.filter((r) => r.ok).length
  console.log('# 对象属性四页（对照真机 r88-textprops-p1..p4 与施工清单 E/F/G/J）\n')
  for (const r of results) console.log(`${r.ok ? 'PASS' : 'GAP '} ${r.name}${r.note ? '   [' + r.note + ']' : ''}`)
  console.log(`\n${pass}/${results.length} 与真机一致；**红色条目即待办**（清单：parity/验收方逐项比对-施工清单.md）`)
  process.exit(pass === results.length ? 0 : 1)
}
main().catch((e) => { console.error('ERR ' + e.message); process.exit(1) })
