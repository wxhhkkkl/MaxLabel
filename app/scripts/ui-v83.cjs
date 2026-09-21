/* C-75/C-79/C-80：云数据库服务边界与云模板保存/分享元数据。 */
const http = require('http')
const WebSocket = require('ws')
function getJson(url) { return new Promise((resolve, reject) => { http.get(url, (res) => { let data = ''; res.on('data', (c) => { data += c }); res.on('end', () => { try { resolve(JSON.parse(data)) } catch (e) { reject(e) } }) }).on('error', reject) }) }
function sleep(ms) { return new Promise((resolve) => setTimeout(resolve, ms)) }
function attach(url) { return new Promise((resolve, reject) => { const ws = new WebSocket(url); let id = 0; const pending = new Map(); const send = (method, params = {}) => new Promise((res, rej) => { const messageId = ++id; pending.set(messageId, { res, rej }); ws.send(JSON.stringify({ id: messageId, method, params })) }); ws.on('message', (raw) => { const m = JSON.parse(raw.toString()); const p = pending.get(m.id); if (!p) return; pending.delete(m.id); m.error ? p.rej(new Error(m.error.message)) : p.res(m.result) }); ws.on('open', () => resolve({ ws, send })); ws.on('error', reject) }) }
;(async () => {
  let client
  const results = {}
  try {
    const port = process.env.MAXLABEL_DEBUG_PORT || 9222
    const pages = await getJson(`http://127.0.0.1:${port}/json/list`)
    const page = pages.find((item) => item.type === 'page')
    if (!page) throw new Error('no main page')
    client = await attach(page.webSocketDebuggerUrl)
    const evaluate = async (expression) => { const r = await client.send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true }); if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || r.exceptionDetails.text); return r.result?.value }
    const click = (selector) => evaluate(`(() => { const e=document.querySelector(${JSON.stringify(selector)}); if(!e || e.disabled)return false; e.click(); return true })()`)
    const key = (name, options = {}) => evaluate(`(() => { const e=new KeyboardEvent('keydown',${JSON.stringify({ key: name, code: name, bubbles: true, cancelable: true, ...options })}); window.dispatchEvent(e); document.dispatchEvent(e); return true })()`)
    const setValue = (selector, value) => evaluate(`(() => { const e=document.querySelector(${JSON.stringify(selector)}); if(!e)return false; const proto=e instanceof HTMLSelectElement?HTMLSelectElement.prototype:e instanceof HTMLTextAreaElement?HTMLTextAreaElement.prototype:HTMLInputElement.prototype; const setter=Object.getOwnPropertyDescriptor(proto,'value').set; setter.call(e,${JSON.stringify(String(value))}); e.dispatchEvent(new Event('input',{bubbles:true})); e.dispatchEvent(new Event('change',{bubbles:true})); return true })()`)
    const waitFor = async (expression, timeout = 6000) => { const start = Date.now(); while (Date.now() - start < timeout) { if (await evaluate(expression)) return true; await sleep(80) } return false }

    await sleep(1500)
    const email = `ui-v83-${Date.now()}@example.com`
    await evaluate(`localStorage.setItem('maxlabel.options', JSON.stringify({ serverUrl: '' })); localStorage.removeItem('maxlabel_server_url'); localStorage.removeItem('maxlabel_cloud_token'); location.reload()`)
    await sleep(1400)
    const registered = await evaluate(`window.maxlabel.cloud.register('', ${JSON.stringify(email)}, 'ui-v83-pass')`)
    if (!registered?.ok || !registered.data?.token) throw new Error('offline cloud account could not be created')
    const stored = await evaluate(`window.maxlabel.cloudCredentials.save('', ${JSON.stringify(registered.data.token)}, ${JSON.stringify(email)})`)
    if (!stored?.ok) throw new Error('offline cloud credential could not be saved')
    await evaluate('location.reload()')
    await sleep(1800)
    await evaluate('document.querySelector("button[aria-label=关闭]")?.click()')
    await key('n', { ctrlKey: true }); await sleep(300)
    if (await evaluate('!!document.querySelector("[data-testid=template-wizard]")')) {
      await click('[data-testid="wizard-next"]'); await sleep(300)
      await evaluate(`(() => { const e=[...document.querySelectorAll('button')].find((x)=>x.offsetParent&&(x.textContent||'').trim()==='选择'); e?.click(); return !!e })()`)
      await sleep(700)
    }
    if (!await waitFor('!!document.querySelector("canvas.upper-canvas")')) throw new Error('editor did not open')

    const credentialState = await evaluate('window.maxlabel.cloudCredentials.load(\"\")')
    const optionState = await evaluate('localStorage.getItem(\"maxlabel.options\")')
    if (!credentialState?.token) throw new Error('credential disappeared after reload; options=' + optionState)
    await click('[data-menu-title="文件(F)"]')
    results['C-79 已登录时文件菜单分享入口可用'] = await evaluate(`document.querySelector('[data-menu-item="分享(T)..."]')?.getAttribute('data-menu-disabled') === 'false'`)
    if (!await click('[data-menu-item="分享(T)..."]')) throw new Error('share menu item is disabled or missing: ' + await evaluate(`document.querySelector('[data-menu-item="分享(T)..."]')?.getAttribute('data-menu-disabled')`))
    if (!await waitFor('!!document.querySelector("[data-testid=cloud-template-metadata]")', 2500)) throw new Error('cloud template dialog did not open: ' + await evaluate('document.body.innerText.slice(-900)'))
    results['C-79 分享对话框包含名称/分类/关键字/描述'] = await evaluate('!!document.querySelector("[data-testid=cloud-template-metadata]") && ["cloud-template-name","cloud-template-category","cloud-template-keywords","cloud-template-description"].every((id)=>!!document.querySelector(`[data-testid=${id}]`))')
    results['C-79 分享目标包含用户模板库和组模板库'] = await evaluate('JSON.stringify([...document.querySelector("[data-testid=cloud-template-scope]").options].map((o)=>o.textContent.trim())) === JSON.stringify(["用户模板库","组模板库"])')
    results['C-80 云模板元数据默认分类有效'] = await evaluate('document.querySelector("[data-testid=cloud-template-category]")?.value === "未分类" && document.querySelector("[data-testid=cloud-template-description]")?.value === ""')
    await setValue('[data-testid="cloud-template-name"]', '云模板元数据回归')
    await setValue('[data-testid="cloud-template-category"]', '物流标签')
    await setValue('[data-testid="cloud-template-keywords"]', '物流, 条码')
    await setValue('[data-testid="cloud-template-description"]', 'C-79/C-80 元数据')
    await click('[data-testid="cloud-template-save"]'); await sleep(500)
    results['C-80 保存按钮提交名称/关键字/描述并回显'] = await evaluate('document.body.innerText.includes("云模板元数据回归") && document.body.innerText.includes("物流标签") && document.body.innerText.includes("物流, 条码")')
    await setValue('[data-testid="cloud-template-scope"]', 'group')
    await click('[data-testid="cloud-template-share"]'); await sleep(500)
    results['C-79 分享按钮提交组模板库与分类'] = await evaluate('document.body.innerText.includes("已分享至组模板库") && document.body.innerText.includes("组模板库")')
    const dbProbe = await evaluate(`window.maxlabel.cloud.databases('', ${JSON.stringify(registered.data.token)})`)
    results['C-75 离线账号云数据库 API 返回真实空列表而非伪造记录'] = Boolean(dbProbe?.ok && Array.isArray(dbProbe.data) && dbProbe.data.length === 0)
    results['C-75 云数据库表记录 API 已暴露'] = await evaluate('typeof window.maxlabel.cloud.databaseTables === "function" && typeof window.maxlabel.cloud.databaseRows === "function"')
    await click('[aria-label="关闭"]')
    let pass = 0
    for (const [name, value] of Object.entries(results)) { console.log((value ? 'PASS ' : 'FAIL ') + name + ' => ' + value); if (value) pass++ }
    console.log(`\n${pass}/${Object.keys(results).length} PASS`)
    client.ws.close(); process.exit(pass === Object.keys(results).length ? 0 : 1)
  } catch (error) {
    console.error('ERR', error.message)
    if (client) client.ws.close()
    process.exit(2)
  }
})()
