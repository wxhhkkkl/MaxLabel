import type { BarcodeObj, BarcodeOptions, LabelObject } from '../../types'
import { FormField } from '../../dialogs/Modal'
import { BARCODE_CHARSETS, barcodeCharsetName, barcodeSpecRows, validateBarcodeContent } from '../../../../shared/domain/barcodeCharset'

interface Props {
  obj: BarcodeObj
  onPatch: (patch: Partial<LabelObject>) => void
}

/** 条码数据页签。显示人读文本是正式模型字段，避免把临时 UI 字段写进文档。 */
export default function BarcodeDataFields({ obj, onPatch }: Props) {
  const options = obj.barcodeOptions ?? {}
  const patchOptions = (patch: Partial<BarcodeOptions>) => onPatch({ barcodeOptions: { ...options, ...patch } } as never)
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
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <FormField label="供人识读的字符：位置">
          <select value={options.humanPosition ?? 'below'} onChange={(e) => patchOptions({ humanPosition: e.target.value as BarcodeOptions['humanPosition'] })} style={{ padding: '6px 8px', border: '1px solid #D5D4CD', borderRadius: 6, fontSize: 13, fontFamily: 'inherit', background: '#fff' }}>
            <option value="below">条码下方</option>
            <option value="above">条码上方</option>
            <option value="none">不显示</option>
          </select>
        </FormField>
        <FormField label="供人识读的字符：对齐方式">
          <select value={options.humanAlign ?? 'center'} onChange={(e) => patchOptions({ humanAlign: e.target.value as BarcodeOptions['humanAlign'] })} style={{ padding: '6px 8px', border: '1px solid #D5D4CD', borderRadius: 6, fontSize: 13, fontFamily: 'inherit', background: '#fff' }}>
            <option value="left">左对齐</option>
            <option value="center">居中</option>
            <option value="right">右对齐</option>
          </select>
        </FormField>
      </div>
      <FormField label="供人识读的字符：垂直偏移（mm）">
        <input type="number" min={0} max={100} step={0.1} value={options.humanOffsetMm ?? 0} onChange={(e) => patchOptions({ humanOffsetMm: Math.max(0, Math.min(100, parseFloat(e.target.value) || 0)) })} style={{ padding: '6px 8px', border: '1px solid #D5D4CD', borderRadius: 6, fontSize: 13, width: 72, fontFamily: 'inherit' }} />
      </FormField>
      <FormField label="字符模板" hint="一个 '?' 表示原有数据的一个字符，其它字符插入数据序列。如数据 0123456789，模板 (01)??… 输出 (01)0123456789">
        <input
          style={{ padding: '6px 8px', border: '1px solid #D5D4CD', borderRadius: 6, fontSize: 13, width: '100%', boxSizing: 'border-box', fontFamily: 'inherit' }}
          value={obj.charTemplate ?? ''}
          onChange={(e) => onPatch({ charTemplate: e.target.value })}
          placeholder="(01)??????????"
        />
      </FormField>
    </>
  )
}
