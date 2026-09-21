# 「新建条码全黑」根因与修复（验收方 round-63，用户实测反馈）

日期：2026-09-21。用户反馈：**新建一个条码对象，画布上是一整块黑**。

## 一、复现（不依赖 UI，直接在 Node 里按复刻版参数渲染）

用复刻版 `barcodeToDataURL()` 的默认参数渲染 `code128 / 1234567890 / h=12mm / xsize=0.254mm / w2n=2 / 透明底`，
拿到的 PNG（`probe-barcode-default.png`）**整张全黑**；量化：

| `backgroundcolor` | 透明像素 | 暗像素 | 亮像素 | 结果 |
| --- | --- | --- | --- | --- |
| **`FFFFFF00`（修复前的值）** | 0.0% | **100.0%** | 0.0% | ⚠️ **全黑**（＝用户看到的） |
| `FFFFFF`（白底） | 0.0% | 46.1% | 53.9% | 正常 |
| **不传该键** | **53.2%** | 46.8% | 0.0% | ✅ 透明底 + 条码正常（＝想要的效果） |
| `none` | — | — | — | bwip-js 直接报 `invalid backgroundcolor: none` |

## 二、根因

`app/src/renderer/src/editor/barcode.ts` 的 `barcodeToDataURL()` 原来写：

```ts
backgroundcolor: opts?.backgroundTransparent ? 'FFFFFF00' : 'FFFFFF',
```

**bwip-js 不接受 8 位带 alpha 的颜色**：传 `FFFFFF00` 不是"白色全透明"，而是把**整张图渲染成全黑**。
而新建条码的默认值恰好是 `backgroundTransparent: true`（`features/editor/objectFactory.ts:17`）→
**任何新建条码都全黑**，这就是用户看到的现象。

## 三、修复（已提交）

```ts
// 要透明底就**不传** backgroundcolor（bwip 会保留画布透明底）
...(opts?.backgroundTransparent ? {} : { backgroundcolor: 'FFFFFF' }),
```

导出路径 `barcodeToDataURLEx()` 本来就用 `FFFFFF`（不透明），未受影响。

## 四、防复发断言（已加，且验证"有牙齿"）

在 `app/scripts/render-regression.ts` 末尾加两条（现共 **66** 项渲染检查）：

- `transparent-background barcode renders bars (not a solid black block)` —— 暗像素占比必须落在 20%–80%（既不是全黑也不是空白）；
- `transparent-background barcode keeps its transparent background` —— 透明像素 > 20%。

**牙齿验证**：把 `barcode.ts` 临时改回 `'FFFFFF00'` → `npm run test:render` **报错**正是在这条新断言上；
改回修复版 → **66/66 PASS**。也就是说这条断言确实能拦住复发。

## 五、为什么原有的测试没拦住

`test:barcode`（`barcode-spec.test.ts`）只验**编码规则/码制特性**（bcid、文本、校验位、选项映射），
`test:render` 之前只渲染标签/纸张/孔洞，**没有任何一条检查"条码图像本身长什么样"**——
即"渲染出来是不是全黑"这件事此前无断言覆盖。现已补上。

## 六、产物

| 文件 | 内容 |
| --- | --- |
| `parity/reference/maxlabel/probe-barcode-default.png` | 修复前：全黑 |
| `probe-barcode-bg-omit____backgroundcolor_.png` | 修复后：透明底 + 条码正常 |
| `probe-barcode-bg-FFFFFF____.png` | 对照：白底正常 |
