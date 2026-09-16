/* E-11 / E-12 升级检查：启动自动检查更新 + 帮助菜单「查找更新版本」。
 * 依据帮助 `install_upgrade.html`：
 *   - 签赋LabelShop 启动时会自动检查更新程序，有新的版本会自动给出更新提示；
 *   - 也可通过「帮助」菜单的「查找更新版本」查询是否有新版本，按提示下载更新。
 * 覆盖：菜单项可用并如实回报（有新版本 / 已最新 / 取不到清单三种结果），
 *       启动自动检查有新版才提示、失败静默不打扰。
 * 清单来源沿用「系统选项 → 云服务器地址」下的 `/api/version`，测试用本机清单服务器供给。 */
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

/** 本机版本清单服务器：返回固定 manifest，并记录被请求的路径。 */
function serve(body, status = 200) {
  const hits = []
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      hits.push(req.url)
      res.writeHead(status, { 'Content-Type': 'application/json' })
      res.end(body)
    })
    server.listen(0, '127.0.0.1', () => resolve({ server, port: server.address().port, hits }))
  })
}
/** 占一个端口后立刻释放：用它来模拟「连不上更新服务器」。 */
function deadPort() {
  return new Promise((resolve) => {
    const server = http.createServer(() => {})
    server.listen(0, '127.0.0.1', () => {
      const port = server.address().port
      server.close(() => resolve(port))
    })
  })
}

;(async () => {
  let client
  let live
  const servers = []
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
    const waitFor = async (expression, timeout = 4000) => {
      const started = Date.now()
      while (Date.now() - started < timeout) {
        if (await evaluate(expression)) return true
        await sleep(80)
      }
      return false
    }
    const pressEscape = () => evaluate(`(() => { const e=new KeyboardEvent('keydown',{key:'Escape',bubbles:true,cancelable:true}); window.dispatchEvent(e); document.dispatchEvent(e); return true })()`)
    const dialogText = () => evaluate(`(document.querySelector('[data-testid=update-dialog]')||{}).innerText || ''`)
    const updateDialogOpen = () => evaluate(`!!document.querySelector('[data-testid=update-dialog]')`)
    const menuLabels = () => evaluate(`[...document.querySelectorAll('[data-menu-item]')].filter((e)=>e.offsetParent).map((e)=>e.getAttribute('data-menu-item'))`)
    const openMenu = async (title) => {
      await evaluate(`(() => { const b=document.querySelector('[data-menu-title=${JSON.stringify(title)}]'); if(!b) return false; if(!b.parentElement.querySelector('[data-menu-item],[data-menu-divider]')) b.click(); return true })()`)
      await sleep(180)
      return menuLabels()
    }
    const closeHelpMenu = async () => {
      await evaluate(`(() => { const b=document.querySelector('[data-menu-title="帮助(H)"]'); if(b && b.parentElement.querySelector('[data-menu-item]')) b.click(); return true })()`)
      await sleep(150)
    }
    const openHelpMenu = async () => {
      // 菜单已展开时先收起来，保证每次点击都真的走一遍菜单回调。
      await closeHelpMenu()
      await sleep(60)
      return openMenu('帮助(H)')
    }
    const clickUpdateItem = async () => {
      await openHelpMenu()
      const ok = await click('[data-menu-item="查找更新版本"]')
      await sleep(200)
      return ok
    }
    const setServerUrl = (url) => evaluate(`(() => { localStorage.setItem('maxlabel_server_url', ${JSON.stringify(url)}); localStorage.setItem('maxlabel.firstRun','1'); return true })()`)
    const reload = async () => {
      await client.send('Page.reload', { ignoreCache: true })
      await sleep(2200)
    }
    const closeUpdateDialog = async () => { await pressEscape(); await sleep(250) }

    await sleep(1800)
    await evaluate('document.querySelector("button[aria-label=关闭]")?.click()')
    await evaluate(`(() => { localStorage.setItem('maxlabel.firstRun','1'); return true })()`)

    // ============ E-12 帮助菜单入口 ============
    const helpLabels = await openMenu('帮助(H)')
    results['E-12 帮助菜单含「查找更新版本」且未禁用'] =
      helpLabels.includes('查找更新版本') && (await evaluate(`(() => { const e=[...document.querySelectorAll('[data-menu-item]')].find((x)=>x.offsetParent&&x.getAttribute('data-menu-item')==='查找更新版本'); return e? e.getAttribute('data-menu-disabled')!=='true' : false })()`))
    await closeHelpMenu()

    // ============ 有新版本 ============
    live = await serve(JSON.stringify({ version: '9.9.9', url: 'https://example.com/maxlabel-setup.exe', notes: '修复了一批问题' }))
    servers.push(live.server)
    const dead = await deadPort()

    await setServerUrl(`http://127.0.0.1:${live.port}`)
    await clickUpdateItem()
    const opened = await waitFor('!!document.querySelector("[data-testid=update-dialog]")')
    results['E-12 点击「查找更新版本」打开查找更新版本对话框'] = opened
    results['E-12 有新版本时显示新版本号与更新说明'] = await waitFor(`(document.querySelector('[data-testid=update-dialog]')||{}).innerText?.includes('9.9.9')`)
    const textUpdate = await dialogText()
    results['E-12 有新版本时显示当前版本号 0.1.0'] = textUpdate.includes('0.1.0')
    results['E-12 有新版本时显示更新说明原文'] = textUpdate.includes('修复了一批问题')
    results['E-12 有新版本时提供「立即更新」按钮'] = await evaluate(`!!document.querySelector('[data-testid=update-download]')`)
    results['E-12 检查走云服务器地址下的 /api/version'] = live.hits.includes('/api/version')
    await closeUpdateDialog()
    results['E-12 关闭后对话框消失'] = !(await updateDialogOpen())

    // ============ 已是最新 ============
    const same = await serve(JSON.stringify({ version: '0.1.0' }))
    servers.push(same.server)
    await setServerUrl(`http://127.0.0.1:${same.port}`)
    await clickUpdateItem()
    results['E-12 无新版本时提示当前已是最新版本'] =
      await waitFor(`(document.querySelector('[data-testid=update-dialog]')||{}).innerText?.includes('当前已是最新版本')`) &&
      (await dialogText()).includes('0.1.0')
    results['E-12 无新版本时不出现「立即更新」按钮'] = !(await evaluate(`!!document.querySelector('[data-testid=update-download]')`))
    await closeUpdateDialog()

    // ============ 取不到清单：如实回报（手工检查路径） ============
    await setServerUrl(`http://127.0.0.1:${dead}`)
    await clickUpdateItem()
    results['E-12 连不上服务器时如实提示未能检查到更新版本'] =
      await waitFor(`(document.querySelector('[data-testid=update-dialog]')||{}).innerText?.includes('未能检查到更新版本')`)
    results['E-12 失败时给出原因且仍保留官网下载指引'] = (await dialogText()).includes('无法连接更新服务器') && (await dialogText()).includes('官网')
    await closeUpdateDialog()

    // ============ E-11 启动自动检查更新 ============
    await setServerUrl(`http://127.0.0.1:${live.port}`)
    await reload()
    results['E-11 启动时自动检查更新并在有新版本时给出更新提示'] =
      await waitFor(`(document.querySelector('[data-testid=update-dialog]')||{}).innerText?.includes('9.9.9')`, 6000)
    results['E-11 自动提示里同样显示当前版本'] = (await dialogText()).includes('0.1.0')
    await closeUpdateDialog()

    // 启动检查失败必须静默：不弹任何提示、不打扰用户
    await setServerUrl(`http://127.0.0.1:${dead}`)
    await reload()
    await sleep(2500)
    results['E-11 启动检查失败时静默不打扰（不弹更新提示）'] = !(await updateDialogOpen())
    results['E-11 启动检查失败时无任何错误弹窗'] =
      !(await evaluate(`!!document.querySelector('[data-testid=update-dialog]')`)) &&
      !(await evaluate(`document.body.innerText.includes('无法连接更新服务器')`))

    let pass = 0
    for (const [name, value] of Object.entries(results)) { console.log((value ? 'PASS ' : 'FAIL ') + name + ' => ' + value); if (value) pass++ }
    console.log(`\n${pass}/${Object.keys(results).length} PASS`)
    for (const server of servers) server.close()
    client.ws.close()
    process.exit(pass === Object.keys(results).length ? 0 : 1)
  } catch (error) {
    console.error('ERR', error.message)
    for (const server of servers) server.close()
    if (client) client.ws.close()
    process.exit(2)
  }
})()
