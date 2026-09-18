/*
 * 启始页菜单栏与真机一致：**顶层菜单与编辑态同为 12 个**。
 *
 * 出处：真机启始页截图 `parity/reference/labelshop/probe-01-newlabel.png`（2026-09-18 本轮采集）
 *       菜单栏为 文件(F) 编辑(E) 查看(V) 工具(T) 排列(A) 数据库(D) 账户(A) 云马通(C)
 *       选项(O) 窗口(W) 帮助(H) 建议与反馈 —— 12 个，与编辑态 `40-editor.png` 完全一致；
 *       差别只在「文件(F)」换成启始页专用条目、其余菜单里依赖文档的条目变灰。
 *
 * 修复前实测（打包版 v1.0.2 首次冒烟 `ui-smoke.cjs` 的「menubar 12 menus」失败）：
 *   startMenus() 里只挑了 查看/账户/云马通/选项/帮助/建议与反馈 六个 section 拼给启始页，
 *   运行期 `[data-menu-title]` 只有 7 项（文件(F) 查看(V) 账户(A) 云马通(C) 选项(O) 帮助(H) 建议与反馈），
 *   比真机少 编辑(E)、工具(T)、排列(A)、数据库(D)、窗口(W) 五项。
 *
 * 断言：
 *   1) 启始页顶层菜单恰好 12 个，标题与顺序同真机；
 *   2) 启始页「编辑(E)」「工具(T)」展开后条目全部为禁用（真机这些项在无文档时变灰）；
 *   3) 启始页「数据库(D)」里「设置数据库(D)...」存在且禁用；
 *   4) 启始页「窗口(W)」里「新建窗口(N)」存在且禁用；
 *   5) 启始页「文件(F)」是启始页专用列表（含「新建条幅飘带」、不含「保存(S)」）；
 *   6) 新建标签模板进入编辑态后，顶层菜单序列与启始页完全一致（12 项同序）；
 *   7) 编辑态「工具(T)」里「条码(B)」不再禁用（与启始页的禁用态形成对照）。
 */
const http = require('http')
const WebSocket = require('ws')

const EXPECTED = ['文件(F)', '编辑(E)', '查看(V)', '工具(T)', '排列(A)', '数据库(D)', '账户(A)', '云马通(C)', '选项(O)', '窗口(W)', '帮助(H)', '建议与反馈']

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
    const waitFor = async (expression, timeout = 8000) => {
      const started = Date.now()
      while (Date.now() - started < timeout) {
        if (await evaluate(expression)) return true
        await sleep(80)
      }
      return false
    }
    /** 顶层菜单标题序列 */
    const menuTitles = () => evaluate(`[...document.querySelectorAll('[data-menu-title]')].map((e)=>e.getAttribute('data-menu-title'))`)
    /** 展开某个顶层菜单，回读其条目（{label, disabled}），再收起 */
    const openMenu = async (title) => {
      await click(`[data-menu-title="${title}"]`)
      await sleep(140)
      const items = await evaluate(`[...document.querySelectorAll('[data-menu-item]')].map((e)=>({label:e.getAttribute('data-menu-item'),disabled:e.getAttribute('data-menu-disabled')==='true'}))`)
      await click(`[data-menu-title="${title}"]`)
      await sleep(90)
      return items || []
    }
    const newTemplate = async () => {
      await pressKey('n', { ctrlKey: true }); await sleep(340)
      if (await evaluate('!!document.querySelector("[data-testid=template-wizard]")')) {
        await click('[data-testid="wizard-next"]'); await sleep(320)
      }
      await click('[data-testid="new-label-select"]')
      if (!await waitFor('!!document.querySelector("canvas.upper-canvas")', 9000)) throw new Error('editor did not open')
      await sleep(360)
    }

    await sleep(1800)
    await evaluate('document.querySelector("button[aria-label=关闭]")?.click()')
    await sleep(400)

    // ---------- 1) 启始页顶层菜单 12 项且顺序同真机 ----------
    const startTitles = await menuTitles()
    results['启始页顶层菜单恰好 12 个（修复前只有 7 个）'] = Array.isArray(startTitles) && startTitles.length === 12
    results['启始页顶层菜单标题与顺序同真机（文件(F)…建议与反馈）'] =
      JSON.stringify(startTitles) === JSON.stringify(EXPECTED)

    // ---------- 2) 启始页 编辑(E) / 工具(T) 条目全禁用 ----------
    const startEdit = await openMenu('编辑(E)')
    results['启始页「编辑(E)」展开后条目全部禁用（真机无文档时变灰）'] =
      startEdit.length > 0 && startEdit.every((it) => it.disabled)
    const startTool = await openMenu('工具(T)')
    results['启始页「工具(T)」展开后条目全部禁用（绘制工具需先有文档）'] =
      startTool.length > 0 && startTool.every((it) => it.disabled)

    // ---------- 3) 启始页 数据库(D) ----------
    const startDb = await openMenu('数据库(D)')
    const dbSet = startDb.find((it) => it.label === '设置数据库(D)...')
    results['启始页「数据库(D)」含「设置数据库(D)...」且禁用'] = !!dbSet && dbSet.disabled === true

    // ---------- 4) 启始页 窗口(W) ----------
    const startWin = await openMenu('窗口(W)')
    const winNew = startWin.find((it) => it.label === '新建窗口(N)')
    results['启始页「窗口(W)」含「新建窗口(N)」且禁用'] = !!winNew && winNew.disabled === true

    // ---------- 5) 启始页 文件(F) 是启始页专用列表 ----------
    const startFile = await openMenu('文件(F)')
    const startFileLabels = startFile.map((it) => it.label)
    results['启始页「文件(F)」为启始页专用列表（含「新建条幅飘带」、不含编辑态「保存(S)」）'] =
      startFileLabels.includes('新建条幅飘带') && !startFileLabels.includes('保存(S)')

    // ---------- 6) 编辑态顶层菜单序列同启始页 ----------
    await newTemplate()
    const editorTitles = await menuTitles()
    results['编辑态顶层菜单序列与启始页完全一致（12 项同序）'] =
      JSON.stringify(editorTitles) === JSON.stringify(EXPECTED)

    // ---------- 7) 编辑态 工具(T) 的「条码(B)」可用 ----------
    const editorTool = await openMenu('工具(T)')
    const barcodeItem = editorTool.find((it) => it.label === '条码(B)')
    results['编辑态「工具(T)」里「条码(B)」不再禁用（对照启始页禁用态）'] =
      !!barcodeItem && barcodeItem.disabled === false

    // 收尾：回到起始页，避免影响后续脚本
    await evaluate(`(() => {
      const tab=[...document.querySelectorAll('[data-testid=document-tab]')].find((e)=>String(e.getAttribute('data-document-title')).startsWith('新标签模板'))
      if(!tab) return false
      const b=tab.getBoundingClientRect()
      tab.dispatchEvent(new MouseEvent('contextmenu',{bubbles:true,cancelable:true,view:window,clientX:b.left+10,clientY:b.top+10}))
      return true
    })()`)
    await sleep(240)
    await click('[data-menu-item="关闭所有(A)"]')
    await sleep(600)

    let pass = 0
    for (const [name, value] of Object.entries(results)) { console.log((value ? 'PASS ' : 'FAIL ') + name + ' => ' + value); if (value) pass++ }
    console.log(`\n${pass}/${Object.keys(results).length} PASS`)
    client.ws.close()
    process.exit(pass === Object.keys(results).length ? 0 : 1)
  } catch (error) {
    console.error('ERR', error.message)
    for (const [name, value] of Object.entries(results)) console.log((value ? 'PASS ' : 'FAIL ') + name + ' => ' + value)
    if (client) client.ws.close()
    process.exit(2)
  }
})()
