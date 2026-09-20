/* A-85（主工具栏「打开」按钮的点击行为）与 A-201（打印机对可变颜色打印的自动判定）。
 *
 * A-85：文件对话框是系统原生窗口，位于 CDP 页面上下文之外，脚本点不到它的按钮。
 * 这里走等价路径：run-regression.ps1 为本脚本设置 MAXLABEL_OPEN_PATH（主进程在该变量
 * 存在时直接返回指定文件，等价于用户在对话框里选中该文件），脚本造一个真实模板文件后
 * 点击工具栏「打开」，断言文档真的被载入。未设置该变量时主进程仍走真实对话框。
 *
 * A-201：帮助 getstart_color.html 特别说明「签赋LabelShop 会根据打印机自动判断是否支持
 * 可变颜色打印（彩色打印），普通条码标签打印机无法选择彩色打印」。判据见
 * src/shared/print/capabilities.ts 的 printerSupportsVariableColor：Windows 驱动端口 →
 * 可能是平张页式彩色打印机（支持）；USB/TCP/COM/LPT/蓝牙/文件等指令集直连端口 →
 * 普通条码标签打印机（不支持，变色设置不可选并给出帮助原文提示）。
 */
const http = require('http')
const fs = require('fs')
const os = require('os')
const path = require('path')
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
    const setValue = (selector, value) => evaluate(`(() => {
      const e=document.querySelector(${JSON.stringify(selector)}); if(!e)return false
      const proto=e instanceof HTMLSelectElement?HTMLSelectElement.prototype:HTMLInputElement.prototype
      const setter=Object.getOwnPropertyDescriptor(proto,'value').set
      setter.call(e,${JSON.stringify(String(value))})
      e.dispatchEvent(new Event('input',{bubbles:true})); e.dispatchEvent(new Event('change',{bubbles:true})); return true
    })()`)
    const optionsOf = (selector) => evaluate(`[...(document.querySelector(${JSON.stringify(selector)})?.options||[])].map((o)=>o.value)`)
    const waitFor = async (expression, timeout = 4000) => {
      const started = Date.now()
      const probe = expression.trim().startsWith('[') ? `!!document.querySelector(${JSON.stringify(expression)})` : expression
      while (Date.now() - started < timeout) {
        if (await evaluate(probe)) return true
        await sleep(80)
      }
      return false
    }
    const dragCanvas = (x1, y1, x2, y2) => evaluate(`(() => {
      const canvas=document.querySelector('canvas.upper-canvas') || document.querySelector('canvas'); if(!canvas)return false
      const b=canvas.getBoundingClientRect(); const p=(x,y)=>({bubbles:true,cancelable:true,view:window,clientX:b.left+x,clientY:b.top+y,button:0,buttons:1})
      canvas.dispatchEvent(new MouseEvent('mousedown',p(${x1},${y1})))
      canvas.dispatchEvent(new MouseEvent('mousemove',p(${x2},${y2})))
      canvas.dispatchEvent(new MouseEvent('mouseup',{...p(${x2},${y2}),buttons:0})); return true
    })()`)
    const selectType = (type) => evaluate(`(() => {
      const row=[...document.querySelectorAll('[data-testid="layer-object-row"]')].find((e)=>e.getAttribute('data-object-type')===${JSON.stringify(type)})
      if(!row)return false; if(row.getAttribute('data-selected')!=='true')row.click(); return true
    })()`)
    const openProps = async (type) => {
      if (!await selectType(type)) return false
      const key = (name, options = {}) => evaluate(`(() => { const e=new KeyboardEvent('keydown',${JSON.stringify({ key: name, code: name, bubbles: true, cancelable: true, ...options })}); window.dispatchEvent(e); document.dispatchEvent(e); return true })()`)
      await key('Enter', { altKey: true })
      return waitFor('!!document.querySelector("[data-testid=object-props-dialog]")')
    }
    const closeProps = async () => {
      await evaluate(`document.querySelector('[data-testid="object-props-dialog"] button[aria-label]')?.click()`)
      await sleep(200)
    }

    await sleep(1600)
    await evaluate('document.querySelector("button[aria-label=关闭]")?.click()')
    await evaluate('window.dispatchEvent(new KeyboardEvent("keydown",{key:"n",code:"KeyN",ctrlKey:true,bubbles:true,cancelable:true}))')
    await sleep(350)
    if (await evaluate('!!document.querySelector("[data-testid=template-wizard]")')) {
      await click('[data-testid="wizard-next"]'); await sleep(320)
    }
    await click('[data-testid="new-label-select"]')
    if (!await waitFor('!!document.querySelector("canvas")', 8000)) throw new Error('editor did not open')

    // ---- A-85：主工具栏「打开」按钮的点击行为 ----
    // run-regression.ps1 为 ui-v108 设置了 MAXLABEL_OPEN_PATH 指向该文件；
    // 主进程在「打开」对话框处直接返回它，等价于用户在系统对话框里选中该文件。
    const fixturePath = path.join(os.tmpdir(), 'maxlabel-open-fixture.msdx')
    fs.writeFileSync(fixturePath, JSON.stringify({ version: 1, name: 'ui-v108-open', widthMm: 42, heightMm: 24, objects: [] }), 'utf-8')
    const openButton = await evaluate(`(() => { const b=[...document.querySelectorAll('[data-testid="toolbar"] button')].find((e)=>e.getAttribute('title')==='打开标签模版'); if(!b)return null; return { disabled: b.disabled === true, visible: b.offsetParent !== null } })()`)
    results['A-85 主工具栏「打开」按钮存在、可用且可见'] = !!openButton && openButton.disabled === false && openButton.visible === true
    const clicked = await evaluate(`(() => { const b=[...document.querySelectorAll('[data-testid="toolbar"] button')].find((e)=>e.getAttribute('title')==='打开标签模版'); if(!b)return false; b.click(); return true })()`)
    const opened = await waitFor(`!!document.querySelector('[data-testid="document-tab"][data-document-title="ui-v108-open"]')`, 6000)
    results['A-85 点击「打开」按钮后模板文档被载入'] = clicked === true && opened === true
    const spec = await evaluate(`document.querySelector('[data-testid="status-label-spec"]')?.textContent || ''`)
    // 状态栏把当前提示放在 title 上（与原版一致：提示文本不占用固定字段）
    const status = await evaluate(`document.querySelector('[data-testid="status-bar"]')?.getAttribute('title') || ''`)
    results['A-85 载入的文档尺寸与文件内容一致（42mm x 24mm）且状态栏回显路径'] =
      spec.includes('42mm x 24mm') && status.includes('已打开') && status.includes('maxlabel-open-fixture.msdx')
    results['A-85 打开过程中没有出现打开失败提示'] = !status.includes('打开失败')

    // ---- A-201：Windows 驱动端口（可能是平张页式彩色打印机）支持可变颜色 ----
    await click('[data-tool="rect"]'); await dragCanvas(180, 150, 340, 240); await sleep(320)
    if (!await openProps('rect')) throw new Error('rect props did not open')
    const driverModes = await optionsOf('[data-testid="object-props-dialog"] [data-testid="color-change-mode"]')
    const driverNote = await evaluate(`!!document.querySelector('[data-testid="color-change-printer-note"]')`)
    results['A-201 驱动端口下「变色设置」可选且提供六种颜色变化模式'] =
      JSON.stringify(driverModes) === JSON.stringify(['fixed', 'random', 'indexByContent', 'indexVar', 'valueVar', 'index', 'rgb']) && driverNote === false
    await closeProps()

    // 切到指令集直连端口（USB）后，打印机被判定为普通条码标签打印机
    await evaluate('window.dispatchEvent(new KeyboardEvent("keydown",{key:"p",code:"KeyP",ctrlKey:true,bubbles:true,cancelable:true}))')
    await sleep(400)
    await click('[data-testid="print-dialog-printer-properties"]'); await sleep(250)
    await click('[data-testid="printer-settings-port-tab"]'); await sleep(250)
    await setValue('[data-testid="printer-port-type"]', 'usb'); await sleep(250)
    // round-106：USB 类型必须选中「端口(O)」（真机属性对话框会列出 USB001 (设备名)），
    // 未选端口时 portConfigError 会拦住保存；端口列表是异步枚举的，先等它到位。
    const usbDeadline = Date.now() + 8000
    let usbPortValue = ''
    while (Date.now() < usbDeadline && !usbPortValue) {
      usbPortValue = await evaluate(`[...(document.querySelector('[data-testid="printer-port-usb"]')?.options||[])].map((o)=>o.value).find((v)=>v) || ''`)
      if (!usbPortValue) await sleep(150)
    }
    if (usbPortValue) { await setValue('[data-testid="printer-port-usb"]', usbPortValue); await sleep(180) }
    await click('[data-testid="printer-settings-save"]'); await sleep(300)
    // 关闭打印对话框：点击遮罩本身即触发 onClose
    await evaluate(`document.querySelector('[data-testid="print-dialog"]')?.click()`)
    await sleep(300)

    if (!await openProps('rect')) throw new Error('rect props did not reopen')
    const usbModes = await optionsOf('[data-testid="object-props-dialog"] [data-testid="color-change-mode"]')
    const usbNote = await evaluate(`document.querySelector('[data-testid="color-change-printer-note"]')?.innerText || ''`)
    results['A-201 USB 直连的条码标签打印机不可选择彩色打印（变色设置不提供）'] =
      usbModes.length === 0 && usbNote.includes('普通条码标签打印机无法选择彩色打印')
    results['A-201 提示写明原版的自动判定规则'] = usbNote.includes('签赋LabelShop 会根据打印机自动判断是否支持可变颜色打印')
    await closeProps()

    // 切回驱动端口后恢复可选（判定跟着打印机走，而非一次性关闭）
    await evaluate('window.dispatchEvent(new KeyboardEvent("keydown",{key:"p",code:"KeyP",ctrlKey:true,bubbles:true,cancelable:true}))')
    await sleep(400)
    await click('[data-testid="print-dialog-printer-properties"]'); await sleep(250)
    await click('[data-testid="printer-settings-port-tab"]'); await sleep(250)
    await setValue('[data-testid="printer-port-type"]', 'driver'); await sleep(200)
    await click('[data-testid="printer-settings-save"]'); await sleep(300)
    // 关闭打印对话框：点击遮罩本身即触发 onClose
    await evaluate(`document.querySelector('[data-testid="print-dialog"]')?.click()`)
    await sleep(300)
    if (!await openProps('rect')) throw new Error('rect props did not reopen after restore')
    const restoredModes = await optionsOf('[data-testid="object-props-dialog"] [data-testid="color-change-mode"]')
    results['A-201 换回驱动端口后「变色设置」恢复可选'] = restoredModes.length === 7
    await closeProps()

    let pass = 0
    for (const [name, value] of Object.entries(results)) { console.log((value ? 'PASS ' : 'FAIL ') + name + ' => ' + value); if (value) pass++ }
    console.log(`\n${pass}/${Object.keys(results).length} PASS`)
    client.ws.close()
    process.exit(pass === Object.keys(results).length ? 0 : 1)
  } catch (error) {
    console.error('ERR', error.message)
    if (client) client.ws.close()
    process.exit(2)
  }
})()
