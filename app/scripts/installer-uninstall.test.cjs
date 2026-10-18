/* E-13/E-14/E-15 卸载向导（帮助 install_uninstall.html）。
 *
 * 帮助原文的顺序：第 1 步启动卸载程序；第 2 步确认需要卸载签赋LabelShop；
 * 第 3 步删除程序文件和快捷方式等；第 4 步删除用户文件和激活信息等（**文档建议保留**，
 * 以备再次安装后使用）；第 5 步卸载完成。入口为开始菜单的「卸载 签赋LabelShop」
 * 或「控制面板——程序和功能」中双击「签赋LabelShop」。
 *
 * 复刻版用 electron-builder 的 NSIS 打包。本测试不另写一套判定，直接读 electron-builder
 * 自己会编译进安装包的 NSIS 模板（`templates/nsis/*.nsh`）与本仓库真实的打包配置，
 * 断言卸载向导的页序、删除范围与「默认保留用户文件」的口径。 */
const assert = require('node:assert')
const fs = require('node:fs')
const path = require('node:path')

const appRoot = path.resolve(__dirname, '..')
const nsisTemplates = path.join(appRoot, 'node_modules', 'app-builder-lib', 'templates', 'nsis')

function readTemplate(...parts) {
  const file = path.join(nsisTemplates, ...parts)
  assert.ok(fs.existsSync(file), `缺少 electron-builder NSIS 模板：${file}`)
  return fs.readFileSync(file, 'utf8')
}

function check(name, fn) {
  fn()
  console.log(`ok - ${name}`)
}

/** 模板里 `!ifdef BUILD_UNINSTALLER ... !else ... !endif` 的卸载分支。 */
function uninstallerBranch(assistedInstaller) {
  const marker = '!ifndef BUILD_UNINSTALLER'
  const start = assistedInstaller.indexOf(marker)
  assert.ok(start >= 0, 'assistedInstaller.nsh 未找到 BUILD_UNINSTALLER 分支')
  const rest = assistedInstaller.slice(start)
  const elseAt = rest.indexOf('\n!else')
  assert.ok(elseAt >= 0, 'assistedInstaller.nsh 的 BUILD_UNINSTALLER 分支缺少 !else')
  // 卸载分支以该 !ifndef 块末尾的 !endif 收尾；页宏都出现在此区间内。
  return rest.slice(elseAt)
}

async function main() {
  const pkg = JSON.parse(fs.readFileSync(path.join(appRoot, 'package.json'), 'utf8'))
  const nsis = (pkg.build && pkg.build.nsis) || {}
  const assistedInstaller = readTemplate('assistedInstaller.nsh')
  const uninstaller = readTemplate('uninstaller.nsh')
  const installerInclude = readTemplate('include', 'installer.nsh')
  const common = readTemplate('common.nsh')

  const unBranch = uninstallerBranch(assistedInstaller)

  // ---------- E-14 第 1–3 步：卸载向导页序与删除动作 ----------

  check('E-14 帮助第 1 步「启动卸载程序」→ 向导首页为卸载欢迎页（MUI_UNPAGE_WELCOME）', () => {
    assert.ok(
      unBranch.includes('!insertmacro MUI_UNPAGE_WELCOME'),
      'BUILD_UNINSTALLER 分支未插入 MUI_UNPAGE_WELCOME'
    )
  })

  check('E-14 帮助第 2–3 步「确认卸载 / 删除程序文件和快捷方式」→ 主体页为 MUI_UNPAGE_INSTFILES', () => {
    assert.ok(
      unBranch.includes('!insertmacro MUI_UNPAGE_INSTFILES'),
      'BUILD_UNINSTALLER 分支未插入 MUI_UNPAGE_INSTFILES'
    )
    // 辅助式（非 oneClick）安装的卸载会在进主体页前确认程序已退出，对应「确认卸载」。
    assert.ok(
      uninstaller.includes('call un.checkAppRunning'),
      '卸载主体段未调用 un.checkAppRunning（确认卸载前置检查）'
    )
  })

  check('E-14 删除程序文件：卸载主体段递归删除安装目录（RMDir /r $INSTDIR）', () => {
    assert.ok(
      uninstaller.includes('RMDir /r $INSTDIR'),
      '卸载主体段未删除安装目录'
    )
  })

  check('E-14 删除快捷方式：卸载主体段删除开始菜单与桌面快捷方式', () => {
    assert.ok(
      uninstaller.includes('Delete "$oldStartMenuLink"'),
      '未删除开始菜单快捷方式'
    )
    assert.ok(
      uninstaller.includes('Delete "$oldDesktopLink"'),
      '未删除桌面快捷方式'
    )
    // 快捷方式删除受安装时是否创建控制，与本仓库 nsis 配置一致（见 E-13 断言）。
    assert.ok(
      uninstaller.includes('!ifndef DO_NOT_CREATE_START_MENU_SHORTCUT') &&
        uninstaller.includes('!ifndef DO_NOT_CREATE_DESKTOP_SHORTCUT'),
      '快捷方式删除未受创建开关约束'
    )
  })

  check('E-14 辅助式（多步）卸载向导：build.nsis.oneClick 为 false', () => {
    assert.strictEqual(nsis.oneClick, false, `oneClick 应为 false，实际 ${JSON.stringify(nsis.oneClick)}`)
    // ONE_CLICK 未定义时，模板走 MessageBox 确认 + 多步向导而非一键静默卸载。
    assert.ok(
      uninstaller.includes('!ifdef ONE_CLICK'),
      '模板缺少 ONE_CLICK 分支，无法确认辅助式卸载路径'
    )
  })

  // ---------- E-15 第 4–5 步：用户文件与激活信息的保留口径 ----------

  check('E-15 帮助第 4 步「删除用户文件和激活信息（建议保留）」→ 默认保留', () => {
    assert.notStrictEqual(
      nsis.deleteAppDataOnUninstall,
      true,
      'deleteAppDataOnUninstall 不应启用：帮助建议保留用户文件和激活信息以供再次安装使用'
    )
    // 未定义 DELETE_APP_DATA_ON_UNINSTALL 时，$isDeleteAppData 保持初值 "0"。
    assert.ok(
      uninstaller.includes('StrCpy $isDeleteAppData "0"'),
      '卸载主体段未把「删除用户数据」默认置为否'
    )
    assert.ok(
      uninstaller.includes('!ifdef DELETE_APP_DATA_ON_UNINSTALL'),
      '删除用户数据未受编译期开关约束'
    )
  })

  check('E-15 只在该开关被显式打开时才会删除用户数据（NsisTarget 的判定条件）', () => {
    const target = fs.readFileSync(
      path.join(appRoot, 'node_modules', 'app-builder-lib', 'out', 'targets', 'nsis', 'NsisTarget.js'),
      'utf8'
    )
    const conditional = /if \(options\.deleteAppDataOnUninstall\)\s*\{\s*defines\.DELETE_APP_DATA_ON_UNINSTALL = null/
    assert.ok(
      conditional.test(target),
      'electron-builder 未按 options.deleteAppDataOnUninstall 控制 DELETE_APP_DATA_ON_UNINSTALL 定义'
    )
  })

  check('E-15 用户数据删除位置覆盖用户文件（$APPDATA 下的应用目录）', () => {
    assert.ok(
      uninstaller.includes('RMDir /r "$APPDATA\\${APP_FILENAME}"'),
      '未定义用户文件的删除位置'
    )
  })

  check('E-15 帮助第 5 步「卸载完成」→ 向导末页为 MUI_UNPAGE_FINISH', () => {
    assert.ok(
      unBranch.includes('!insertmacro MUI_UNPAGE_FINISH'),
      'BUILD_UNINSTALLER 分支未插入 MUI_UNPAGE_FINISH'
    )
    // 页序必须为 欢迎 → 主体 → 完成，与帮助第 1/2-3/5 步顺序一致。
    const welcome = unBranch.indexOf('MUI_UNPAGE_WELCOME')
    const instfiles = unBranch.indexOf('MUI_UNPAGE_INSTFILES')
    const finish = unBranch.indexOf('MUI_UNPAGE_FINISH')
    assert.ok(
      welcome >= 0 && welcome < instfiles && instfiles < finish,
      `卸载页序应为 欢迎→主体→完成，实际下标 ${welcome}/${instfiles}/${finish}`
    )
  })

  // ---------- E-13 两个卸载入口 ----------

  check('E-13 入口一「控制面板——程序和功能」：注册表写入 UninstallString', () => {
    assert.ok(
      installerInclude.includes('WriteRegStr SHELL_CONTEXT "${UNINSTALL_REGISTRY_KEY}" UninstallString'),
      '未写入控制面板所需的 UninstallString'
    )
    assert.ok(
      installerInclude.includes('WriteRegStr SHELL_CONTEXT "${UNINSTALL_REGISTRY_KEY}" DisplayName'),
      '未写入控制面板所需的 DisplayName'
    )
    // 64 位机器上「程序和功能」读的是 WOW6432Node 之外的第二处键。
    const target = fs.readFileSync(
      path.join(appRoot, 'node_modules', 'app-builder-lib', 'out', 'targets', 'nsis', 'NsisTarget.js'),
      'utf8'
    )
    // 源码里该行形如：defines.UNINSTALL_REGISTRY_KEY_2 = `Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\${guid}`
    // （each `\\` in the NSIS path is written as `\\\\` in the JS source）——匹配时按源码原文取。
    assert.ok(
      target.includes('UNINSTALL_REGISTRY_KEY_2') &&
        /UNINSTALL_REGISTRY_KEY_2 = `Software(\\\\+Microsoft)+/.test(target) &&
        target.includes('CurrentVersion') &&
        target.includes('Uninstall'),
      '未注册 64 位「程序和功能」卸载键（UNINSTALL_REGISTRY_KEY_2）'
    )
  })

  check('E-13 入口二「开始菜单」：开始菜单只建应用快捷方式，不建卸载快捷方式（与真机实测一致）', () => {
    assert.strictEqual(nsis.createStartMenuShortcut, true, 'createStartMenuShortcut 应为 true')
    assert.ok(nsis.shortcutName, '缺少 shortcutName，开始菜单项名称未定义')

    // 真机取证（parity/reference/labelshop/E13-uninstall-entries.txt）：真机安装的
    // 「开始菜单 → LabelShop」分组内只有 `签赋LabelShop.lnk` 一个应用快捷方式，
    // 两个开始菜单树内都没有指向卸载器 `labelshop_ul.exe` 的 .lnk —— 帮助写的「入口二」
    // 在这套真机安装上并不存在。复刻版照做：开始菜单不额外创建卸载快捷方式。
    const startMenuCreates = installerInclude.match(/CreateShortCut "\$newStartMenuLink"/g) || []
    assert.strictEqual(
      startMenuCreates.length,
      1,
      `开始菜单快捷方式应只创建一次（应用本体），实际 ${startMenuCreates.length} 次`
    )
    assert.ok(
      /CreateShortCut "\$newStartMenuLink" "\$appExe"/.test(installerInclude),
      '开始菜单快捷方式的目标不是应用本体 $appExe'
    )
    // 任何把开始菜单项指向卸载器的写法都必须不存在（真机同样没有）。
    assert.ok(
      !/CreateShortCut "\$newStartMenuLink"[^\n]*UNINSTALL_FILENAME/.test(installerInclude),
      '开始菜单快捷方式被指向了卸载器，与真机实测不符'
    )
    // 本仓库未通过 build.nsis.include 注入自定义卸载快捷方式。
    const customInclude = nsis.include ? fs.readFileSync(path.resolve(appRoot, nsis.include), 'utf8') : ''
    assert.ok(
      !/CreateShortCut[^\n]*(UNINSTALL_FILENAME|labelshop_ul|Uninstall)/i.test(customInclude),
      'build.nsis.include 注入了开始菜单卸载快捷方式，与真机实测不符'
    )
  })

  check('E-13 入口一在无开始菜单卸载项时仍可用：UninstallString 指向安装目录内的卸载程序', () => {
    // 真机的 UninstallString 是 `C:\Program Files (x86)\LabelShop\LabelShop\labelshop_ul.exe`
    // —— 卸载器就在安装目录里、由注册表直接指向。复刻版必须同构。
    assert.ok(
      installerInclude.includes('StrCpy $2 "$INSTDIR\\${UNINSTALL_FILENAME}"'),
      'UninstallString 未指向 $INSTDIR 内的卸载程序'
    )
    assert.ok(
      installerInclude.includes(
        'WriteRegStr SHELL_CONTEXT "${UNINSTALL_REGISTRY_KEY}" UninstallString \'"$2" $0\''
      ),
      'UninstallString 未使用安装目录内的卸载程序路径 $2'
    )
    assert.ok(
      installerInclude.includes(
        'WriteRegStr SHELL_CONTEXT "${UNINSTALL_REGISTRY_KEY}" QuietUninstallString \'"$2" $0 /S\''
      ),
      'QuietUninstallString 未使用安装目录内的卸载程序路径 $2'
    )
  })

  check('E-13 卸载程序文件随安装写入安装目录（Uninstall <产品名>.exe）', () => {
    assert.ok(
      common.includes('!define UNINSTALL_FILENAME "Uninstall ${PRODUCT_FILENAME}.exe"'),
      '未定义卸载程序文件名'
    )
    assert.ok(
      installerInclude.includes('File "/oname=${UNINSTALL_FILENAME}" "${UNINSTALLER_OUT_FILE}"'),
      '安装时未把卸载程序写入安装目录'
    )
  })

  console.log('installer uninstall checks passed')
}

void main()
