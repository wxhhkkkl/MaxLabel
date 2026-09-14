$ErrorActionPreference = 'Stop'
$root = 'D:\workspace\maxlabel\parity'
$body = Get-Content (Join-Path $root '_work\rows\_body.md') -Raw -Encoding UTF8
$rows = $body -split "`r?`n" | Where-Object { $_ -match '^\| [A-E]-\d+ \|' }
$total = $rows.Count
$counts = @{}
foreach ($k in 'A','B','C','D','E') { $counts[$k] = ($rows | Where-Object { $_ -match "^\| $k-" }).Count }
$srcDir = 'D:\workspace\maxlabel\app\docs\labelshop-help-zh'
$fileCount = (Get-ChildItem "$srcDir\*.html").Count
$perFile = Get-Content (Join-Path $root '_work\rows\_perfile.json') -Raw -Encoding UTF8 | ConvertFrom-Json
$covered = 0; foreach ($p in $perFile.PSObject.Properties) { $covered++ }

$intro = @"
# LabelShop 中文帮助功能 parity 清单

## 说明

- **来源**：``D:\workspace\maxlabel\app\docs\labelshop-help-zh\`` 目录下全部 $fileCount 个 LabelShop 6.37 中文联机帮助 HTML 文件（GB2312 编码，页脚版本号 Ver 6.37，版权方 京成云马（北京）科技有限公司）。另参考 ``app\docs\labelshop-compatibility-audit.md`` 的模块边界与既有结论，但本清单的"原版行为要点"一律以帮助文档正文为准，不引用审计文档的结论。
- **生成方式**：先把每个 HTML 的 ``#winchm_template_content`` 正文区按 GB2312 解码、剥离模板样式/脚本/侧栏/页脚与全部 ``<img>``，转成纯文本作为唯一事实来源；再逐文件提炼"用户可执行的原子操作或可见元素"成条；最后由脚本按章节统一编号（``A-01``、``B-01``…每章内连续、按提取顺序）并生成下表。凡帮助文档指明了默认值、快捷键、取值范围、单位、枚举、顺序或错误处理的，均写入"原版行为要点"列；文档未写的细节一律不补。
- **编号规则**：``<章节字母>-<序号>``（序号在章节内从 01 起连续，超过 99 条时自然进入三位数，如 ``A-100``）。功能点按"界面路径 → 具体控件/命令"组织。
- **复刻状态取值含义**（与 ``parity/README.md`` 的验收口径一致）：
  - ``待核``：本清单当前全部条目使用的状态。表示该条已从帮助文档提取并登记，但尚未在 MaxLabel 中逐项对照验证，也未附证据。
  - ``已实现``：MaxLabel 中的入口、交互、快捷键、默认值与输出结果与原版一致，且已附可复现证据。
  - ``部分``：入口存在但行为有差异（如缺少默认值、选项枚举不全、单位或范围不同）。
  - ``未实现``：MaxLabel 中无对应功能。
  - 建议附加说明：原行为依赖已淘汰的模型（如 MDI 子窗口管理）或无法在浏览器/Electron 环境复刻、已按 ``app\docs\labelshop-compatibility-audit.md`` 采用等价替代的条目，在"证据"列注明"等价替代"以便区分于"未实现"。
- **证据列**：留空，供后续对照时填写实现位置（文件/组件）、截图路径或测试用例编号。
- **统计**：共 $total 条，覆盖 $covered/$fileCount 个帮助文件。分章：A 界面与操作习惯 $($counts['A']) 条、B 编辑器对象能力 $($counts['B']) 条、C 数据源与数据库 $($counts['C']) 条、D 打印链路 $($counts['D']) 条、E 其他 $($counts['E']) 条。
- **溯源**：文件与编号区间的对照见 ``parity/matrix-sources.md``。

"@
$out = $intro + $body
[System.IO.File]::WriteAllText((Join-Path $root 'matrix.md'), $out, (New-Object System.Text.UTF8Encoding($false)))

# sources file
$sb = New-Object System.Text.StringBuilder
[void]$sb.AppendLine('# 帮助文档 → 生成编号区间对照表')
[void]$sb.AppendLine('')
[void]$sb.AppendLine("来源目录：``app\docs\labelshop-help-zh\``；共 $fileCount 个 HTML 文件，全部出现在本表中。")
[void]$sb.AppendLine('"编号区间"为该文件在 `matrix.md` 中贡献的条目编号（按矩阵中的出现顺序列出；编号不连续时用逗号逐项列出）。一个文件出现在多条条目的"出处文件"列时（如既作主出处又被交叉引用），这里会列出全部相关编号。')
[void]$sb.AppendLine('')
[void]$sb.AppendLine('| 帮助文档文件 | 编号 |')
[void]$sb.AppendLine('| --- | --- |')
$allFiles = Get-ChildItem "$srcDir\*.html" | Select-Object -ExpandProperty Name | Sort-Object
$missingList = @()
foreach ($f in $allFiles) {
  if ($perFile.PSObject.Properties.Name -contains $f) {
    $ids = @($perFile.$f)
    $nums = $ids | ForEach-Object { [int]($_ -replace '^[A-E]-','') }
    $prefix = ($ids[0] -split '-')[0]
    # compress consecutive within same prefix
    $segments = @()
    $start = $nums[0]; $prev = $nums[0]
    for ($i = 1; $i -lt $nums.Count; $i++) {
      if ($nums[$i] -eq $prev + 1) { $prev = $nums[$i]; continue }
      $segments += @($start, $prev); $start = $nums[$i]; $prev = $nums[$i]
    }
    $segments += @($start, $prev)
    $parts = @()
    for ($j = 0; $j -lt $segments.Count; $j += 2) {
      if ($segments[$j] -eq $segments[$j+1]) { $parts += ('{0}-{1:d2}' -f $prefix, $segments[$j]) }
      else { $parts += ('{0}-{1:d2}~{0}-{2:d2}' -f $prefix, $segments[$j], $segments[$j+1]) }
    }
    [void]$sb.AppendLine("| $f | $($parts -join ', ') |")
  } else {
    $missingList += $f
    [void]$sb.AppendLine("| $f | （未提取到条目） |")
  }
}
[void]$sb.AppendLine('')
if ($missingList.Count -gt 0) {
  [void]$sb.AppendLine('## 未生成条目的文件')
  [void]$sb.AppendLine('')
  foreach ($m in $missingList) { [void]$sb.AppendLine("- ``$m``") }
}
[System.IO.File]::WriteAllText((Join-Path $root 'matrix-sources.md'), $sb.ToString(), (New-Object System.Text.UTF8Encoding($false)))
"written matrix.md ($total rows) and matrix-sources.md; missing rows for $($missingList.Count) files"
