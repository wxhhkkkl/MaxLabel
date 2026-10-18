# 标签脚本执行范围

本项目运行的是受限 VBScript/JavaScript 子集，不是 Windows VBScript 引擎，也不执行任意 JavaScript。
语法检查、对象脚本、打印生命周期脚本共用 `src/shared/domain/scriptRuntime.ts`。

## 支持的内容

- 对象入口：`OnGetData()`，VBScript 通过赋值返回，JavaScript 通过 `return` 返回。
- 打印入口：`OnBeginPrint(State)`、`OnBeginLabel()`、`OnEndLabel()`、`OnEndPrint()`。
- 变量赋值、VBScript `Dim`、JavaScript `let`/`const`/`var`、提前返回。
- VBScript 多行及单行 `If/Then/Else`、`ElseIf`，JavaScript 带花括号的 `if/else if/else`，支持嵌套。
- 算术、比较、拼接、括号、VBScript `Not/And/Or/Mod`、整除及幂运算、JavaScript `!`/`&&`/`||` 和三元表达式。
- VBScript 双引号转义、单引号及 `Rem` 注释；JavaScript 字符串转义、行注释及块注释。
- 常用受限函数：`CStr`、`CInt`、`CLng`、`CDbl`、`String`、`Len`、`UCase`、`LCase`、`Trim`、`Left`、`Right`、`Mid`、`Replace`、`Abs`。
- 项目提供的格式化和校验函数：`FormatNumber(value, digits)` 输出不带分组符的固定小数；`Mod10(text)` 使用从右向左交替 3/1 权重计算数字校验字符。
- JavaScript 字符串成员：`trim()`、`toUpperCase()`、`toLowerCase()`、`length`，兼容旧模板的 `length()`。

## 变量和兼容性

VBScript 变量不区分大小写；JavaScript 变量区分大小写。
函数内声明的局部变量不会发布为共享变量。生命周期函数中未声明的赋值可作为任务共享变量，并保留数字、布尔值及字符串类型。
VBScript `Dim` 和 JavaScript `var` 按函数作用域预先建立绑定；JavaScript `let`/`const` 在其块内初始化前不可访问。
对象脚本只通过数据源的 `sharedName` 发布返回文本，不把临时变量泄露给其他对象。
发布返回文本时会同步替换原有类型信息，即使文本与旧值的显示形式相同，也不沿用旧数字或布尔类型。
成功返回空文本也会清除共享旧值；执行失败或未启用脚本时不发布结果。VBScript 发布时合并大小写别名，JavaScript 仍区分大小写。
`Option Explicit` 下要求声明普通变量，内置标签变量及 `OnGetData` 不需要额外声明。

优先按语言字段解析。为兼容旧模板，失败时可使用另一种语言，但只有完整解析出函数程序才接受该回退；注释和字符串不会决定语言。
无函数包装时按数据源声明的语言解析；未声明时保持旧版本的 JavaScript 默认行为。
部分旧版本运算符写法跨语言保留，因此该子集不应视为原生语言的完整兼容实现。

## 不支持的内容

循环、自定义辅助函数、对象/数组、COM、文件/网络访问、动态求值及任意宿主成员访问不受支持；语法检查明确报错。
“公共脚本”当前通过命名返回值共享数据，不代表可定义任意可调用的公共函数库。
未知变量、无效数字、除零等运行时错误仍可能出现在语法合法的脚本中；对象返回空文本，全局脚本不发布部分状态并抛出包含钩子和标签位置的错误，中止当前打印或预览。
分批打印发生错误时不提交失败批次，仅推进之前已确认发送批次的序列号；已经发送的标签无法撤回。
诊断成功表示属于可解析的子集，不保证特定打印数据下不存在运行时错误。

## 安全限制和测试

脚本最长 256 KB，最多 16000 个词法单元、64 层嵌套、20000 个执行步骤；单个字符串结果最长 1 MB。
变量与结果的字符串累计长度上限为 4194304 个 UTF-16 单元；每次函数执行累计产生的字符串上限为 16777216 个 UTF-16 单元。
总量检查覆盖初始共享变量、局部变量和赋值，替换及退出块作用域会释放对应额度。超限执行不发布部分共享状态。
解析缓存限制为 128 项及约 1 MB 源码。禁止的宿主标识符只检查实际代码，不误判字符串或注释。
模板代码不会交给 `eval`、`Function` 或 Windows 脚本宿主执行。

`scripts/script-runtime-regression.cjs` 覆盖两种语言、语法与执行一致性、作用域、生命周期、字符串、资源限制、预定义脚本及编辑器交互。
完整测试入口为 `npm test`。
