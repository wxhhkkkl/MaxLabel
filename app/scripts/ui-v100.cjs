/* A 章节 · 入门指引簇（getstart_*.html，A-187 ~ A-204）：
 * 新手入门对话框的主题结构、标签打印概念、条码打印机分类与指令集、
 * 标签格式参数、可变数据打印的五种变量来源与序列号做法。
 * 出处：getstart_main.html / getstart_summary.html / getstart_label.html /
 *       getstart_printer.html / getstart_variable.html / getstart_color.html / getstart_version.html
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
    const key = (name, options = {}) => evaluate(`(() => { const e=new KeyboardEvent('keydown',${JSON.stringify({ key: name, code: name, bubbles: true, cancelable: true, ...options })}); window.dispatchEvent(e); document.dispatchEvent(e); return true })()`)
    const waitFor = async (expression, timeout = 3000) => {
      const started = Date.now()
      const probe = expression.trim().startsWith('[') ? `!!document.querySelector(${JSON.stringify(expression)})` : expression
      while (Date.now() - started < timeout) {
        if (await evaluate(probe)) return true
        await sleep(80)
      }
      return false
    }
    const menuLabels = () => evaluate(`[...document.querySelectorAll('[data-menu-item]')].filter((e)=>e.offsetParent).map((e)=>e.getAttribute('data-menu-item'))`)
    const openMenu = async (title) => {
      await evaluate(`(() => { const b=document.querySelector('[data-menu-title=${JSON.stringify(title)}]'); if(!b) return false; if(!b.parentElement.querySelector('[data-menu-item],[data-menu-divider]')) b.click(); return true })()`)
      await sleep(180)
      return menuLabels()
    }
    const closeMenu = async (title) => {
      await evaluate(`(() => { const b=document.querySelector('[data-menu-title=${JSON.stringify(title)}]'); if(!b) return false; if(b.parentElement.querySelector('[data-menu-item],[data-menu-divider]')) b.click(); return true })()`)
      await sleep(150)
    }
    const clickItem = async (label) => { const ok = await click(`[data-menu-item=${JSON.stringify(label)}]`); await sleep(250); return ok }
    const pressEscape = () => key('Escape')
    const stepKeys = () => evaluate(`[...document.querySelectorAll('[data-testid^="get-started-step-"]')].map((e)=>e.getAttribute('data-testid').replace('get-started-step-',''))`)
    const stepTitles = () => evaluate(`[...document.querySelectorAll('[data-testid^="get-started-step-"]')].map((e)=>e.textContent.replace(/^\\d+/,'').trim())`)
    const gotoStep = async (key) => {
      const ok = await click(`[data-testid="get-started-step-${key}"]`)
      await sleep(220)
      return ok
    }
    const panelText = () => evaluate('document.querySelector("[data-testid=get-started-dialog]")?.innerText || ""')

    await sleep(1800)
    await evaluate('document.querySelector("button[aria-label=关闭]")?.click()')
    await key('n', { ctrlKey: true }); await sleep(340)
    if (await evaluate('!!document.querySelector("[data-testid=template-wizard]")')) {
      await click('[data-testid="wizard-next"]'); await sleep(320)
    }
    await click('[data-testid="new-label-select"]')
    if (!await waitFor('!!document.querySelector("canvas")', 8000)) throw new Error('editor did not open')

    // 排入一个文字对象，供数据源属性页断言使用
    await click('[data-tool="text"]')
    await evaluate(`(() => {
      const c=document.querySelector('canvas.upper-canvas')||document.querySelector('canvas'); if(!c)return false
      const b=c.getBoundingClientRect()
      const p=(x,y,bt)=>({bubbles:true,cancelable:true,view:window,clientX:b.left+x,clientY:b.top+y,button:0,buttons:bt})
      c.dispatchEvent(new MouseEvent('mousedown',p(420,150,1)))
      c.dispatchEvent(new MouseEvent('mousemove',p(620,220,1)))
      c.dispatchEvent(new MouseEvent('mouseup',p(620,220,0))); return true })()`)
    await sleep(450)

    // ================= A-187 / A-188：入门章节的五个主题齐备 =================
    await openMenu('账户(A)')
    await clickItem('演示和体验...')
    if (!await waitFor('!!document.querySelector("[data-testid=get-started-dialog]")')) throw new Error('get-started dialog did not open')
    const keys = await stepKeys()
    const titles = await stepTitles()
    results['A-187 新手入门含 getstart_main.html 的五个主题（标签打印概念/条码打印机/第一个标签/可变数据/版本信息）'] =
      JSON.stringify(keys) === JSON.stringify(['concept', 'printer', 'new', 'object', 'variable', 'print', 'version'])
    results['A-187 各主题标题对应用户可识别的章节名'] =
      titles.includes('标签打印的概念') && titles.includes('了解条码打印机') &&
      titles.includes('可变数据打印的概念') && titles.includes('版本与激活')
    const chapterText = await panelText()
    results['A-187 入门页点明软件定位与"设置标签格式、编辑标签模板、打印标签"'] =
      chapterText.includes('标签格式') && chapterText.includes('标签模板')
    results['A-187 入门页点明需激活才可正常使用、未激活也能体验'] =
      await gotoStep('version') && (await panelText()).includes('激活之前也可以体验')

    // ================= A-189：标签打印与普通打印的差异 =================
    await gotoStep('concept')
    const conceptText = await panelText()
    results['A-189 点明标签按行和列布局在页面上并自动排列打印'] =
      conceptText.includes('按行和列布局在页面上') && conceptText.includes('自动在页面上排列标签')
    results['A-189 点明只需编辑好一个标签的格式（模板设计与格式分离）'] =
      conceptText.includes('只需编辑好一个标签的格式')

    // ================= A-193 / A-194 / A-195：标签格式参数与可变内容约束 =================
    results['A-193 标签格式需预先定义宽度、高度、行数、列数、间隔'] =
      ['宽度', '高度', '行数', '列数', '间隔'].every((word) => conceptText.includes(word))
    results['A-193 打印时设置需要输出的标签数量后自动按格式排列'] =
      conceptText.includes('设置好需要输出的标签数量')
    results['A-195 文字与条码内容可变、图片内容也可不同，但布局必须一致'] =
      conceptText.includes('文字和条码内容变化') && conceptText.includes('图片内容也可以不同') && conceptText.includes('布局必须是一致的')

    // ================= A-202 / A-203 / A-204：打印机分类与指令集 =================
    await gotoStep('printer')
    const printerText = await panelText()
    results['A-202 打印机分为平张页式打印机与卷筒式标签打印机两类'] =
      printerText.includes('平张页式打印机') && printerText.includes('卷筒式标签打印机')
    results['A-202 平张页式打单张纸、卷筒式打连续卷筒式标签纸（激光/喷墨为例）'] =
      printerText.includes('单张纸') && printerText.includes('激光') && printerText.includes('喷墨')
    results['A-203 通过驱动程序识别打印机类型并显示正确的标签格式'] =
      printerText.includes('通过驱动程序识别这两类打印机') && printerText.includes('标签格式')
    results['A-204 提供指令输出与图形输出两种方式，指令集直接驱动打印机'] =
      printerText.includes('指令集直接驱动') && printerText.includes('图形')
    results['A-204 集成内置驱动，可在不安装 Windows 驱动的情况下使用'] =
      printerText.includes('内置驱动') && printerText.includes('不安装 Windows 驱动')
    results['A-202 目标打印机与参数（速度/黑度）随标签模板保存'] =
      printerText.includes('随标签模板保存')

    // ================= A-196 / A-197 / A-198：可变数据打印的概念 =================
    await gotoStep('variable')
    const variableText = await panelText()
    results['A-196 变量模式含序列号（顺序变号）／数据库／日期时间／键盘输入／VB Script'] =
      variableText.includes('序列号') && variableText.includes('数据库') &&
      variableText.includes('日期和时间') && variableText.includes('提示用户输入') && variableText.includes('VB Script')
    results['A-196 序列号标签做法：排入文字后双击，在"数据源"中改为序列号类型'] =
      variableText.includes('双击') && variableText.includes('数据源') && variableText.includes('序列号类型')
    results['A-198 高级选项可修改序列号设置'] =
      variableText.includes('高级选项')
    results['A-198 支持截短/填充到指定长度，多个对象内容连接统一变化'] =
      variableText.includes('截短') && variableText.includes('填充') && variableText.includes('连接起来')

    // 关掉新手入门对话框，后续断言在编辑界面进行
    await evaluate(`document.querySelector('[data-testid="get-started-dialog"] button[aria-label]')?.click()`)
    await sleep(300)
    results['入门对话框可关闭且不改变文档'] =
      !(await evaluate('!!document.querySelector("[data-testid=get-started-dialog]")'))

    // ================= A-196 / A-198：属性页的七类数据源与序列号高级选项 =================
    await evaluate(`(() => {
      const row=[...document.querySelectorAll('[data-testid="layer-object-row"]')].find((e)=>e.getAttribute('data-object-type')==='text')
      if(row && row.getAttribute('data-selected')!=='true')row.click(); return true })()`)
    await sleep(250)
    await key('Enter', { altKey: true })
    if (await waitFor('!!document.querySelector("[data-testid=object-props-dialog]")', 4000)) {
      // 数据源页签（帮助 label_object_page_data.html）：变量类型入口在此页
      await click('[data-testid="object-props-tab-datasource"]'); await sleep(320)
      const sourceKinds = await evaluate(`[...document.querySelectorAll('[data-testid^="source-kind-"]')].map((e)=>e.getAttribute('data-testid').replace('source-kind-',''))`)
      results['A-196 属性页数据源类型覆盖常量/序列号/数据库/日期/时间/键盘输入/脚本'] =
        JSON.stringify(sourceKinds) === JSON.stringify(['constant', 'serial', 'date', 'time', 'database', 'keyboard', 'script'])
      // 序列号做法：切到序列号页后能看到起始值与步长（帮助 getstart_variable.html）
      await click('[data-testid="source-kind-serial"]'); await sleep(260)
      const serialPanel = await evaluate('document.querySelector("[data-testid=object-props-dialog]")?.innerText || ""')
      results['A-198 序列号页提供起始值/步长等"高级选项"'] =
        serialPanel.includes('序列号') && (serialPanel.includes('步长') || serialPanel.includes('起始'))
    } else {
      results['A-196 属性页数据源类型覆盖常量/序列号/数据库/日期/时间/键盘输入/脚本'] = false
      results['A-198 序列号页提供起始值/步长等"高级选项"'] = false
    }

    // A-197：电子表格导入 → 绑定字段列（数据库菜单 → 设置数据库 → 导入入口）
    await openMenu('数据库(D)')
    const dbMenu = await menuLabels()
    results['A-197 数据库菜单提供「设置数据库(D)...」以导入电子表格/数据库数据'] =
      dbMenu.includes('设置数据库(D)...')
    await clickItem('设置数据库(D)...')
    results['A-197 设置数据库对话框提供数据导入入口'] =
      await waitFor(`!!document.querySelector('[data-testid="database-import-select"],[data-testid="cloud-database-select"]')`, 3000)
    await pressEscape(); await sleep(320)

    // ================= A-205 / A-206：十三步流程的第 1、2 步（新建 → 选标签格式） =================
    await openMenu('文件(F)')
    const fileLabels = await menuLabels()
    results['A-205 文件菜单提供新建标签模板入口（工具栏或菜单新建）'] =
      fileLabels.some((l) => l.indexOf('新建') === 0)
    await closeMenu('文件(F)')
    await key('n', { ctrlKey: true }); await sleep(340)
    if (await evaluate('!!document.querySelector("[data-testid=template-wizard]")')) {
      await click('[data-testid="wizard-next"]'); await sleep(320)
    }
    results['A-205/A-206 新建标签模板打开标签格式选择对话框（流程第 1、2 步）'] =
      await waitFor('!!document.querySelector("[data-testid=new-label-dialog]")', 2500)
    results['A-206 标签格式对话框可选定目标打印机与标签格式'] =
      await evaluate(`!!document.querySelector('[data-testid="new-label-printer"]') && !!document.querySelector('[data-testid="new-label-format"]')`)
    await evaluate(`document.querySelector('[data-testid="new-label-cancel"]')?.click()`)
    await sleep(300)

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
