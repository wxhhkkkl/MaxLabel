import { useEffect, useState } from 'react'
import type { CSSProperties, ReactNode } from 'react'
import type { Dataset, DataSource, DbConnectionConfig, LabelObject, SerialSource, TextObj } from '../types'
import { serialText } from '../types'
import { BARCODE_TYPES } from './barcodeTypes'

/** 序列号下一张取值预览（支持字符集） */
function serialPreview(s: SerialSource): string {
  return serialText(s, 1)
}

interface Props {
  obj: LabelObject
  datasets: Record<string, Dataset>
  connections?: Record<string, DbConnectionConfig>
  allowMultipleDatabaseConnections?: boolean
  onPatch: (patch: Partial<LabelObject>) => void
}

function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ fontSize: 12, color: '#6B7280', marginBottom: 4 }}>{label}</div>
      {hint && (
        <div style={{ fontSize: 11, color: '#9AA0A6', marginBottom: 4, lineHeight: 1.5 }}>{hint}</div>
      )}
      {children}
    </div>
  )
}

const inputStyle: CSSProperties = {
  width: '100%',
  padding: '6px 8px',
  border: '1px solid #D5D4CD',
  borderRadius: 6,
  fontSize: 13,
  fontFamily: 'inherit',
  boxSizing: 'border-box'
}

const textareaStyle: CSSProperties = {
  ...inputStyle,
  minHeight: 120,
  fontFamily: 'Consolas, monospace',
  fontSize: 12,
  resize: 'vertical',
  lineHeight: 1.5
}

const FONTS = ['微软雅黑', '宋体', '黑体', '楷体', '仿宋', 'Arial', 'Times New Roman', 'Courier New', 'Symbol', 'OCR-B-10 BT', 'OCR-A Std']

function randomHex8(): string {
  const bytes = new Uint8Array(4)
  crypto.getRandomValues(bytes)
  return Array.from(bytes, (value) => value.toString(16).padStart(2, '0')).join('').toUpperCase()
}

const SCRIPT_TEMPLATE = `function OnGetData() {
  // 可用全局变量：V_PAGE V_ROW V_COPY V_LABELNO V_TOTALLABELS V_TITLE V_PRINTER
  // 返回标签文本
  return '脚本-' + V_LABELNO;
}
`

type TabKey = 'source' | 'appearance' | 'general'

function appearanceLabel(type: LabelObject['type']): string {
  switch (type) {
    case 'text':
      return '文本样式'
    case 'barcode':
      return '条码选项'
    case 'rfid':
      return 'RFID 选项'
    case 'rect':
    case 'ellipse':
      return '方框和圆形'
    case 'table':
      return '表格'
    case 'line':
      return '直线和斜线'
    case 'image':
      return '图片'
    case 'group':
      return '组合'
  }
}

function hasSource(type: LabelObject['type']): boolean {
  return type === 'text' || type === 'barcode' || type === 'rfid'
}

function DataSourceEditor({
  source,
  onChange,
  datasets,
  connections = {},
  allowMultipleDatabaseConnections = false
}: {
  source: DataSource
  onChange: (s: DataSource) => void
  datasets: Record<string, Dataset>
  connections?: Record<string, DbConnectionConfig>
  allowMultipleDatabaseConnections?: boolean
}) {
  const kind = source.kind
  return (
    <Field label="数据源">
      <select
        value={kind}
        onChange={(e) => {
          const k = e.target.value as DataSource['kind']
          if (k === 'constant') onChange({ kind: 'constant', value: '' })
          else if (k === 'serial') onChange({ kind: 'serial', prefix: '', start: 1, step: 1, digits: 4, current: 1 })
          else if (k === 'date') onChange({ kind: 'date', format: 'yyyy-MM-dd' })
          else if (k === 'time') onChange({ kind: 'time', format: 'HH:mm:ss' })
          else if (k === 'database') {
            const first = Object.keys(datasets)[0]
            const ds = first ? datasets[first] : null
            onChange({ kind: 'database', dataset: first ?? '', field: ds?.columns[0] ?? '' })
          } else if (k === 'script') onChange({ kind: 'script', code: SCRIPT_TEMPLATE })
          else if (k === 'keyboard') onChange({ kind: 'keyboard', label: '请输入' })
        }}
        style={{ ...inputStyle, marginBottom: 6 }}
      >
        <option value="constant">常量</option>
        <option value="serial">序列号</option>
        <option value="date">日期</option>
        <option value="time">时间</option>
        <option value="database">数据库字段</option>
        <option value="script">脚本</option>
        <option value="keyboard">键盘输入</option>
      </select>

      {kind === 'constant' && (
        <input value={source.value} onChange={(e) => onChange({ kind: 'constant', value: e.target.value })} style={inputStyle} placeholder="内容" />
      )}

      {kind === 'serial' && (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
            <input
              value={source.prefix}
              onChange={(e) => onChange({ ...source, prefix: e.target.value })}
              style={inputStyle}
              placeholder="前缀"
              title="前缀"
            />
            <select
              value={source.charset ?? ''}
              onChange={(e) => onChange({ ...source, charset: e.target.value === '__custom__' ? 'ABCDEFGHIJKLMNOPQRSTUVWXYZ' : e.target.value })}
              style={inputStyle}
              title="字符集"
            >
              <option value="">数字（补零）</option>
              <option value="ABCDEFGHIJKLMNOPQRSTUVWXYZ">大写字母 A-Z</option>
              <option value="abcdefghijklmnopqrstuvwxyz">小写字母 a-z</option>
              <option value="ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789">大写字母+数字</option>
              <option value="0123456789ABCDEF">十六进制 0-9A-F</option>
              <option value="__custom__">自定义字符集</option>
            </select>
            <input
              type="number"
              value={source.start}
              onChange={(e) => {
                const n = parseInt(e.target.value || '1', 10)
                // 修改起始值时同步重置当前值
                onChange({ ...source, start: n, current: n })
              }}
              style={inputStyle}
              placeholder="起始"
              title="起始值"
            />
            <input
              type="number"
              value={source.step}
              onChange={(e) => onChange({ ...source, step: parseInt(e.target.value || '1', 10) })}
              style={inputStyle}
              placeholder="步长"
              title="步长"
            />
            <input
              type="number"
              value={source.digits}
              min={1}
              max={12}
              onChange={(e) => onChange({ ...source, digits: parseInt(e.target.value || '1', 10) })}
              style={inputStyle}
              placeholder="位数"
              title="位数（仅数字序列）"
            />
            <input
              type="number"
              value={source.current}
              onChange={(e) => onChange({ ...source, current: parseInt(e.target.value || '1', 10) })}
              style={inputStyle}
              placeholder="当前值"
              title="当前值"
            />
          </div>
          <div style={{ fontSize: 11, color: '#6B7280', marginTop: 4 }}>下一张取值：{serialPreview(source)}</div>
        </>
      )}

      {kind === 'date' && <input value={source.format} onChange={(e) => onChange({ ...source, format: e.target.value })} style={inputStyle} placeholder="yyyy-MM-dd" />}
      {kind === 'time' && <input value={source.format} onChange={(e) => onChange({ ...source, format: e.target.value })} style={inputStyle} placeholder="HH:mm:ss" />}

      {kind === 'database' && (
        <>
          {allowMultipleDatabaseConnections && Object.keys(connections).length > 0 && (
            <select
              data-testid="inline-database-connection"
              value={source.connectionId ?? ''}
              onChange={(e) => onChange({ ...source, connectionId: e.target.value || undefined })}
              style={{ ...inputStyle, marginBottom: 6 }}
              title="数据库连接"
            >
              <option value="">（默认连接）</option>
              {Object.values(connections).map((connection) => <option key={connection.id} value={connection.id}>{connection.name}</option>)}
            </select>
          )}
          <select
            value={source.dataset}
            onChange={(e) => {
              const name = e.target.value
              const ds = datasets[name]
              onChange({ ...source, dataset: name, field: ds?.columns[0] ?? '' })
            }}
            style={{ ...inputStyle, marginBottom: 6 }}
          >
            {Object.keys(datasets).length === 0 && <option value="">（未导入数据，请先到"数据"导入）</option>}
            {Object.keys(datasets).map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
          <select
            data-testid="inline-database-field"
            value={source.field}
            onChange={(e) => onChange({ ...source, field: e.target.value })}
            style={inputStyle}
          >
            {(datasets[source.dataset]?.columns ?? []).map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
          <select
            data-testid="inline-database-record-offset"
            value={String((source.recordOffset ?? 0) + 1)}
            onChange={(e) => onChange({ ...source, recordOffset: Math.max(0, parseInt(e.target.value || '1', 10) - 1) })}
            style={{ ...inputStyle, marginTop: 6 }}
            title="单标签记录"
          >
            {Array.from({ length: Math.max(10, Math.min(100, datasets[source.dataset]?.rows.length ?? 0)) }, (_, index) => (
              <option key={index} value={index + 1}>第 {index + 1} 条记录</option>
            ))}
          </select>
        </>
      )}

      {kind === 'script' && (
        <>
          <textarea value={source.code} onChange={(e) => onChange({ ...source, code: e.target.value })} style={textareaStyle} />
          <input
            value={source.sharedName ?? ''}
            onChange={(e) => onChange({ ...source, sharedName: e.target.value })}
            style={{ ...inputStyle, marginTop: 6 }}
            placeholder="共享变量名（可选）：返回结果写入该变量"
          />
        </>
      )}

      {kind === 'keyboard' && <input value={source.label} onChange={(e) => onChange({ ...source, label: e.target.value })} style={inputStyle} placeholder="打印时提示：请输入…" />}
    </Field>
  )
}

export default function PropertyPanel({ obj, datasets, connections, allowMultipleDatabaseConnections, onPatch }: Props) {
  const hasSrc = hasSource(obj.type)
  const [tab, setTab] = useState<TabKey>(hasSrc ? 'source' : 'appearance')

  // 切换对象时回到默认页签
  useEffect(() => {
    setTab(hasSrc ? 'source' : 'appearance')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [obj.id])

  const tabs: { key: TabKey; label: string }[] = []
  if (hasSrc) tabs.push({ key: 'source', label: '数据源' })
  tabs.push({ key: 'appearance', label: appearanceLabel(obj.type) })
  tabs.push({ key: 'general', label: '常规' })

  const g = (key: 'x' | 'y' | 'w' | 'h' | 'rotation') => (v: string) => {
    const n = parseFloat(v)
    if (Number.isNaN(n)) return
    onPatch({ [key]: n } as Partial<LabelObject>)
  }

  return (
    <div data-testid="property-panel" style={{ width: 300, background: '#FFFFFF', borderLeft: '1px solid #E4E3DD', padding: '10px 14px 14px', boxSizing: 'border-box', overflowY: 'auto', maxHeight: 340 }}>
      <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>属性</div>

      {/* 页签 */}
      <div style={{ display: 'flex', borderBottom: '1px solid #E4E3DD', marginBottom: 12 }}>
        {tabs.map((t) => (
          <button
            key={t.key}
            type="button"
            data-testid={`property-panel-tab-${t.key}`}
            onClick={() => setTab(t.key)}
            style={{
              flex: 1,
              padding: '7px 0',
              fontSize: 12.5,
              border: 'none',
              background: 'transparent',
              borderBottom: tab === t.key ? '2px solid #2E6E93' : '2px solid transparent',
              color: tab === t.key ? '#1A1B1C' : '#6B7280',
              cursor: 'pointer',
              fontFamily: 'inherit',
              whiteSpace: 'nowrap'
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'general' && (
        <>
          <Field label="位置 X (mm)">
            <input type="number" step={0.1} value={round(obj.x)} onChange={(e) => g('x')(e.target.value)} style={inputStyle} />
          </Field>
          <Field label="位置 Y (mm)">
            <input type="number" step={0.1} value={round(obj.y)} onChange={(e) => g('y')(e.target.value)} style={inputStyle} />
          </Field>
          <Field label="宽度 W (mm)">
            <input type="number" step={0.1} value={round(obj.w)} onChange={(e) => g('w')(e.target.value)} style={inputStyle} />
          </Field>
          <Field label="高度 H (mm)">
            <input type="number" step={0.1} value={round(obj.h)} onChange={(e) => g('h')(e.target.value)} style={inputStyle} />
          </Field>
          <Field label="旋转 (°)">
            <input type="number" step={1} value={round(obj.rotation)} onChange={(e) => g('rotation')(e.target.value)} style={inputStyle} />
          </Field>
          {obj.type === 'group' && (
            <div style={{ fontSize: 12, color: '#6B7280', lineHeight: 1.6 }}>
              组合对象，包含 {obj.children.length} 个子对象。
              <br />
              通过画布可整体移动 / 旋转 / 缩放；编辑子对象请先「取消组合」。位置 X/Y 为组中心。
            </div>
          )}
        </>
      )}

      {tab === 'source' && (obj.type === 'text' || obj.type === 'barcode' || obj.type === 'rfid') && (
        <>
          {obj.type === 'barcode' && <BarcodeSymbologyFields obj={obj} onPatch={onPatch} />}
          {obj.type === 'rfid' && <RfidBankFields obj={obj} onPatch={onPatch} />}
          <DataSourceEditor source={obj.source} datasets={datasets} connections={connections} allowMultipleDatabaseConnections={allowMultipleDatabaseConnections} onChange={(source) => onPatch({ source })} />
          <TransformFields obj={obj} onPatch={onPatch} />
        </>
      )}

      {tab === 'appearance' && <AppearanceFields obj={obj} onPatch={onPatch} />}
    </div>
  )
}

/** 条码码制（数据源页签内） */
function BarcodeSymbologyFields({
  obj,
  onPatch
}: {
  obj: LabelObject & { type: 'barcode' }
  onPatch: (patch: Partial<LabelObject>) => void
}) {
  return (
    <Field label="码制">
      <select value={obj.symbology} onChange={(e) => onPatch({ symbology: e.target.value })} style={inputStyle}>
        {BARCODE_TYPES.map((b) => (
          <option key={b.bcid} value={b.bcid}>
            {b.label}
          </option>
        ))}
      </select>
    </Field>
  )
}

/** RFID 写入区域（数据源页签内） */
function RfidBankFields({
  obj,
  onPatch
}: {
  obj: LabelObject & { type: 'rfid' }
  onPatch: (patch: Partial<LabelObject>) => void
}) {
  return (
    <Field label="写入区域">
      <select value={obj.bank} onChange={(e) => onPatch({ bank: e.target.value as 'EPC' | 'USER' | 'TID' })} style={inputStyle}>
        <option value="EPC">EPC</option>
        <option value="USER">USER</option>
        <option value="TID">TID</option>
      </select>
    </Field>
  )
}

/** 外观页签：按对象类型展示样式/选项 */
function AppearanceFields({ obj, onPatch }: { obj: LabelObject; onPatch: (patch: Partial<LabelObject>) => void }) {
  switch (obj.type) {
    case 'text':
      return <TextAppearanceFields obj={obj as TextObj} onPatch={onPatch} />
    case 'barcode':
      return (
        <>
          <label style={{ fontSize: 13, display: 'flex', alignItems: 'center', gap: 4, marginBottom: 10 }}>
            <input type="checkbox" checked={obj.showText} onChange={(e) => onPatch({ showText: e.target.checked })} /> 条码下方显示内容文字
          </label>
          <div style={{ fontSize: 11, color: '#6B7280', lineHeight: 1.6 }}>条码尺寸：拖动控制点或到「常规」页签输入 W/H。内容来自「数据源」页签。</div>
        </>
      )
    case 'rfid':
      return (
        <>
          <div style={{ fontSize: 11, color: '#6B7280', lineHeight: 1.6, marginBottom: 8 }}>RFID 标签编程：以下选项与模态属性页同步。</div>
          {([['epc', 'EPC Block'], ['user', 'User Block'], ['tid', 'TID Block'], ['accessPassword', 'Access Password'], ['killPassword', 'Kill Password']] as const).map(([key, label]) => {
            const access = obj.accessControl ?? { epc: 'none', user: 'none', tid: 'none', accessPassword: 'none', killPassword: 'none' }
            return <Field key={key} label={label}><select data-testid={`rfid-inline-access-${key}`} value={access[key]} onChange={(e) => onPatch({ accessControl: { ...access, [key]: e.target.value } as never, lock: key === 'epc' ? e.target.value !== 'none' : obj.lock } as never)} style={inputStyle}><option value="none">不操作</option><option value="lock">锁定</option><option value="unlock">解锁</option></select></Field>
          })}
          <Field label="Access 口令（8 位十六进制）"><div style={{ display: 'flex', gap: 6 }}><input data-testid="rfid-inline-access-password" value={obj.accessPwd ?? '00000000'} maxLength={8} onChange={(e) => onPatch({ accessPwd: e.target.value.replace(/[^0-9a-f]/gi, '').slice(0, 8).toUpperCase() })} style={{ ...inputStyle, flex: 1 }} /><button type="button" data-testid="rfid-inline-random-access" onClick={() => onPatch({ accessPwd: randomHex8() })} style={{ ...inputStyle, width: 'auto', cursor: 'pointer', whiteSpace: 'nowrap' }}>随机生成</button></div></Field>
          <Field label="Kill 口令（8 位十六进制）"><div style={{ display: 'flex', gap: 6 }}><input data-testid="rfid-inline-kill-password" value={obj.killPwd ?? '00000000'} maxLength={8} onChange={(e) => onPatch({ killPwd: e.target.value.replace(/[^0-9a-f]/gi, '').slice(0, 8).toUpperCase() })} style={{ ...inputStyle, flex: 1 }} /><button type="button" data-testid="rfid-inline-random-kill" onClick={() => onPatch({ killPwd: randomHex8() })} style={{ ...inputStyle, width: 'auto', cursor: 'pointer', whiteSpace: 'nowrap' }}>随机生成</button></div></Field>
        </>
      )
    case 'rect':
    case 'ellipse':
      return (
        <>
          <Field label="形状">
            <select value={obj.type === 'ellipse' ? 'ellipse' : (obj.shape ?? 'rect')} onChange={(e) => onPatch(obj.type === 'ellipse' ? { type: 'rect', shape: e.target.value } as never : { shape: e.target.value } as never)} style={inputStyle}>
              <option value="rect">矩形</option><option value="roundRect">圆角矩形</option><option value="ellipse">椭圆</option>
            </select>
          </Field>
          {obj.type === 'rect' && obj.shape === 'roundRect' && <Field label="圆角半径（mm）"><input type="number" min={0} value={obj.cornerRadius ?? 0} onChange={(e) => onPatch({ cornerRadius: Math.max(0, parseFloat(e.target.value) || 0) } as never)} style={inputStyle} /></Field>}
          <label style={{ fontSize: 13, display: 'flex', alignItems: 'center', gap: 4, marginBottom: 10 }}><input type="checkbox" checked={obj.fillEnabled !== false} onChange={(e) => onPatch({ fillEnabled: e.target.checked } as never)} /> 填充方框内部</label>
          <Field label="填充色">
            <input type="color" value={obj.fill} onChange={(e) => onPatch({ fill: e.target.value })} style={{ width: '100%', height: 32, border: '1px solid #D5D4CD', borderRadius: 6, cursor: 'pointer' }} />
          </Field>
          <Field label="线条色">
            <input type="color" value={obj.stroke} onChange={(e) => onPatch({ stroke: e.target.value })} style={{ width: '100%', height: 32, border: '1px solid #D5D4CD', borderRadius: 6, cursor: 'pointer' }} />
          </Field>
          <Field label="边框宽度 (mm)">
            <input type="number" step={0.1} min={0} value={round(obj.strokeWidth)} onChange={(e) => onPatch({ strokeWidth: parseFloat(e.target.value) || 0 })} style={inputStyle} />
          </Field>
        </>
      )
    case 'table':
      return (
        <>
          <Field label="行数">
            <input type="number" min={1} max={50} value={obj.rows} onChange={(e) => onPatch({ rows: Math.max(1, parseInt(e.target.value || '1', 10)) })} style={inputStyle} />
          </Field>
          <Field label="列数">
            <input type="number" min={1} max={50} value={obj.cols} onChange={(e) => onPatch({ cols: Math.max(1, parseInt(e.target.value || '1', 10)) })} style={inputStyle} />
          </Field>
          <Field label="边框颜色">
            <input type="color" value={obj.borderColor} onChange={(e) => onPatch({ borderColor: e.target.value })} style={{ width: '100%', height: 32, border: '1px solid #D5D4CD', borderRadius: 6, cursor: 'pointer' }} />
          </Field>
          <Field label="边框宽度 (mm)">
            <input type="number" step={0.1} min={0} value={round(obj.borderWidth)} onChange={(e) => onPatch({ borderWidth: parseFloat(e.target.value) || 0 })} style={inputStyle} />
          </Field>
        </>
      )
    case 'line':
      return (
        <>
          <Field label="线条色">
            <input type="color" value={obj.stroke} onChange={(e) => onPatch({ stroke: e.target.value })} style={{ width: '100%', height: 32, border: '1px solid #D5D4CD', borderRadius: 6, cursor: 'pointer' }} />
          </Field>
          <Field label="线宽 (mm)">
            <input type="number" step={0.1} min={0} value={round(obj.strokeWidth)} onChange={(e) => onPatch({ strokeWidth: parseFloat(e.target.value) || 0 })} style={inputStyle} />
          </Field>
          <Field label="长度 (mm)">
            <input type="number" step={0.1} min={0.1} value={round(obj.w)} onChange={(e) => onPatch({ w: Math.max(0.1, parseFloat(e.target.value) || obj.w) })} style={inputStyle} />
          </Field>
        </>
      )
    case 'image':
      return <div style={{ fontSize: 12, color: '#6B7280' }}>图片尺寸请通过画布拖拽调整，或在「常规」页签输入精确值。</div>
    case 'group':
      return <div style={{ fontSize: 12, color: '#6B7280' }}>组合对象的样式在取消组合后逐对象编辑。</div>
  }
}

function TextAppearanceFields({ obj, onPatch }: { obj: TextObj; onPatch: (patch: Partial<LabelObject>) => void }) {
  return (
    <>
      <Field label="字体">
        <select value={obj.fontFamily} onChange={(e) => onPatch({ fontFamily: e.target.value })} style={inputStyle}>
          {FONTS.map((f) => (
            <option key={f} value={f}>
              {f}
            </option>
          ))}
        </select>
      </Field>
      <Field label="字号 (mm)">
        <input type="number" step={0.1} min={0.5} value={round(obj.fontSize)} onChange={(e) => onPatch({ fontSize: parseFloat(e.target.value) || 1 })} style={inputStyle} />
      </Field>
      <div style={{ display: 'flex', gap: 8, marginBottom: 10, alignItems: 'center', flexWrap: 'wrap' }}>
        <label style={{ fontSize: 13, display: 'flex', alignItems: 'center', gap: 4 }}>
          <input type="checkbox" checked={obj.bold} onChange={(e) => onPatch({ bold: e.target.checked })} /> 加粗
        </label>
        <label style={{ fontSize: 13, display: 'flex', alignItems: 'center', gap: 4 }}>
          <input type="checkbox" checked={obj.italic} onChange={(e) => onPatch({ italic: e.target.checked })} /> 斜体
        </label>
        <label style={{ fontSize: 13, display: 'flex', alignItems: 'center', gap: 4 }}>
          <input type="checkbox" checked={obj.underline} onChange={(e) => onPatch({ underline: e.target.checked })} /> 下划线
        </label>
      </div>
      <Field label="对齐">
        <select value={obj.align} onChange={(e) => onPatch({ align: e.target.value as TextObj['align'] })} style={inputStyle}>
          <option value="left">左对齐</option>
          <option value="center">居中</option>
          <option value="right">右对齐</option>
          <option value="justify">撑满</option>
        </select>
      </Field>
      <Field label="颜色">
        <input type="color" value={obj.color} onChange={(e) => onPatch({ color: e.target.value })} style={{ width: '100%', height: 32, border: '1px solid #D5D4CD', borderRadius: 6, cursor: 'pointer' }} />
      </Field>
      <Field label="背景颜色" hint="留空为透明">
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <input type="color" value={obj.backgroundColor ?? '#FFFFFF'} onChange={(e) => onPatch({ backgroundColor: e.target.value })} style={{ flex: 1, height: 32, border: '1px solid #D5D4CD', borderRadius: 6, cursor: 'pointer' }} />
          <button
            type="button"
            onClick={() => onPatch({ backgroundColor: undefined })}
            style={{ padding: '4px 8px', borderRadius: 6, border: '1px solid #D5D4CD', background: '#fff', color: '#1A1B1C', cursor: 'pointer', fontSize: 12, fontFamily: 'inherit', whiteSpace: 'nowrap' }}
            title="清除背景色（透明）"
          >
            清除
          </button>
        </div>
      </Field>
      <label style={{ fontSize: 13, display: 'flex', alignItems: 'center', gap: 4, marginBottom: 10 }}>
        <input type="checkbox" checked={!!obj.arc} onChange={(e) => onPatch({ arc: e.target.checked })} /> 弧形文字（沿顶部弧线）
      </label>
      <Field label="打印机内建字体" hint="指令打印时优先使用（TSPL: Font0-8；ZPL: A-Z/0）">
        <select value={obj.printerFont ?? ''} onChange={(e) => onPatch({ printerFont: e.target.value || undefined })} style={inputStyle}>
          <option value="">（默认，编辑器字体）</option>
          <optgroup label="TSPL（Font0-8）">
            <option value="Font0">Font0（8×16 点阵）</option>
            <option value="Font1">Font1</option>
            <option value="Font2">Font2</option>
            <option value="Font3">Font3（16×32）</option>
            <option value="Font4">Font4（32×48）</option>
            <option value="Font5">Font5（48×64）</option>
            <option value="Font6">Font6（64×96）</option>
            <option value="Font7">Font7（24×24）</option>
            <option value="Font8">Font8（24×32）</option>
          </optgroup>
          <optgroup label="ZPL（A-Z / 0）">
            <option value="A">A</option>
            <option value="B">B</option>
            <option value="C">C</option>
            <option value="D">D</option>
            <option value="E">E</option>
            <option value="F">F</option>
            <option value="G">G</option>
            <option value="H">H</option>
            <option value="0">0（标准）</option>
          </optgroup>
        </select>
      </Field>
    </>
  )
}

/** 对象级显示变换：子串（start/length）+ 格式化（大写/小写/首字母大写） */
function TransformFields({
  obj,
  onPatch
}: {
  obj: { format?: 'none' | 'upper' | 'lower' | 'capitalize'; substr?: { start: number; length: number } }
  onPatch: (patch: Partial<LabelObject>) => void
}) {
  const fmt = obj.format ?? 'none'
  return (
    <>
      <Field label="格式化">
        <select
          value={fmt}
          onChange={(e) => {
            const v = e.target.value
            onPatch({ format: v === 'none' ? undefined : (v as 'upper' | 'lower' | 'capitalize') })
          }}
          style={inputStyle}
        >
          <option value="none">无</option>
          <option value="upper">全部大写</option>
          <option value="lower">全部小写</option>
          <option value="capitalize">首字母大写</option>
        </select>
      </Field>
      <Field label="子串（取部分字符，-1 表示不限）">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
          <input
            type="number"
            value={obj.substr?.start ?? 0}
            onChange={(e) => {
              const start = parseInt(e.target.value || '0', 10)
              onPatch({ substr: { start, length: obj.substr?.length ?? -1 } })
            }}
            style={inputStyle}
            placeholder="起始"
            title="起始位置（0 起）"
          />
          <input
            type="number"
            value={obj.substr?.length ?? -1}
            onChange={(e) => {
              const length = parseInt(e.target.value || '-1', 10)
              onPatch({ substr: { start: obj.substr?.start ?? 0, length } })
            }}
            style={inputStyle}
            placeholder="长度"
            title="长度（-1 = 到末尾）"
          />
        </div>
      </Field>
    </>
  )
}

function round(n: number): number {
  return Math.round(n * 100) / 100
}
