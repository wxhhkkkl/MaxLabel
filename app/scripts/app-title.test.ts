// 程序标题栏文案（帮助 interface_interface.html 元素 1：程序标题栏显示程序版本、登录状态等信息）。
// 原版真机标题栏原文（parity/reference/labelshop/00-main.png、40-editor.png）：
//   签赋LabelShop [标准版 - 未激活] V6.39 (请登录 LabelShop) - 起始页
//   签赋LabelShop [标准版 - 未激活] V6.39 (请登录 LabelShop) - 新标签模板1
// 复刻版按单一版本策略只保留激活状态分段，其余分段同构。
import assert from 'node:assert'
import { composeWindowTitle, SIGNED_OUT_HINT, START_PAGE_TITLE } from '../src/shared/appTitle'

function check(name: string, fn: () => void): void {
  try {
    fn()
  } catch (error) {
    console.error(`not ok - ${name}`)
    throw error
  }
  console.log(`ok - ${name}`)
}

check('起始页：未激活 + 未登录 + 无文档', () => {
  const title = composeWindowTitle({ productName: 'MaxLabel', activated: false, version: '0.1.0', loginEmail: null, documentTitle: null })
  assert.strictEqual(title, `MaxLabel [未激活] V0.1.0 (${SIGNED_OUT_HINT}) - ${START_PAGE_TITLE}`)
  // 分段顺序与原版一致：产品名 [激活状态] V版本 (登录状态) - 文档
  assert.match(title, /^\S+ \[[^\]]+\] V[0-9.]+ \([^)]+\) - .+$/)
})

check('编辑页：文档标题进入末段', () => {
  const title = composeWindowTitle({ productName: 'MaxLabel', activated: false, version: '0.1.0', loginEmail: null, documentTitle: '新标签模板1' })
  assert.strictEqual(title, `MaxLabel [未激活] V0.1.0 (${SIGNED_OUT_HINT}) - 新标签模板1`)
})

check('已激活：激活状态分段随授权变化', () => {
  const title = composeWindowTitle({ productName: 'MaxLabel', activated: true, version: '0.1.0', loginEmail: null, documentTitle: null })
  assert.ok(title.includes('[已激活]'), title)
  assert.ok(!title.includes('未激活'), title)
})

check('已登录：登录状态分段显示账号', () => {
  const title = composeWindowTitle({ productName: 'MaxLabel', activated: true, version: '0.1.0', loginEmail: 'user@example.com', documentTitle: null })
  assert.ok(title.includes('(user@example.com)'), title)
  assert.ok(!title.includes(SIGNED_OUT_HINT), title)
})

check('空白登录账号/空文档标题回退到原版默认分段', () => {
  const title = composeWindowTitle({ productName: 'MaxLabel', activated: false, version: '0.1.0', loginEmail: '   ', documentTitle: '  ' })
  assert.ok(title.includes(`(${SIGNED_OUT_HINT})`), title)
  assert.ok(title.endsWith(`- ${START_PAGE_TITLE}`), title)
})

check('版本号缺失时不留空的 V 段', () => {
  const title = composeWindowTitle({ productName: 'MaxLabel', activated: false, version: '  ', loginEmail: null, documentTitle: null })
  assert.strictEqual(title, `MaxLabel [未激活] (${SIGNED_OUT_HINT}) - ${START_PAGE_TITLE}`)
  assert.ok(!title.includes('V '), title)
})

check('产品名缺失时回退默认产品名', () => {
  const title = composeWindowTitle({ productName: '   ', activated: false, version: '1.2.3', loginEmail: null, documentTitle: null })
  assert.ok(title.startsWith('MaxLabel ['), title)
})

console.log('7 app title checks passed')
