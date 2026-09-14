/* P0-A DIFF-3：模板向导首步、默认选项与持久化跳过设置。 */
const http = require('http')

function getJson(url) {
  return new Promise((resolve, reject) => {
    http.get(url, (res) => {
      let data = ''
      res.on('data', (chunk) => { data += chunk })
      res.on('end', () => {
        try { resolve(JSON.parse(data)) } catch (error) { reject(error) }
      })
    }).on('error', reject)
  })
}

function sleep(ms) { return new Promise((resolve) => setTimeout(resolve, ms)) }

function attach(wsUrl) {
  return new Promise((resolve, reject) => {
    const WebSocket = require('ws')
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
    const clickText = (text, startsWith = false) => evaluate(`(() => {
      const wanted = ${JSON.stringify(text)}
      const elements = [...document.querySelectorAll('*')].filter((element) => {
        const value = (element.textContent || '').trim()
        return element.children.length === 0 && element.offsetParent && (${startsWith} ? value.startsWith(wanted) : value === wanted)
      })
      if (!elements.length) return false
      elements[elements.length - 1].dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))
      return true
    })()`)

    await sleep(1800)
    await clickText('×')
    await sleep(250)
    await evaluate(`window.dispatchEvent(new KeyboardEvent('keydown', { key: 'n', ctrlKey: true, bubbles: true, cancelable: true }))`)
    await sleep(350)

    const wizard = await evaluate(`(() => {
      const root = document.querySelector('[data-testid="template-wizard"]')
      const text = root?.textContent || ''
      const selected = root?.querySelector('input[name="template-wizard-choice"][value="new"]')
      return {
        visible: !!root,
        copy: text.includes('模板向导') && text.includes('您可以选择打开一个现有的标签模板文档进行工作，也可以新建一个标签模板。') && text.includes('请选择：') && text.includes('下次启动时不再使用向导'),
        choices: ['打开一个现有的标签模板', '新建标签模板', '查看 LabelShop 联机帮助', '查看 LabelShop 在线使用教程'].every((label) => text.includes(label)),
        buttons: text.includes('下一步') && text.includes('取消'),
        defaultNew: !!selected?.checked
      }
    })()`)
    results['Ctrl+N先出模板向导'] = wizard?.visible && wizard.copy && wizard.choices && wizard.buttons
    results['默认选中新建标签模板'] = wizard?.defaultNew === true

    await evaluate(`document.querySelector('[data-testid="wizard-next"]')?.click()`)
    await sleep(450)
    results['向导下一步进入选择标签格式'] = await evaluate(`(() => {
      const text = document.body.textContent || ''
      return !document.querySelector('[data-testid="template-wizard"]') && text.includes('选择标签格式')
    })()`)
    await clickText('取消')
    await sleep(250)

    await evaluate(`window.dispatchEvent(new KeyboardEvent('keydown', { key: 'n', ctrlKey: true, bubbles: true, cancelable: true }))`)
    await sleep(300)
    await evaluate(`document.querySelector('[data-testid="wizard-skip"]')?.click()`)
    await evaluate(`document.querySelector('[data-testid="wizard-next"]')?.click()`)
    await sleep(450)
    const saved = await evaluate(`window.maxlabel.appConfig.load()`)
    results['勾选不再提示后保存设置'] = saved?.ok === true && saved.skipNewWizard === true
    await clickText('选择')
    await sleep(700)

    await evaluate(`window.dispatchEvent(new KeyboardEvent('keydown', { key: 'n', ctrlKey: true, bubbles: true, cancelable: true }))`)
    await sleep(350)
    results['勾选不再提示后下次Ctrl+N跳过向导'] = await evaluate(`(() => {
      const text = document.body.textContent || ''
      return !document.querySelector('[data-testid="template-wizard"]') && text.includes('选择标签格式')
    })()`)

    let pass = 0
    for (const [name, value] of Object.entries(results)) {
      console.log((value ? 'PASS ' : 'FAIL ') + name + ' => ' + value)
      if (value) pass++
    }
    console.log(`\n${pass}/${Object.keys(results).length} PASS`)
    client.ws.close()
    process.exit(pass === Object.keys(results).length ? 0 : 1)
  } catch (error) {
    console.error('ERR', error.message)
    if (client) client.ws.close()
    process.exit(2)
  }
})()
