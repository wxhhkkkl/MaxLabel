// E-09 / E-10 的「已记录边界」回归锁。
//
// 原版签赋LabelShop 是多版本商业产品：
//   E-09  硬件锁（加密狗）激活专业版/企业版（帮助 install_reg.html）
//   E-10  专业版演示模式：打印标签时随机在标签上输出一行提示信息（帮助 install_reg.html）
// 两者都需要实体加密狗 / 版本分层，MaxLabel 是单一版本产品（见
// app/docs/labelshop-compatibility-audit.md「版本分层与授权策略（单一版本）」），因此**不复刻**。
//
// 「不复刻」本身是一个可回归的结论：只要有人往产品里加回硬件锁入口、演示水印或版本分层，
// 本测试就会失败。矩阵 E-09/E-10 的证据列引用本测试与上述策略章节。
import assert from 'node:assert'
import fs from 'node:fs'
import path from 'node:path'
import { composeWindowTitle } from '../src/shared/appTitle'

const appRoot = path.resolve(__dirname, '..')

function check(name: string, fn: () => void): void {
  try {
    fn()
  } catch (error) {
    console.error(`not ok - ${name}`)
    throw error
  }
  console.log(`ok - ${name}`)
}

/** 递归收集某目录下的源文件（跳过构建产物与依赖）。 */
function sourcesUnder(relative: string): string[] {
  const root = path.join(appRoot, relative)
  const out: string[] = []
  const walk = (dir: string): void => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name)
      if (entry.isDirectory()) walk(full)
      else if (/\.(ts|tsx)$/.test(entry.name)) out.push(full)
    }
  }
  if (fs.existsSync(root)) walk(root)
  return out
}

const read = (relative: string): string => fs.readFileSync(path.join(appRoot, relative), 'utf8')
const ALL_SOURCES = ['src/main', 'src/preload', 'src/renderer/src', 'src/shared'].flatMap(sourcesUnder)

check('策略文本落在矩阵引用的审计文档里（E-09/E-10 证据列指向它）', () => {
  const audit = read('docs/labelshop-compatibility-audit.md')
  assert.match(audit, /## 版本分层与授权策略（单一版本）/, '审计文档必须含单一版本策略章节')
  assert.match(audit, /硬件锁（加密狗）激活[^|]*\|[^|]*不实现/, '必须写明硬件锁不实现')
  assert.match(audit, /专业版演示模式[^|]*\|[^|]*不实现/, '必须写明演示模式不实现')
  assert.match(audit, /标准版 \/ 专业版 \/ 企业版分层[^|]*\|[^|]*不实现/, '必须写明版本分层不实现')
  // 帮助出处：两条边界都来自 install_reg.html，策略章节要能对回原文
  assert.match(audit, /install_reg\.html/, '策略章节必须给出原版出处')
})

check('产品源码里没有硬件锁 / 加密狗 / 演示模式的任何入口或文案', () => {
  const banned = ['硬件锁', '加密狗', '演示模式', '体验专业版', '试用管理']
  const hits: string[] = []
  for (const file of ALL_SOURCES) {
    const text = fs.readFileSync(file, 'utf8')
    for (const word of banned) if (text.includes(word)) hits.push(`${path.relative(appRoot, file)} → ${word}`)
  }
  // 「试用管理...」在账户菜单里是原版项，但它在本产品中必须是禁用态（下面单独断言），
  // 因此这里只允许 labelShopMenus.ts 出现该词。
  const unexpected = hits.filter((hit) => !hit.endsWith('labelShopMenus.ts → 试用管理'))
  assert.deepStrictEqual(unexpected, [], `不得出现硬件锁/演示模式实现：${unexpected.join('; ')}`)
})

check('授权 API 面只有 status / activate / check（无硬件锁读取通道）', () => {
  const preload = read('src/preload/index.ts')
  const block = /license:\s*\{([\s\S]*?)\n\s*\}/.exec(preload)
  assert.ok(block, 'preload 必须暴露 license 命名空间')
  const methods = [...block[1].matchAll(/^\s*(\w+):/gm)].map((m) => m[1])
  assert.deepStrictEqual(methods, ['status', 'activate', 'check'], 'license API 面被改动即为边界回归')
  assert.doesNotMatch(preload, /dongle|hardwareLock|hasp|elite/i, '不得出现加密狗 SDK 调用')
})

check('授权对话框只提供密钥一种激活方式，且不做版本分层', () => {
  const dialog = read('src/renderer/src/dialogs/LicenseDialog.tsx')
  assert.match(dialog, /license-key/, '必须提供密钥输入')
  assert.match(dialog, /云服务器地址/, '必须提供服务器地址（在线校验）')
  assert.doesNotMatch(dialog, /硬件锁|加密狗|演示|专业版|企业版/, '授权对话框不得出现版本/加密狗入口')
})

check('账户菜单保留原版「演示和体验」入口，但等价替代为单一版本的版本与激活说明', () => {
  const menus = read('src/renderer/src/features/commands/labelShopMenus.ts')
  // 帮助 menu_help.html「账户菜单」逐项：登录 / 注销 / 账号与授权管理 / 试用管理 / 演示和体验
  assert.match(menus, /label: '演示和体验\.\.\.'/, '「演示和体验...」入口必须保留（原版账户菜单项）')
  assert.match(menus, /label: '演示和体验\.\.\.', action: \(\) => deps\.setModal\('getstarted'\)/, '必须打开版本与激活说明')
  assert.match(menus, /label: '试用管理\.\.\..*disabled: true/, '「试用管理...」按无试用后台保留为禁用态')
})

check('「版本与激活」说明如实告知原版三版本与本产品单一授权', () => {
  const started = read('src/renderer/src/dialogs/GetStartedDialog.tsx')
  assert.match(started, /key: 'version'/, '新手入门必须含版本与激活主题')
  assert.match(started, /标准版 \/ 专业版 \/ 企业版三个版本/, '须保留原版三版本说明')
  assert.match(started, /在激活之前也可以体验软件功能/, '须保留原版「未激活可体验」说明')
})

check('打印链路不存在演示模式水印注入点', () => {
  const printSources = ['src/shared/print', 'src/renderer/src/features/printing', 'src/main/printing'].flatMap(sourcesUnder)
  assert.ok(printSources.length > 0, '打印链路源文件必须存在')
  const hits = printSources.filter((file) => /演示|水印|watermark|demo/i.test(fs.readFileSync(file, 'utf8')))
  assert.deepStrictEqual(hits.map((f) => path.relative(appRoot, f)), [], '打印链路不得注入演示水印')
})

check('标题栏无版本分层：方括号内只有激活状态', () => {
  for (const activated of [true, false]) {
    const title = composeWindowTitle({ productName: 'MaxLabel', activated, version: '0.1.0', loginEmail: null, documentTitle: null })
    const brackets = title.match(/\[[^\]]*\]/g) ?? []
    assert.strictEqual(brackets.length, 1, `标题栏只能有一段方括号：${title}`)
    assert.strictEqual(brackets[0], activated ? '[已激活]' : '[未激活]', `方括号内只能是激活状态：${title}`)
    assert.doesNotMatch(title, /标准版|专业版|企业版/, `标题栏不得出现版本名：${title}`)
  }
})

console.log('\nlicense-single-version: 全部通过')
