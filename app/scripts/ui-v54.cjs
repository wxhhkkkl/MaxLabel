/*
 * P0-A2：起始页左栏、最近文件、协议入口与右侧分区 parity。
 * 原版证据：parity/reference/labelshop/00-main.png、
 * parity/reference/labelshop/START-PAGE-SPEC.md。
 */
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
    const pages = await getJson('http://127.0.0.1:' + port + '/json/list')
    const page = pages.find((item) => item.type === 'page')
    if (!page) throw new Error('no main page')
    client = await attach(page.webSocketDebuggerUrl)
    const evaluate = async (expression) => {
      const result = await client.send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true })
      if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description || result.exceptionDetails.text)
      return result.result?.value
    }

    await sleep(1800)
    await evaluate(`(() => {
      const buttons = [...document.querySelectorAll('button[aria-label="关闭"]')].filter((element) => element.offsetParent)
      buttons[buttons.length - 1]?.click()
    })()`)
    await sleep(250)

    const expectedItems = [
      '客服1QQ：1669809392',
      '客服2QQ：3395913685',
      '客服电话：4000-987-360',
      '新建标签模版',
      '打开标签模版',
      '打开本机模版',
      '下载云马通APP'
    ]
    const start = await evaluate(`(() => {
      const left = document.querySelector('[data-testid="start-left"]')
      const items = [...document.querySelectorAll('[data-testid="start-menu-list"] > li > a')].map((element) => ({
        text: element.textContent.trim(),
        href: element.getAttribute('href') || ''
      }))
      const counts = [...document.querySelectorAll('[data-testid="start-counts"] > a')].map((element) => element.textContent.trim())
      const visible = (selector) => !!document.querySelector(selector)?.offsetParent
      return {
        leftText: left?.textContent || '',
        mascot: !!document.querySelector('[data-testid="start-mascot"]'),
        counts,
        items,
        cloudHome: document.querySelector('.start-cloud-home')?.getAttribute('href') || '',
        login: document.querySelector('[data-testid="start-account"] > a')?.getAttribute('href') || '',
        empty: visible('[data-testid="start-recent-empty"]'),
        recentList: visible('[data-testid="start-recent-list"]'),
        articles: !!document.querySelector('[data-testid="start-articles"]'),
        toplink: !!document.querySelector('[data-testid="start-toplink"]'),
        download: !!document.querySelector('[data-testid="start-download"]')
      }
    })()`)
    results['左栏顶部为头像和未登录且无品牌标题'] = start.mascot && start.leftText.includes('未登录') && !start.leftText.includes('MaxLabel')
    results['计数格文案逐字一致'] = JSON.stringify(start.counts) === JSON.stringify(['0优惠券', '0待支付订单', '0待收货订单'])
    results['开始列表七行顺序与模版文案正确'] = JSON.stringify(start.items.map((item) => item.text)) === JSON.stringify(expectedItems)
    results['开始列表协议入口齐全'] = JSON.stringify(start.items.map((item) => item.href)) === JSON.stringify([
      'http://wpa.qq.com/msgrd?v=3&uin=1669809392&site=qq&menu=yes',
      'http://wpa.qq.com/msgrd?v=3&uin=3395913685&site=qq&menu=yes',
      '#',
      'LabelShop:NewDocument',
      'LabelShop:OpenDocument',
      'LabelShop:OpenLocal',
      'labelshop:OpenUrl:http://www.codingv.com/c/app_downloadpc'
    ])
    results['起始页登录与云马通首页协议正确'] = start.login === 'labelshop:UserLogin' && start.cloudHome === 'LabelShop:OpenCodingV'
    results['右区广告位最新文章下载块存在'] = start.toplink && start.articles && start.download
    results['最近空态可见且无伪造模板卡片'] = start.empty && !start.recentList

    const countHrefs = await evaluate(`(() => [...document.querySelectorAll('[data-testid="start-counts"] > a')].map((element) => element.getAttribute('href')))()`)
    results['计数格保留 OpenULogin 协议'] = countHrefs.every((href) => href.startsWith('labelshop:OpenULogin:'))

    const libLink = await evaluate(`(() => {
      const element = [...document.querySelectorAll('[data-testid="start-menu-list"] > li > a')].find((candidate) => candidate.textContent.trim() === '打开标签模版')
      element?.click()
      return !!element
    })()`)
    await sleep(350)
    const libraryVisible = await evaluate(`!![...document.querySelectorAll('*')].find((element) => element.offsetParent && element.textContent.trim() === '模板库')`)
    results['打开标签模版入口可打开模板库'] = libLink && libraryVisible
    await evaluate(`([...document.querySelectorAll('button[aria-label="关闭"]')].filter((element) => element.offsetParent).pop())?.click()`)
    await sleep(180)

    await evaluate(`localStorage.setItem('maxlabel.recent', JSON.stringify([{ title: 'test', path: 'C:\\\\Users\\\\liyan\\\\Downloads\\\\test.lsdx', updatetime: '2026-09-09 09:09:50', state: 0 }])); location.reload()`)
    await sleep(1200)
    const recent = await evaluate(`(() => {
      const list = document.querySelector('[data-testid="start-recent-list"]')
      const link = list?.querySelector('a')
      return {
        text: link?.textContent.trim() || '',
        href: link?.getAttribute('href') || '',
        empty: !!document.querySelector('[data-testid="start-recent-empty"]')?.offsetParent
      }
    })()`)
    results['最近列表读取 RecentFile 记录并生成 OpenDocument 路径'] = recent.text === 'test' && recent.href === 'LabelShop:OpenDocument:C:\\Users\\liyan\\Downloads\\test.lsdx' && !recent.empty

    await evaluate(`document.querySelector('[data-testid="start-section-recent-toggle"]')?.click()`)
    await sleep(100)
    const collapsed = await evaluate(`({
      expanded: document.querySelector('[data-testid="start-section-recent-toggle"]')?.getAttribute('aria-expanded'),
      listVisible: !!document.querySelector('[data-testid="start-recent-list"]')?.offsetParent
    })`)
    results['最近标题支持折叠和展开'] = collapsed.expanded === 'false' && !collapsed.listVisible
    await evaluate(`document.querySelector('[data-testid="start-section-recent-toggle"]')?.click()`)

    let pass = 0
    for (const [name, value] of Object.entries(results)) {
      console.log((value ? 'PASS ' : 'FAIL ') + name + ' => ' + value)
      if (value) pass++
    }
    console.log('\n' + pass + '/' + Object.keys(results).length + ' PASS')
    client.ws.close()
    process.exit(pass === Object.keys(results).length ? 0 : 1)
  } catch (error) {
    console.error('ERR', error.message)
    if (client) client.ws.close()
    process.exit(2)
  }
})()
