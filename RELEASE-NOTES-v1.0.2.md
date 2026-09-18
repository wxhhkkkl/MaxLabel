# MaxLabel v1.0.2 发布说明

**基线**：v1.0.1（2026-09-17）
**本次类型**：按《软件功能需求清单》交叉比对补齐 3 项缺口 + 启始页菜单栏与真机对齐
**日期**：2026-09-18

---

## 一、按《软件功能需求清单》补齐的 3 项（从「×/未见」里筛出确实缺的项）

清单共 281 条（对象属性 100 / 数据源 57 / 对象编辑 28 / 数据库 27 / 标签格式 21 / 打印和预览 17 / 其它 15 / 打印机属性 6 / 系统选项 6 / 软件与登录授权 4），逐条与 `parity/matrix.md` 605 条做交叉比对后，只有下面 3 项是**我们确实没有、而清单要求有**的，本轮补齐：

### ① 标签纸颜色（编辑期标签底色）

- 标签属性对话框新增纸色板（含十一档预设）与实时预览；`layout.labelColor` 随文档序列化并被归一化（`normalizeLabelColor`，含旧文档缺省兜底）。
- 只影响**编辑期底色**，不进打印输出（与真机「纸张颜色只改编辑界面底色」一致）。
- 证据：`parity/reference/maxlabel/FEAT-label-color.png`、场景 `tools/parity/scenarios/label-color-check.json`。

### ② 图片对象的「无效图片」处理

- 对象属性 → 图片页新增下拉：**中止 / 忽略 / 占位**（`data-testid=image-missing-behavior`），对应 `rendering/fabricObjects.ts` 的 `missingImage` 三策略与 `imagePlaceholder` 占位绘制。
- 链接式图片指向不存在的文件时不再整张画布报错。

### ③ 图片「可变颜色 → 单色」的真像素判定

- 新增 `detectMonochrome`（128×128 采样、忽略透明像素、≤2 色判单色），属性对话框按判定结果给出「单色」/「非单色，打印机可能不支持」两种提示，不再只按勾选项猜。

> 其余清单条目**不改**，理由分三类：①清单的「×」并不等于「原版不支持」（例如「数据源/常量」「数据库/数据预览」在真机帮助里明确存在，我们已实现），语义需与清单作者对齐；②属三版本分层字段（如条码「缩减量」）或硬件锁/服务端运营项，我们已在 `parity/matrix.md` E 区记录为边界；③我们比清单更全的项（附加条码、子串、数据预览、移到指定记录号、作业份数、表格、Ctrl+B、多对象旋转、解组等）保持不变。

## 二、启始页菜单栏与真机对齐（DIFF-36）

- **现象**：安装包启动冒烟 `ui-smoke.cjs` 的「menubar 12 menus」失败——启始页运行期只有 7 个顶层菜单。
- **真机依据**（本轮采集 `parity/reference/labelshop/probe-01-newlabel.png`）：启始页菜单栏与编辑态**同为 12 个**：文件(F) 编辑(E) 查看(V) 工具(T) 排列(A) 数据库(D) 账户(A) 云马通(C) 选项(O) 窗口(W) 帮助(H) 建议与反馈；两态差别只是「文件(F)」换成启始页专用条目、依赖文档的条目变灰。
- **修复**：启始页复用编辑态全部菜单 section，只替换「文件(F)」；依赖文档的条目按 `deps.isStart` 变灰。
- 取证记录见 `parity/reference/labelshop/PROBE-round104.md`。

## 三、真机取证记录（标签格式联动）

用窗口消息工装 `tools/parity/Probe-LabelShopCombos.ps1` 读取真机「选择标签格式」页的四组下拉，并把「打印机」从 `Microsoft Print to PDF` 切到 HP 激光打印机：

| 下拉 | 内容 |
| --- | --- |
| 打印机 | 3 项（HP 激光 / Microsoft Print to PDF / OneNote） |
| 标签品牌 | 2 项（京成云马标签 / 普林泰科标签） |
| 标签类型 | 1 项（云马优质打印纸标签） |
| 标签名称 | 42 项（`[608051] 210mm x 297mm 直角1枚/页 20页/盒` …） |

切换打印机后三者**列表不变**；本机三台打印机都是普通打印机，没有标签/卷筒打印机，**无法证伪也无法证实**清单里「标签品牌随打印机联动」这一条。可确认的是三个下拉的内容来自标签格式库 `LabelFormat360.fmt`（SQLite，275 行），不是从驱动实时枚举。

---

## 验证（回归锁定）

| 测试 | 结果 |
| --- | --- |
| `ui-v117.cjs`（新增，11 条） | **11/11 PASS**：标签纸颜色、图片无效策略、单色判定提示 |
| `ui-v118.cjs`（新增，9 条） | **9/9 PASS**：启始页 12 个顶层菜单且标题顺序同真机、编辑/工具菜单条目全灰、数据库与窗口禁用项、启始页专用「文件(F)」、编辑态序列一致、编辑态「条码(B)」可用 |
| `ui-v52.cjs`（同步修正判据） | **66/66 PASS**：原先用「编辑(E) 菜单是否存在」区分启始页/编辑态，启始页补齐 12 项后该判据失效，改用画布与 `[data-testid=start-page]` |
| `matrix-evidence.test.cjs` | 通过（599 行）；修复了 A-174 证据里散文片段被误判为路径的问题 |
| `Check-Matrix.ps1` | 通过：605/605 已实现（A272 / B141 / C101 / D75 / E16），部分/未实现/待核 均为 0 |
| `render-regression` | 54 项通过（新增 6 项） |
| 其余门禁 | `typecheck` / `test:architecture` / `test:editor` / `test:geometry` / `test:history` / `test:print` / `test:workspace` / `test:barcode` / `test:color` / `test:label-formats` / `test:installer` 全部通过 |
| 全量 UI 回归 | `ui-v48 … ui-v118` 共 69 个脚本全过 |

---

## 产物

| 产物 | 路径 |
| --- | --- |
| 安装包 | `app/release/MaxLabel-Setup-1.0.2.exe`（129.25 MB，未签名内部测试包） |
| 分块映射 | `app/release/MaxLabel-Setup-1.0.2.exe.blockmap` |
| 免安装目录 | `app/release/win-unpacked/` |
| 校验和 | `RELEASE-SHA256.txt` |

打包命令：`cd app && npm run dist`（未配置代码签名证书时自动走未签名路径）
