import type { BarcodeObj, LabelObject } from '../../types'
import { BARCODE_CHARSETS, barcodeCharsetName, barcodeSpecRows, validateBarcodeContent } from '../../../../shared/domain/barcodeCharset'

interface Props {
  obj: BarcodeObj
  onPatch: (patch: Partial<LabelObject>) => void
}

/** 条码数据页签。显示人读文本是正式模型字段，避免把临时 UI 字段写进文档。 */
export default function BarcodeDataFields({ obj, onPatch }: Props) {
  // 帮助 barcode_summary.html：每种码制有自己的字符集与位数，属性页据此提示与校验。
  const spec = BARCODE_CHARSETS[obj.symbology]
  // 帮助 barcode_summary.html：每种码制的字符集/来源/符号结构/容量/校验与纠错/识读特性逐条展示。
  const specRows = barcodeSpecRows(obj.symbology)
  const constantText = obj.source?.kind === 'constant' ? obj.source.value : ''
  const check = constantText ? validateBarcodeContent(obj.symbology, constantText) : { ok: true, message: '' }
  return (
    <>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 12 }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: '#1A1B1C' }}>
          <input type="checkbox" checked={obj.showText} onChange={(e) => onPatch({ showText: e.target.checked })} />
          显示人读文本
        </label>
      </div>
      {spec && (
        <div style={{ fontSize: 12, lineHeight: 1.7 }} data-testid="barcode-charset">
          <div style={{ color: '#1A1B1C' }}>
            <span style={{ color: '#6B7280' }}>码制特性（</span>
            <span data-testid="barcode-charset-name">{barcodeCharsetName(obj.symbology)}</span>
            <span style={{ color: '#6B7280' }}>）</span>
          </div>
          {specRows.map((row) => (
            <div key={row.key} style={{ display: 'flex', gap: 4 }} data-testid={`barcode-spec-${row.key}`}>
              <span style={{ color: '#6B7280', flex: '0 0 auto' }}>{row.label}：</span>
              <span data-testid={`barcode-spec-${row.key}-value`}>{row.value}</span>
            </div>
          ))}
          {!check.ok && (
            <div style={{ color: '#C0392B', marginTop: 2 }} data-testid="barcode-content-error">
              {check.message}
            </div>
          )}
        </div>
      )}
      {/* 真机「条码属性 → 数据源」页**没有**供人识读字符的那四项
          （`probe-60-barcode-props-tree.txt` 第一个窗口的可见控件只有 `显示数据(&D):` / `数据源(&S):` /
          `字段名(&F):` / `偏移(&O):` / `变量共享名称(&N):` / `高级选项(&A)...` / `子串选项` / `示例` 等）。
          它们的真机位置是「条码」页的 `供人识读字符` 分组（`位置(&P):` / `垂直偏移(&O):` / `对齐方式(&A):` /
          `字符模板(&T)`），复刻版原先在这里又渲染了一份同样的状态（同一个 `humanPosition` 绑两个下拉）——
          按「同一状态只留一个入口」口径移除本页重复项，功能在「条码」页保留。 */}
    </>
  )
}
