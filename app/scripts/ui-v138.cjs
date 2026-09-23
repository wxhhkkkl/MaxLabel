/*
 * 菜单项集与顺序对标真机弹菜单实拍（round-133）—— 工具(T) / 账户(A) / 云马通(C) / 窗口(W)。
 *
 * 出处（优先级：真机截图 > 帮助 > 代码注释）：
 *   - `parity/reference/labelshop/r162-menu-03-tool.png`（真机「工具(T)」弹菜单实拍）
 *   - `parity/reference/labelshop/r162-menu-06-account.png`（真机「账户(A)」弹菜单实拍）
 *   - `parity/reference/labelshop/r162-menu-07-cloud.png`（真机「云马通(C)」弹菜单实拍）
 *   - `parity/reference/labelshop/r162-menu-09-window.png`（真机「窗口(W)」弹菜单实拍）
 *   - 真机 exe `LabelShop.exe` 的**菜单资源字符串表**（UTF-16LE，偏移 ~17399000–17404000）逐字复核
 *   - 并排图 `parity/review/cmp-menu-tool-r162.png` / `-account-` / `-cloud-` / `-window-`
 *
 * 本轮修掉的两处真差异：
 *   ① 工具(T)：真机是 `图片(P) → 数据(D) → 表格(G)`，复刻版原先按帮助 `menu_tools.html` 写成「表格」在前；
 *   ② 工具(T)：真机菜单**没有 RFID**（菜单资源 + 弹菜单实拍双重证据）→ 复刻版移除该菜单项，
 *      但 RFID 能力保留（创建入口在主工具栏的 RFID 按钮），不是静默删功能。
 * 另登记：`parity/diffs.md` DIFF-80 的 `账户(A) → 服务器...` —— 真机菜单资源里有该串，
 *   但真机**运行时不显示**（`r162-menu-06-account.png` 只有 5 项）⇒ 按「原版有但运行时不显示」收口，复刻版不实现。
 */
const http = require('http')
const WebSocket = require('ws')

/** 真机 exe 菜单资源 `工具(&T)` 段逐字（本轮从 LabelShop.exe 读出，与 r162-menu-03-tool.png 一致）。 */
const TOOL_MENU = ['选取(S)', '条码(B)', '文字(T)', '线条(L)', '斜线(L)', '矩形(R)', '图片(P)', '数据(D)', '表格(G)', '放大(I)', '缩小(O)', '适应宽度', '适应高度', '适合窗口(W)']
/** 真机 r162-menu-06-account.png 逐项（5 项，**无 `服务器...`**）。 */
const ACCOUNT_MENU = ['登录...', '注销...', '账号和授权管理...', '试用管理...', '演示和体验...']
/** 真机 r162-menu-07-cloud.png 逐项。 */
const CLOUD_MENU = ['首页', '云标签模板库', '云数据库', '云图片库', '云网页库']

function getJson(url) {
  return new Promise((resolve, reject) => {
    http.get(url, (res) => {
      let data = ''
      res.on('data', (chunk) => { data += chunk })
      res.on('end', () => { try { resolve(JSON.parse(data)) } catch (error) { reject(error) } })
    }).on('error', reject)
  })
}
function sleep(ms) { return new Promise((resolve) => setTimeout(resolve, ms)) }
function attach(wsUrl) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(wsUrl)
    let id = 0
    const pending = new Map()
    const send = (method, params = {}) => new Promise((res, rej) => {
      const messageId = ++id
      pending.set(messageId, { res, rej })
      ws.send(JSON.stringify({ id: messageId, method, params }))
    })
    ws.on('message', (raw) => {
      const message = JSON.parse(raw.toString())
      const item = pending.get(message.id)
      if (!item) return
      pending.delete(message.id)
      if (message.error) item.rej(new Error(message.error.message))
      else item.res(message.result)
    })
    ws.on('open', () => resolve({ ws, send }))
    ws.on('error', reject)
  })
}

;(async () => {
  let client
  const results = {}
  try {
    const port = process.env.MAXLABEL_DEBUG_PORT || 9222
    const pages = await getJson(`http://127.0.0.1:${port}/json/list`)
    const page = pages.find((item) => item.type === 'page')
    if (!page) throw new Error('no main page')
    client = await attach(page.webSocketDebuggerUrl)
    const evaluate = async (expression) => {
      const result = await client.send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true })
      if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description || result.exceptionDetails.text)
      return result.result?.value
    }
    const click = (selector) => evaluate(`(() => { const e=document.querySelector(${JSON.stringify(selector)}); if(!e || e.disabled)return false; e.click(); return true })()`)
    const pressKey = (k, o = {}) => evaluate(`(() => { const e=new KeyboardEvent('keydown',${JSON.stringify({ key: k, code: k, bubbles: true, cancelable: true, ...o })}); window.dispatchEvent(e); return true })()`)
    const waitFor = async (expression, timeout = 9000) => {
      const started = Date.now()
      while (Date.now() - started < timeout) {
        if (await evaluate(expression)) return true
        await sleep(80)
      }
      return false
    }
    /** 展开顶层菜单，回读条目（含加速键文本与禁用态），再收起。 */
    const openMenu = async (title) => {
      await click(`[data-menu-title="${title}"]`)
      await sleep(160)
      const items = await evaluate(`[...document.querySelectorAll('[data-menu-item]')].map((e)=>({label:e.getAttribute('data-menu-item'),disabled:e.getAttribute('data-menu-disabled')==='true',shortcut:(e.querySelector('[data-menu-shortcut]')||{}).textContent||''}))`)
      await click(`[data-menu-title="${title}"]`)
      await sleep(100)
      return items || []
    }
    const labels = (items) => items.map((it) => it.label)

    await sleep(1800)
    await evaluate('document.querySelector("button[aria-label=关闭]")?.click()')
    await sleep(400)

    // 进入编辑态：菜单项在两种状态下项集相同，但工具类需文档态才可用。
    await pressKey('n', { ctrlKey: true }); await sleep(360)
    if (await evaluate('!!document.querySelector("[data-testid=template-wizard]")')) {
      await click('[data-testid="wizard-next"]'); await sleep(320)
    }
    await click('[data-testid="new-label-select"]')
    if (!await waitFor('!!document.querySelector("canvas.upper-canvas")')) throw new Error('editor did not open')
    await sleep(360)

    // ---------- ① 工具(T)：与真机菜单资源逐项全等，且不含 RFID ----------
    const tool = await openMenu('工具(T)')
    results['工具(T) 菜单与真机菜单资源逐项全等（选取(S)…适合窗口(W)，数据(D) 在 表格(G) 之前）'] =
      JSON.stringify(labels(tool)) === JSON.stringify(TOOL_MENU)
    results['工具(T) 菜单不含真机没有的 RFID 项（DIFF-65 收口）'] = !labels(tool).includes('RFID')
    results['工具(T) 菜单「数据(D)」排在「表格(G)」之前（真机 r162-menu-03-tool.png）'] =
      labels(tool).indexOf('数据(D)') > -1 && labels(tool).indexOf('数据(D)') === labels(tool).indexOf('表格(G)') - 1
    const rfidToolbar = await evaluate(`!!document.querySelector('[data-testid="toolbar"] button[data-tool="rfid"]')`)
    results['RFID 能力未丢：工具栏仍有 RFID 创建按钮（移除的只是菜单项）'] = rfidToolbar === true

    // ---------- ② 账户(A)：真机运行时不显示 `服务器...` ----------
    const account = await openMenu('账户(A)')
    results['账户(A) 菜单与真机 r162-menu-06-account.png 逐项全等（登录…演示和体验，无 服务器...）'] =
      JSON.stringify(labels(account)) === JSON.stringify(ACCOUNT_MENU)
    results['账户(A) 菜单不含运行时不可见的 `服务器...`（DIFF-80：菜单资源里有、真机运行时不显示 → 不实现）'] =
      !labels(account).some((l) => l.startsWith('服务器'))
    const accountEnabled = Object.fromEntries(account.map((it) => [it.label, !it.disabled]))
    results['账户(A) 未登录时只有「登录...」「演示和体验...」可用（真机同图：注销/账号和授权管理/试用管理 为灰）'] =
      accountEnabled['登录...'] === true && accountEnabled['演示和体验...'] === true &&
      accountEnabled['注销...'] === false && accountEnabled['账号和授权管理...'] === false && accountEnabled['试用管理...'] === false

    // ---------- ③ 云马通(C)：五项顺序逐项全等 ----------
    const cloud = await openMenu('云马通(C)')
    results['云马通(C) 菜单与真机 r162-menu-07-cloud.png 逐项全等（首页/云标签模板库/云数据库/云图片库/云网页库）'] =
      JSON.stringify(labels(cloud)) === JSON.stringify(CLOUD_MENU)
    const cloudEnabled = Object.fromEntries(cloud.map((it) => [it.label, !it.disabled]))
    results['云马通(C) 未登录时只有「首页」可用（真机同图其余四项为灰）'] =
      cloudEnabled['首页'] === true && CLOUD_MENU.slice(1).every((l) => cloudEnabled[l] === false)

    // ---------- ④ 窗口(W)：真机无「层叠/平铺/排列图标」（帮助 menu_windows.html 的过时段落） ----------
    const win = await openMenu('窗口(W)')
    const winLabels = labels(win)
    results['窗口(W) 菜单不含「层叠」「平铺」「排列图标」（真机 r162-menu-09-window.png 只有 新建窗口 + 窗口列表）'] =
      !winLabels.some((l) => l.includes('层叠') || l.includes('平铺') || l.includes('排列图标'))
    results['窗口(W) 菜单含「新建窗口(N)」且按序号列出已打开文档'] =
      winLabels.includes('新建窗口(N)') && winLabels.some((l) => /^\d+\s/.test(l))
  } catch (error) {
    results[`fatal: ${error && error.message ? error.message : error}`] = false
  } finally {
    if (client) client.ws.close()
  }
  let failed = 0
  for (const [name, value] of Object.entries(results)) {
    if (value) console.log(`PASS ${name}`)
    else { failed += 1; console.log(`FAIL ${name}`) }
  }
  console.log(`\n${Object.keys(results).length - failed}/${Object.keys(results).length} PASS\n`)
  if (failed > 0) process.exitCode = 1
})()
