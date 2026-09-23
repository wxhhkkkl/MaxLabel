/* 选项(O) / 账户(A) 菜单项集与「登录...」可达性回归（round-132，DIFF-80/81/82）。
 *
 * 依据（都是**安装包资源原文**，不是猜测）：
 *  - 真机 `C:\Program Files (x86)\LabelShop\LabelShop\LabelShop.exe` 的**菜单字符串表**（UTF-16LE，偏移 17401836）：
 *      `选项(O)` | `系统选项(C)...` | `应用程序外观(A)` | `蓝色样式(B)` `黑色样式(L)` `银色样式(S)` `水绿色样式(A)`
 *      | `电子称` | `窗口(W)` | `新建窗口(N)` | `帮助(H)` | `帮助主题(H)` | …
 *    → 选项菜单 = 三项（`系统选项(C)...` / `应用程序外观(A) ▸` / `电子称`），且 **`电子称` 没有加速键**（资源里没有 `&X`）。
 *  - 帮助 `menu_option.html`：「选项菜单用于系统设置及电子称配置操作 … 电子秤 显示 电子称配置对话框」
 *    （帮助正文写「电子秤」，但页面标题与安装包字符串都写「电子称」；**界面文案以安装包为准 = `电子称`**）。
 *  - 帮助 `menu_help.html`：「登录 显示 签赋LabelShop 登录窗口」——原版 `账户(A)→登录...` 会打开**应用内**登录窗口。
 *
 * 两条处置口径（写进 `parity/diffs.md`）：
 *  - DIFF-81：`电子称` 与真机菜单资源逐字一致 → **保留**；本机真机运行态未显示该项，
 *    判为**按硬件/配置条件显示**（该机未接电子称），非「真机无此项」。
 *  - DIFF-82：复刻版 `登录...` 走「打开云服务窗口」，与原版的应用内登录窗口不同；无服务器时原先**静默无反应**，
 *    现改为把失败写进状态栏（`status-bar` 的 title），并登记为「原版有但受限」。
 */
const http = require('http')
const WebSocket = require('ws')

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
      const message = JSON.parse(raw.toString()); const item = pending.get(message.id)
      if (!item) return
      pending.delete(message.id); if (message.error) item.rej(new Error(message.error.message)); else item.res(message.result)
    })
    ws.on('open', () => resolve({ ws, send })); ws.on('error', reject)
  })
}

;(async () => {
  let client
  const results = {}
  try {
    const port = process.env.MAXLABEL_DEBUG_PORT || 9222
    const pages = await getJson(`http://127.0.0.1:${port}/json/list`); const page = pages.find((item) => item.type === 'page')
    if (!page) throw new Error('no main page')
    client = await attach(page.webSocketDebuggerUrl)
    const evaluate = async (expression) => {
      const result = await client.send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true })
      if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description || result.exceptionDetails.text)
      return result.result?.value
    }
    const openMenu = async (title) => {
      await evaluate(`(() => { const t=document.querySelector('[data-menu-title=${JSON.stringify(title)}]'); if(!t) return false; t.click(); return true })()`)
      await sleep(220)
    }
    /** 当前展开菜单里**可见**的菜单项（同时只有一个顶层菜单展开，子菜单未展开时不渲染）。 */
    const visibleItems = () => evaluate(`(() => [...document.querySelectorAll('[data-menu-item]')]
      .filter((e) => e.offsetParent)
      .map((e) => ({ label: e.getAttribute('data-menu-item'), disabled: e.getAttribute('data-menu-disabled') === 'true' })))()`)

    // ---- DIFF-81：选项(O) 菜单三项且与安装包菜单资源逐字一致 ----
    await openMenu('选项(O)')
    const opts = await visibleItems()
    const optLabels = Array.isArray(opts) ? opts.map((it) => it.label) : null
    results['DIFF-81 选项(O) 菜单项与安装包菜单资源逐字一致（系统选项(C)... / 应用程序外观(A) / 电子称）'] =
      JSON.stringify(optLabels) === JSON.stringify(['系统选项(C)...', '应用程序外观(A)', '电子称'])
    results['DIFF-81 「电子称」项无加速键（真机菜单资源中该项写作 `电子称`，无 (X)）'] =
      Array.isArray(opts) && opts.some((it) => it.label === '电子称' && !/\(&?[A-Za-z]\)/.test(it.label))
    results['DIFF-81 「电子称」项可用（未被禁用）'] =
      Array.isArray(opts) && opts.some((it) => it.label === '电子称' && it.disabled === false)

    // 点「电子称」应按帮助 menu_option.html「电子秤 显示 电子称配置对话框」打开对话框。
    const clicked = await evaluate(`(() => { const e=[...document.querySelectorAll('[data-menu-item]')].find((c)=>c.offsetParent && (c.textContent||'').trim()==='电子称'); if(!e) return false; e.click(); return true })()`)
    await sleep(320)
    const weighOpen = await evaluate(`(() => { const t=document.body.innerText||''; return t.includes('电子称对接功能') && t.includes('波特率') })()`)
    results['DIFF-81 点「电子称」打开电子称配置对话框（帮助 menu_option.html 原文）'] = Boolean(clicked) && Boolean(weighOpen)
    if (weighOpen) { await evaluate(`(() => { const b=[...document.querySelectorAll('button')].find((x)=>(x.textContent||'').trim()==='取消' && x.offsetParent); b?.click(); return true })()`); await sleep(200) }

    // ---- DIFF-82：无服务器时「账户(A)→登录...」不得静默无反应 ----
    await openMenu('账户(A)')
    const acct = await visibleItems()
    const acctLabels = Array.isArray(acct) ? acct.map((it) => it.label) : null
    results['DIFF-82 账户(A) 菜单含安装包资源里的「登录...」（帮助 menu_help.html：显示登录窗口）'] =
      Array.isArray(acctLabels) && acctLabels.includes('登录...')
    // 为避免受「本机是否正好跑着云服务端」影响，先把服务器地址指到一个**必然不可达**的端口，
    // 再点「登录...」；此时必须留下可见反馈（status-bar 的 title），不能静默无反应。
    await evaluate(`(() => { localStorage.setItem('maxlabel_server_url','http://127.0.0.1:9'); return true })()`)
    await evaluate(`(() => { const t=document.querySelector('[data-testid=status-bar]'); if(t) t.title='__CLEARED__'; return true })()`)
    const loginClicked = await evaluate(`(() => { const e=[...document.querySelectorAll('[data-menu-item]')].find((c)=>c.offsetParent && (c.textContent||'').trim()==='登录...'); if(!e) return false; e.click(); return true })()`)
    await sleep(2500)
    const statusAfter = await evaluate(`document.querySelector('[data-testid=status-bar]')?.title ?? ''`)
    results['DIFF-82 服务器不可达时点「登录...」不静默：状态栏给出失败反馈（原版为应用内登录窗口）'] =
      Boolean(loginClicked) && statusAfter !== '__CLEARED__' && /无法连接云服务器|无法打开云服务窗口|地址无效|未配置/.test(statusAfter)
    await evaluate(`(() => { localStorage.removeItem('maxlabel_server_url'); return true })()`)
  } catch (error) {
    results['脚本执行'] = 'ERR ' + (error && error.message ? error.message : String(error))
  } finally {
    try { client?.ws?.close() } catch { /* 忽略关闭异常 */ }
  }
  let failed = 0
  for (const [name, value] of Object.entries(results)) {
    const ok = value === true
    if (!ok) failed++
    console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${ok ? '' : ' -> ' + JSON.stringify(value)}`)
  }
  console.log(`${Object.keys(results).length - failed}/${Object.keys(results).length} PASS`)
  process.exit(failed === 0 ? 0 : 1)
})()
