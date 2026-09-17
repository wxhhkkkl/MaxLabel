# MaxLabel v1.0.1 发布说明（缺陷修复版）

**基线**：v1.0.0（2026-09-17）
**本次类型**：创建对象交互的缺陷修复（用户实测反馈）
**日期**：2026-09-17

---

## 修复内容

### ① 表格渲染错位 / 不完整（严重）

- **现象**：用「表格」工具拖拽创建后，画布上看不到表格（或位置与落点不符）。
- **根因**：表格原先用 `fabric.Group` 把外框 + 内部网格线拼成一个组。fabric 7.4 的 `Group` 会按「组中心」重新布局子元素，实测把**组包围盒撑到内容的 1.5 倍**、子元素被重排到组内负坐标，表格因此被画到画布原点附近而不是模型位置（打印路径同样受影响）。
- **修复**：改为**单条 `fabric.Path`** 绘制（外框 + 依 `tableColXs/tableRowYs` 生成的内部竖/横线，合并单元格仍省略对应线段）。几何诊断：位置偏差 **0**、尺寸偏差 **0**。

### ② 对象工具没有十字指针

- **现象**：选中文字/表格/条码（含二维码）等工具后，鼠标在画布上不是十字光标，尤其经过已有对象时。
- **根因**：只设置了 `defaultCursor`；fabric 悬停对象时会改用 `hoverCursor`（默认 `move`）覆盖它。
- **修复**：工具模式下同时设置 `hoverCursor='crosshair'`，选择工具恢复 `move`。

### ③ 斜线未按拖拽方向绘制（点对点语义）

- **现象**：斜线工具从右上往左下（或反向）拖动时，画出的对角线方向与手的动作相反。
- **根因**：模型只有包围盒 `x/y/w/h`，渲染固定为「左上→右下」对角线，拖拽方向在创建时丢失。
- **修复**：创建时把拖拽方向传给创建逻辑，`↗`/`↙` 方向置 `flipY=true`（模型已有并可序列化字段）。

> 说明：`线条` 工具仍按帮助 `label_object_create_drag.html` 只创建水平/垂直线条（按拖拽主轴吸附）；`表格` 拖拽包围盒即表格大小（默认 3 行 × 2 列），与帮助「表格选中的是表格的大小」一致。

---

## 验证（回归锁定）

| 测试 | 结果 |
| --- | --- |
| `ui-v116.cjs`（新增，10 条断言） | **10/10 PASS**：7 个对象工具空白处十字指针、工具模式经过对象仍十字指针、选择工具恢复默认、表格宽高跟随拖拽、表格竖线 3 条/横线 4 条（完整表格）、表格未错位到标签左上角、↘ 与 ↗ 斜线方向 |
| `render-regression`（新增 2 条几何断言） | **48 项通过**：`table object sits at its model x/y` / `keeps the exact model size` |
| 其余门禁 | `typecheck` / `test:architecture` / `test:editor` / `test:geometry` / `test:history` / `test:print` / `test:workspace` / `test:barcode` / `test:color` / `test:label-formats` / `build` 全部通过 |
| 全量 UI 回归 | `ui-v48 … ui-v116` 全部通过（67 个脚本） |
| 副作用修复 | `ui-v97`（升级检查）原先硬编码版本号 `0.1.0`，改为从 `app/package.json` 动态读取，避免每次发版误报 |

---

## 产物

| 产物 | 路径 |
| --- | --- |
| 安装包 | `app/release/MaxLabel-Setup-1.0.1.exe` |
| 分块映射 | `app/release/MaxLabel-Setup-1.0.1.exe.blockmap` |
| 免安装目录 | `app/release/win-unpacked/` |
| 校验和 | `RELEASE-SHA256.txt` |

打包命令：`cd app && npm run dist`（内部未签名路径自动跳过签名；配置 `CSC_LINK`/`WIN_CSC_LINK` 后会自动签名）
