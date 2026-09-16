/* E-03/E-04/E-05 安装向导第 1 步「接受软件许可协议」（帮助 install_install.html）。
 * 复刻版用 electron-builder 的 NSIS 打包，许可协议页由 build 资源目录下的许可协议文件自动启用。
 * 本测试不另写一套判定，直接调用 electron-builder 自己的解析实现：
 *   - `getLicenseFiles`（app-builder-lib/out/util/license.js）筛选多语言许可协议文件；
 *   - `computeLicensePage`（app-builder-lib/out/targets/nsis/nsisLicense.js）生成 NSIS 许可页宏。
 * 断言：资源文件存在且为中文、解析结果会插入 `MUI_PAGE_LICENSE`、且按语言绑定（中文不乱码）。
 * 说明：packager 用最小替身——`resourceList` 取自真实的 build 目录列表，
 *      `getResource` 按 electron-builder 的默认查找语义（在资源列表中找同名文件）返回路径。 */
const assert = require('node:assert')
const fs = require('node:fs')
const path = require('node:path')

const appRoot = path.resolve(__dirname, '..')
const buildResourcesDir = path.join(appRoot, 'build')
const licenseFileName = 'license_zh_CN.txt'
const licensePath = path.join(buildResourcesDir, licenseFileName)

function check(name, fn) {
  fn()
  console.log(`ok - ${name}`)
}

const { computeLicensePage } = require('app-builder-lib/out/targets/nsis/nsisLicense')
const { getLicenseFiles } = require('app-builder-lib/out/util/license')

function packagerStub() {
  const resourceList = fs.readdirSync(buildResourcesDir)
  return {
    info: { buildResourcesDir },
    buildResourcesDir,
    projectDir: appRoot,
    resourceList: Promise.resolve(resourceList),
    /** electron-builder 的 getResource(undefined, ...names) 语义：命中资源列表即返回其路径。 */
    async getResource(custom, ...names) {
      if (custom !== undefined && custom !== null && String(custom).trim() !== '') {
        return resourceList.includes(custom) ? path.join(buildResourcesDir, custom) : null
      }
      for (const name of names) if (resourceList.includes(name)) return path.join(buildResourcesDir, name)
      return null
    }
  }
}

async function main() {
  check('build 资源目录存在中文软件许可协议文件', () => {
    assert.ok(fs.existsSync(licensePath), `缺少 ${licensePath}`)
    const text = fs.readFileSync(licensePath, 'utf8')
    assert.ok(text.includes('MaxLabel 最终用户许可协议'), '许可协议缺少标题')
    assert.ok(text.includes('我接受协议'), '许可协议缺少安装向导的接受提示')
  })

  check('许可协议文件为 UTF-8 BOM（NSIS 许可页显示中文所需）', () => {
    const head = fs.readFileSync(licensePath).subarray(0, 3)
    assert.deepStrictEqual([...head], [0xef, 0xbb, 0xbf], '缺少 UTF-8 BOM，NSIS 许可页会乱码')
  })

  const resourceList = fs.readdirSync(buildResourcesDir)
  const detected = await getLicenseFiles(packagerStub())
  check('electron-builder 能识别到该许可协议文件（多语言许可页分支）', () => {
    const names = detected.map((item) => path.basename(item.file))
    assert.deepStrictEqual(names, [licenseFileName], `实际识别到：${JSON.stringify(names)}（资源目录：${JSON.stringify(resourceList)}）`)
    assert.strictEqual(detected[0].lang, 'zh', '语言代码应为 zh')
    assert.strictEqual(detected[0].langWithRegion, 'zh_CN', '语言区域应为 zh_CN')
  })

  const macros = new Map()
  const scriptGenerator = { macro: (name, lines) => macros.set(name, lines) }
  await computeLicensePage(packagerStub(), {}, scriptGenerator, ['zh_CN', 'en_US'])

  check('安装向导含许可协议页（MUI_PAGE_LICENSE）', () => {
    const page = macros.get('licensePage')
    assert.ok(page, '未生成 licensePage 宏')
    assert.ok(page.some((line) => line.includes('!insertmacro MUI_PAGE_LICENSE')), `未插入许可协议页：${JSON.stringify(page)}`)
  })

  check('许可协议页指向 build 资源目录里的中文许可协议文件', () => {
    const page = macros.get('licensePage').join('\n')
    assert.ok(page.includes(licenseFileName), `许可页未引用 ${licenseFileName}：${page}`)
    assert.ok(page.includes(licensePath), `许可页引用的路径不是 ${licensePath}：${page}`)
  })

  check('许可协议按安装向导语言绑定（LicenseLangString），未列语言回退该文件', () => {
    const page = macros.get('licensePage').join('\n')
    assert.ok(page.includes('LicenseLangString MUILicense 2052'), `缺少 zh_CN 语言绑定：${page}`)
    assert.ok(page.includes('LicenseLangString MUILicense 1033'), `未为 en_US 回退到同一份协议：${page}`)
  })

  console.log('installer license checks passed')
}

void main()
