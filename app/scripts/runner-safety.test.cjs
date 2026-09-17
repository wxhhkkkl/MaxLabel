// 回归 runner 自身的「安全收尾」约束。
//
// 背景：round-83 与 round-100 两次实测「全量 test:ui 整轮中止、无汇总行」
// （一次退出码 1、一次退出码 0），门禁日志因此分不清「runner 跑挂了」还是「断言失败」。
// 两个根因分别是：
//   ① 清理按 ParentProcessId 遍历进程树杀进程——Windows 会回收 PID，electron 已退出时
//      从它那个 PID 出发会踏进无关进程树，把 runner 自己/npm 宿主杀掉；
//   ② 汇总行不在 finally 里——runner 自身一异常就再也打不出结论行。
// 本文件把这两条钉成静态断言：改回去就红。
const fs = require('fs')
const path = require('path')

const root = path.resolve(__dirname, '..')
// 仓库在 Windows 上检出为 CRLF：先归一成 LF，断言才不受行尾影响。
const runner = fs
  .readFileSync(path.join(root, 'scripts/run-regression.ps1'), 'utf8')
  .replace(/\r\n/g, '\n')

// 取一个函数的函数体（从 `function X` 到下一个行首 `}`）。
function fnBody (name) {
  const start = runner.indexOf(`function ${name}`)
  if (start < 0) throw new Error(`run-regression.ps1 里找不到函数 ${name}`)
  const end = runner.indexOf('\n}\n', start)
  if (end < 0) throw new Error(`函数 ${name} 的函数体没有正常结束`)
  return runner.slice(start, end)
}

const cleanupFinally = runner.match(/\} finally \{[\s\S]*?\n\}/)
if (!cleanupFinally) throw new Error('run-regression.ps1 里找不到每脚本的清理 finally 块')

// 汇总 finally 是所有 `} finally {` 里含 ALL SCRIPTS PASSED 的那一个（即最外层）。
const summaryFinallyAt = runner.indexOf('ALL SCRIPTS PASSED')
const tryAt = runner.lastIndexOf('try {', summaryFinallyAt)
const catchAt = runner.lastIndexOf('} catch {', summaryFinallyAt)
const finallyAt = runner.lastIndexOf('} finally {', summaryFinallyAt)

const checks = [
  // ① 清理不得按进程树遍历杀进程。注意断言的是「调用」而非「提及」——
  //    函数名在解释缺陷的注释里出现是正常的。
  [!/Stop-ProcessTree\s+-RootProcessId/.test(runner), '清理不得再调用 Stop-ProcessTree（按 PID 遍历进程树会被 PID 回收带偏，杀掉 runner 自己）'],
  [!/function\s+Stop-ProcessTree/.test(runner), 'Stop-ProcessTree 定义必须删除，避免有人再调用它'],
  [!fnBody('Stop-TestElectronProcesses').includes('ParentProcessId'), 'Stop-TestElectronProcesses 不得按 ParentProcessId 找进程'],
  [!fnBody('Stop-StaleMaxLabelProcesses').includes('ParentProcessId'), 'Stop-StaleMaxLabelProcesses 不得按 ParentProcessId 找进程'],
  [fnBody('Get-ProfileElectronProcesses').includes('CommandLine') && fnBody('Get-ProfileElectronProcesses').includes('ProfilePath'),
    '杀进程必须按本次 profile 路径匹配命令行（Chromium 子进程会继承 --user-data-dir）'],
  [fnBody('Stop-TestElectronProcesses').includes('Get-ProfileElectronProcesses'),
    'Stop-TestElectronProcesses 必须复用 Get-ProfileElectronProcesses 的匹配口径'],
  // Stop-Process 是异步的：不等待就直接 Remove-Item，会删到一半撞上仍被占用的文件，
  // 目录留下残骸（实测 ui-v108 残留 1 个目录 / 1 个文件）。
  [/WaitSeconds/.test(fnBody('Stop-TestElectronProcesses')),
    'Stop-TestElectronProcesses 必须等进程真正退出（Stop-Process 异步，否则 Remove-Item 静默失败）'],
  [/\$electronProcess\) \{\s*\n\s*#[^\n]*\n\s*Stop-TestElectronProcesses -ProfilePath \$uiProfile/.test(cleanupFinally[0]),
    '每脚本清理必须调用 Stop-TestElectronProcesses -ProfilePath（且不得再调 Stop-ProcessTree）'],

  // ② 汇总行必须落在整份循环的 finally 里
  [tryAt >= 0 && catchAt > tryAt, '脚本主循环必须套在 try 里并有 catch 兜底'],
  [finallyAt > catchAt, '主循环必须有 finally'],
  [summaryFinallyAt > finallyAt, 'ALL SCRIPTS PASSED / FAILED SCRIPTS 必须打印在 finally 块内（任何异常路径都要出汇总行）'],
  // 用 lastIndexOf：这两个词在解释缺陷的注释里也会出现，只有最后一处才是真正的打印语句。
  [runner.lastIndexOf('FAILED SCRIPTS') > finallyAt, 'FAILED SCRIPTS 行必须打印在 finally 块内'],
  [runner.includes('$runnerAborted'), 'runner 自身异常必须落一行可区分的 `runner 内部异常：...`，而不是静默中止'],
  [/if \(\$currentScript -and \(\$failedScripts -notcontains \$currentScript\)\)/.test(runner),
    '异常中止时必须把当时正在跑的脚本记进 FAILED SCRIPTS'],
  [runner.includes('[Console]::Out.Flush()'), '汇总行打印后必须 flush，避免管道截断时丢失结论行'],

  // ③ 中止残留的 profile 目录要能自愈：中止过的回归走不到 finally，目录会永久留在 %TEMP%。
  [/function Remove-StaleUiProfiles/.test(runner), '必须有 Remove-StaleUiProfiles 清扫中止残留的 profile 目录'],
  [fnBody('Remove-StaleUiProfiles').includes("'^maxlabel-ui-[0-9a-f]{32}$'"),
    'Remove-StaleUiProfiles 只许删 maxlabel-ui-<32位十六进制> 形态的目录，不得波及 %TEMP% 其它内容'],
  [/\$regressionLock = Get-RegressionLock[\s\S]{0,200}Remove-StaleUiProfiles/.test(runner),
    '清扫必须排在拿到独占锁之后：锁前清扫可能删掉另一个正在跑的回归的 profile']
]

for (const [ok, message] of checks) {
  if (!ok) throw new Error(message)
}
console.log(`${checks.length} runner safety checks passed`)
