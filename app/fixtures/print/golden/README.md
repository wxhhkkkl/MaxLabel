# LabelShop 真机指令 golden

由 LabelShop「打印 → 打印到文件」导出，用于校准 `src/shared/print/*` 适配器。
生成日期：2026-11-19；模板：63 × 20 mm，Code128 `12345678`，对象位于 (3.75 mm, 2.25 mm)，
条宽 0.25 mm、宽窄比 3、柱高 10 mm，不印人读文字。

| 文件 | LabelShop 打印机 | 关键指令 |
| --- | --- | --- |
| `tsc-tspl-n.prn` | TSC TSPL-N (203 dpi) | `"128M"` + `!105` Start C |
| `zebra-zpl-n.prn` | Zebra ZPL-N (203 dpi) | `^BY2,3.0`、`>;` Start C |
| `zebra-epl-n.prn` | Zebra EPL-N (203 dpi) | `B22,18,…`（对象 x 比 TSPL 少 8 dot） |
| `zebra-cpcl-n.prn` | Zebra CPCL-N (203 dpi) | `! 0 203 203 …`、`B 128 …` |
| `toshiba-tec-tpcl-n.prn` | TOSHIBA-TEC TPCL-N (203 dpi) | `{…\|}` 帧、`XB` 类型 `A`、`>5` Start C |
| `sato-clnx-n.prn` | SATO CLNX-N (203 dpi) | STX/ETX 帧、`A1V0160H0504`、`BG02080>I12345678` |
| `sato-barcodes.prn` + `.lsdx` | SATO CLNX-N (203 dpi) | Code39/Codabar 用 `BT`+`BW`，Code93 用 `BC`；EAN/UPC/ITF 为 PCX |
| `sato-fonts.prn` + `.lsdx` | SATO CLNX-N (203 dpi) | `L` 放大倍数与 `WB1`/`WL1` 参数 |
| `sato-hri.prn` | SATO CLNX-N (203 dpi) | HRI 是独立的 `H/V/PS/L/U` 文字 |
| `printronix-pgl-n.prn` | Printronix PGL-N (203 dpi) | `!PTX_SETUP`、`~LOGO;…;PCX`、`SCALE;DOT;203;203` |
| `pgl-barcodes.prn` | Printronix PGL-N (203 dpi) | `XRD2…` / `XRD4…`（XRD 随窄条点数线性变化） |
| `pgl-barcode2.prn` + `.lsdx` | Printronix PGL-N (203 dpi) | `H3.20/7.19/5.20`（对象框高，单位英寸） |
| `sato-fonts-2.prn` + `.lsdx` | SATO CLNX-N (203 dpi) | `OA/OB` 字库与 `L0101/L0202` 倍数 |
| `pgl-text.prn` | Printronix PGL-N (203 dpi) | OCR 字库走 `ALPHA C10A/C10B`，系统字体为 PCX |

校准测试：`tests/unit/shared/print/golden-calibration.test.ts`。

## 有意保留的差异

- **CPCL 条宽/比例**：golden 记录该模板的驱动默认值 `1 1`；我们按对象设置换算，
  避免丢失用户的条宽设置。命令语法（`B` / `VB`）已对齐。
- **TPCL 位图**：golden 用 `SG` mode 5（二进制）；我们用 mode 1（十六进制），
  打印结果相同，同时保持输出为可安全写文件/日志的字符串。
- **TPCL 标签间距**：golden 为 `D0230`（20 mm 标签 + 3 mm 间隙）；当前配置只有
  `labelType`，暂按全局 2 mm 间隙输出。
- **EPL 预置命令**：golden 用 `I8/q/WN/ZB`；我们保留合法 EPL2 的 `N/q/Q/D/S`。
- **SATO 位置**：golden 的 `H/V` 坐标经过 LabelShop 驱动的布局变换；我们按画布对象位置直接换算，
  只校准命令语法（帧、`BG` 参数、`GP` 长度）。
- **PGL 条码**：原生 `BARCODE` 用于 Code128（偶数位纯数字用 golden 确认的 `\x0E'` Start C；
  其它内容交给 PGL 自动子集）。XRD 已确认等于窄条点数（2 dot→XRD2，4 dot→XRD4）；
  `H` 已确认是对象框高的英寸值（.lsdx high=500 + 3.13mm 余量 → 8.13mm → H3.20）。
- **SATO 码制**：LabelShop 只对 Code39/Code93/Codabar/Code128 发原生命令；ITF/EAN/UPC
  在 golden 中仍是 PCX，适配器保持一致。码制特殊选项（GS1、附加码、校验设置）一律退回位图。
- **SATO HRI**：golden 用独立的 `U` 文字命令；本程序用画布位图叠加，字形/位置与编辑器一致。
- **PGL 文字**：仅 `Printronix OCR-A/B` 走原生 `ALPHA`（`C10A/C10B`）；LabelShop 把这两种
  字库的字号固定为 10.6pt，因此 `VE;HE` 恒为 `0;0`，无需按对象字号缩放。系统字体与中文继续 PCX。
