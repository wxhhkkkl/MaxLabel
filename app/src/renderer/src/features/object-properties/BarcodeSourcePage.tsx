import { useMemo, useState } from 'react'
import type { DataSource, Dataset, DbConnectionConfig, LabelObject, LengthLimit, Substr } from '../../types'
import { resolveSourceText, serialText } from '../../types'
import DataSourceEditor, { sourcePreview } from '../../dialogs/DataSourceEditor'
import LText from '../i18n/LText'
import { TabPanel, TabPanels } from '../../dialogs/Modal'
import { useI18n } from '../i18n/useI18n'
import { localizePropertyLabel } from '../../../../shared/i18n/property.en-US'

/**
 * 子串列表左侧的类型徽标：每种数据源一种颜色 + 一个字，实心底、白字，
 * 比原来那个 14px 的灰字清楚得多（选中行是蓝底，用白描边隔开）。
 */
const KIND_BADGES: Record<string, { glyph: string; color: string }> = {
  constant: { glyph: 'A', color: '#2E6E93' },
  serial: { glyph: '#', color: '#2F855A' },
  date: { glyph: '日', color: '#B7791F' },
  time: { glyph: '时', color: '#6B46C1' },
  database: { glyph: '▤', color: '#2C7A7B' },
  keyboard: { glyph: '⌨', color: '#4A5568' },
  script: { glyph: '{}', color: '#C53030' }
}

interface Props {
  source: DataSource
  subSources?: DataSource[]
  datasets: Record<string, Dataset>
  connections?: Record<string, DbConnectionConfig>
  allowMultipleDatabaseConnections?: boolean
  sharedNames: string[]
  /** 对象级的高级选项（长度限制 / 截断），与「高级选项(A)...」对话框共用 */
  lengthLimit?: LengthLimit
  substr?: Substr
  onPatch: (patch: Partial<LabelObject>) => void
}

/**
 * 「条码属性 → 数据源」页，按原版布局还原：
 *
 * ```
 * ┌────────────────┬──────────────────────────────┐
 * │ 子串列表        │ 子串选项                       │
 * │ ┌────────────┐ │ 数据源(S):   [常量 ▾]          │
 * │ │ 12345678   │ │ 显示数据(D):  ……               │
 * │ │ 234234  ◀  │ │ 变量共享名称(N): ……            │
 * │ └────────────┘ │                [高级选项(A)...] │
 * ├────────────────┴──────────────────────────────┤
 * │ 示例   12345678 123123 [234234] 345345 …      │
 * └───────────────────────────────────────────────┘
 * ```
 *
 * 列表第一项是对象的主数据源，其余是附加数据源（子串）——对象数据 = 它们依次连接，
 * 底部「示例」把连接结果摊开，当前编辑的那一段高亮。
 */
export default function BarcodeSourcePage({
  source,
  subSources = [],
  datasets,
  connections = {},
  allowMultipleDatabaseConnections = false,
  sharedNames,
  lengthLimit,
  substr,
  onPatch
}: Props) {
  const { language } = useI18n()
  const L = (text: string) => localizePropertyLabel(text, language)
  const [selected, setSelected] = useState(0)
  const [advancedOpen, setAdvancedOpen] = useState(false)

  // 老模板里的 subSources 可能是稀疏数组，undefined 混进来会让 `entry.kind` 直接炸。
  const entries = useMemo(() => [source, ...subSources].filter((entry): entry is DataSource => Boolean(entry)), [source, subSources])
  const index = Math.min(selected, entries.length - 1)
  const current = entries[index]

  const setCurrent = (next: DataSource) => {
    if (index === 0) {
      onPatch({ source: next } as never)
      return
    }
    const list = subSources.slice()
    list[index - 1] = next
    onPatch({ subSources: list } as never)
  }

  const addSubstring = () => {
    const list = [...subSources, { kind: 'constant', value: '' } as DataSource]
    onPatch({ subSources: list } as never)
    setSelected(list.length)
  }

  const removeSubstring = () => {
    if (index === 0) return
    const list = subSources.filter((_, i) => i !== index - 1)
    onPatch({ subSources: list } as never)
    setSelected(Math.max(0, index - 1))
  }

  const moveSubstring = (dir: -1 | 1) => {
    if (index === 0) return
    const target = index - 1 + dir
    if (target < 0 || target >= subSources.length) return
    const list = subSources.slice()
    const [item] = list.splice(index - 1, 1)
    list.splice(target, 0, item)
    onPatch({ subSources: list } as never)
    setSelected(target + 1)
  }

  // 列表与「示例」都显示**按当前格式解析出来的结果**（日期/时间按各自格式、序列号按当前值）；
  // 数据库/键盘这类要等到打印才有值的退回类型摘要。
  // 脚本一律不在这里执行：`resolveSourceText` 会真的跑脚本，渲染期执行既可能抛错把对话框带崩，
  // 也会带上 publishScriptValue 这类副作用。
  const previews = entries.map((entry) =>
    entry.kind === 'script' ? sourcePreview(entry) : (resolveSourceText(entry) || sourcePreview(entry))
  )
  const toolbarButton = { padding: '2px 8px', borderRadius: 4, border: '1px solid #D5D4CD', background: '#fff', color: '#4B5563', cursor: 'pointer', fontSize: 12, fontFamily: 'inherit' } as const

  return (
    <div data-testid="barcode-source-page" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'grid', gridTemplateColumns: '132px minmax(0, 1fr)', gap: 14, alignItems: 'start' }}>
        {/* —— 左：子串列表 —— */}
        <div>
          <div style={{ fontSize: 12.5, marginBottom: 4 }}><LText text="子串列表"/></div>
          <div
            data-testid="source-substring-list"
            role="listbox"
            style={{ border: '1px solid #C8C6BF', background: '#fff', height: 168, overflow: 'auto', padding: 2 }}
          >
            {entries.map((_entry, i) => (
              <div
                key={i}
                role="option"
                aria-selected={i === index}
                data-testid={`source-entry-${i}`}
                onClick={() => setSelected(i)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '2px 4px',
                  fontSize: 12.5,
                  cursor: 'pointer',
                  background: i === index ? '#0A62C9' : 'transparent',
                  color: i === index ? '#fff' : '#1A1B1C',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis'
                }}
              >
                {(() => {
                  const badge = KIND_BADGES[entries[i].kind] ?? { glyph: '?', color: '#6B7280' }
                  return (
                    <span
                      data-testid={`source-entry-icon-${i}`}
                      data-kind={entries[i].kind}
                      aria-hidden="true"
                      style={{
                        flex: '0 0 auto',
                        width: 20,
                        height: 18,
                        borderRadius: 4,
                        background: badge.color,
                        color: '#fff',
                        fontSize: 10.5,
                        fontWeight: 700,
                        lineHeight: '18px',
                        textAlign: 'center',
                        letterSpacing: 0,
                        boxShadow: i === index ? '0 0 0 1px #fff' : 'none'
                      }}
                    >
                      {badge.glyph}
                    </span>
                  )
                })()}
                <span data-testid={`source-entry-label-${i}`} style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{previews[i] || L('（空）')}</span>
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 4, marginTop: 4 }}>
            <button type="button" data-testid="source-substring-add" title={L('添加子串')} onClick={addSubstring} style={toolbarButton}>＋</button>
            <button type="button" data-testid="source-substring-remove" title={L('删除子串')} disabled={index === 0} onClick={removeSubstring} style={{ ...toolbarButton, color: index === 0 ? '#C0BEB5' : '#D4380D', cursor: index === 0 ? 'default' : 'pointer' }}>×</button>
            <button type="button" data-testid="source-substring-up" title={L('上移')} disabled={index === 0} onClick={() => moveSubstring(-1)} style={{ ...toolbarButton, color: index === 0 ? '#C0BEB5' : '#4B5563' }}>↑</button>
            <button type="button" data-testid="source-substring-down" title={L('下移')} disabled={index === 0} onClick={() => moveSubstring(1)} style={{ ...toolbarButton, color: index === 0 ? '#C0BEB5' : '#4B5563' }}>↓</button>
          </div>
        </div>

        {/* —— 右：子串选项 —— */}
        <fieldset style={{ border: '1px solid #D5D4CD', padding: '8px 10px 10px', margin: 0, minWidth: 0 }}>
          <legend style={{ fontSize: 12.5, padding: '0 4px' }}><LText text="子串选项"/></legend>
          <DataSourceEditor
            layout="fields"
            source={current}
            onChange={setCurrent}
            datasets={datasets}
            connections={connections}
            allowMultipleDatabaseConnections={allowMultipleDatabaseConnections}
            sharedNames={sharedNames}
          />
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 8 }}>
            <button
              type="button"
              data-testid="source-advanced"
              onClick={() => setAdvancedOpen(true)}
              style={{ padding: '4px 14px', borderRadius: 4, border: '1px solid #C8C6BF', background: '#F4F5F6', cursor: 'pointer', fontSize: 12.5, fontFamily: 'inherit' }}
            >
              <LText text="高级选项(A)..."/>
            </button>
          </div>
        </fieldset>
      </div>

      {/* —— 底部：示例 —— */}
      <fieldset style={{ border: '1px solid #D5D4CD', padding: '8px 10px 10px', margin: 0 }}>
        <legend style={{ fontSize: 12.5, padding: '0 4px' }}><LText text="示例"/></legend>
        <div data-testid="source-example" style={{ minHeight: 44, maxHeight: 72, overflow: 'auto', fontSize: 12.5, lineHeight: 1.6, wordBreak: 'break-all' }}>
          {entries.map((_, i) => (
            <span
              key={i}
              data-testid={`source-example-part-${i}`}
              style={i === index ? { background: '#0A62C9', color: '#fff' } : undefined}
            >
              {previews[i]}
            </span>
          ))}
          {current.kind === 'serial' && (
            <div data-testid="source-example-serial" style={{ marginTop: 4, color: '#6B7280' }}>
              <LText text="序列示例："/>
              {serialText(current, 1)} → {serialText(current, 2)} → {serialText(current, 3)}
            </div>
          )}
        </div>
      </fieldset>

      {advancedOpen && (
        <SourceAdvancedDialog
          lengthLimit={lengthLimit}
          substr={substr}
          onChange={(patch) => onPatch(patch as Partial<LabelObject>)}
          onClose={() => setAdvancedOpen(false)}
        />
      )}
    </div>
  )
}

/** 「高级选项」对话框：字符数限制 / 截断与验证（对应原版条码属性数据源页的同名对话框）。 */
function SourceAdvancedDialog({
  lengthLimit,
  substr,
  onChange,
  onClose
}: {
  lengthLimit?: LengthLimit
  substr?: Substr
  onChange: (patch: Partial<LabelObject>) => void
  onClose: () => void
}) {
  const { language } = useI18n()
  const L = (text: string) => localizePropertyLabel(text, language)
  const [tab, setTab] = useState<'length' | 'cut'>('length')
  const [draft, setDraft] = useState<LengthLimit>(lengthLimit ?? { mode: 'none' })
  const [cut, setCut] = useState<Substr>(substr ?? { start: 0, length: 0 })

  const modeOf = (limit: LengthLimit): LengthLimit['mode'] => {
    const min = limit.mode === 'min' || limit.mode === 'both'
    const max = limit.mode === 'max' || limit.mode === 'both'
    return min && max ? 'both' : min ? 'min' : max ? 'max' : 'none'
  }
  // 勾选时给一组能直接用的默认值：最小 1 位、补 '0'、最大 8 位（原来是空的，还得手填）。
  const setMin = (on: boolean) => {
    const mode = draft.mode ?? 'none'
    const hasMax = mode === 'max' || mode === 'both'
    setDraft({
      ...draft,
      mode: on ? (hasMax ? 'both' : 'min') : hasMax ? 'max' : 'none',
      ...(on ? { min: draft.min && draft.min > 0 ? draft.min : 1, padChar: draft.padChar || '0' } : {})
    })
  }
  const setMax = (on: boolean) => {
    const mode = draft.mode ?? 'none'
    const hasMin = mode === 'min' || mode === 'both'
    setDraft({
      ...draft,
      mode: on ? (hasMin ? 'both' : 'max') : hasMin ? 'min' : 'none',
      ...(on ? { max: draft.max && draft.max > 0 ? draft.max : 8 } : {})
    })
  }
  const mode = modeOf(draft)
  const minOn = mode === 'min' || mode === 'both'
  const maxOn = mode === 'max' || mode === 'both'
  const field = { padding: '4px 6px', border: '1px solid #C8C6BF', borderRadius: 2, fontSize: 12.5, fontFamily: 'inherit', background: '#fff' } as const
  const row = { display: 'grid', gridTemplateColumns: '150px 120px 1fr', gap: 8, alignItems: 'center', marginBottom: 6 } as const

  const save = () => {
    onChange({ lengthLimit: draft, substr: cut } as never)
    onClose()
  }

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 600, background: 'rgba(0,0,0,0.35)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div data-testid="source-advanced-dialog" style={{ width: 520, maxWidth: '94vw', background: '#F0F0F0', border: '1px solid #A9A9A9', boxShadow: '0 10px 40px rgba(0,0,0,0.3)', display: 'flex', flexDirection: 'column' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '4px 8px', borderBottom: '1px solid #C8C6BF', fontSize: 12.5 }}>
          <span><LText text="高级选项"/></span>
          <button type="button" aria-label={L('关闭')} onClick={onClose} style={{ border: 0, background: 'transparent', fontSize: 16, lineHeight: 1, cursor: 'pointer', color: '#555' }}>×</button>
        </div>

        <div style={{ display: 'flex', gap: 2, padding: '6px 8px 0' }}>
          {([['length', '字符数限制'], ['cut', '截断与验证']] as const).map(([key, label]) => (
            <button
              key={key}
              type="button"
              data-testid={`source-advanced-tab-${key}`}
              onClick={() => setTab(key)}
              style={{ padding: '4px 12px', border: '1px solid #C8C6BF', borderBottom: tab === key ? '1px solid #F0F0F0' : '1px solid #C8C6BF', background: tab === key ? '#F0F0F0' : '#E4E4E4', cursor: 'pointer', fontSize: 12.5, fontFamily: 'inherit' }}
            >
              <LText text={label}/>
            </button>
          ))}
        </div>

        {/* 两个页签的内容同时挂载、叠在同一个栅格里，窗口高度取较高的那一个——
            切换页签时对话框不会变大变小，确定/取消按钮也不会跟着跳。 */}
        <div style={{ padding: 10, background: '#F0F0F0' }}>
          <TabPanels>
          <TabPanel active={tab === 'length'}>
            <>
              <fieldset style={{ border: '1px solid #C8C6BF', padding: '10px 12px', margin: '0 0 10px', background: '#F7F7F7' }}>
                <legend style={{ fontSize: 12.5, padding: '0 4px' }}><LText text="长度下限"/></legend>
                <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12.5 }}>
                  <input type="checkbox" data-testid="source-limit-min" checked={minOn} onChange={(e) => setMin(e.target.checked)} />
                  <LText text="限制最小字符数(S)"/>
                </label>
                <div style={row}>
                  <span style={{ fontSize: 12.5, color: minOn ? '#1A1B1C' : '#9AA0A6' }}><LText text="最小字符数(N):"/></span>
                  <input data-testid="source-limit-min-value" type="number" min={0} disabled={!minOn} value={draft.min ?? ''} onChange={(e) => setDraft({ ...draft, min: Number(e.target.value) || 0 })} style={field} />
                </div>
                <div style={row}>
                  <span style={{ fontSize: 12.5, color: minOn ? '#1A1B1C' : '#9AA0A6' }}><LText text="长度不足时(T):"/></span>
                  <select data-testid="source-limit-pad-dir" disabled={!minOn} value={draft.padDir ?? 'left'} onChange={(e) => setDraft({ ...draft, padDir: e.target.value as LengthLimit['padDir'] })} style={field}>
                    <option value="left"><LText text="左侧填充"/></option>
                    <option value="right"><LText text="右侧填充"/></option>
                  </select>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12.5 }}>
                    <LText text="填充字符(C):"/>
                    <input data-testid="source-limit-pad-char" disabled={!minOn} maxLength={1} value={draft.padChar ?? '0'} onChange={(e) => setDraft({ ...draft, padChar: e.target.value })} style={{ ...field, width: 44 }} />
                  </span>
                </div>
              </fieldset>

              <fieldset style={{ border: '1px solid #C8C6BF', padding: '10px 12px', margin: 0, background: '#F7F7F7' }}>
                <legend style={{ fontSize: 12.5, padding: '0 4px' }}><LText text="长度上限"/></legend>
                <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12.5, marginBottom: 6 }}>
                  <input type="checkbox" data-testid="source-limit-max" checked={maxOn} onChange={(e) => setMax(e.target.checked)} />
                  <LText text="限制最大字符数(L)"/>
                </label>
                <div style={row}>
                  <span style={{ fontSize: 12.5, color: maxOn ? '#1A1B1C' : '#9AA0A6' }}><LText text="最大字符数(M):"/></span>
                  <input data-testid="source-limit-max-value" type="number" min={0} disabled={!maxOn} value={draft.max ?? ''} onChange={(e) => setDraft({ ...draft, max: Number(e.target.value) || 0 })} style={field} />
                </div>
                <div style={row}>
                  <span style={{ fontSize: 12.5, color: maxOn ? '#1A1B1C' : '#9AA0A6' }}><LText text="长度超过时截去(W):"/></span>
                  <select data-testid="source-limit-trim-dir" disabled={!maxOn} value={draft.trimDir ?? 'right'} onChange={(e) => setDraft({ ...draft, trimDir: e.target.value as LengthLimit['trimDir'] })} style={field}>
                    <option value="right"><LText text="右侧截去"/></option>
                    <option value="left"><LText text="左侧截去"/></option>
                  </select>
                  <span style={{ fontSize: 12.5, color: '#9AA0A6' }}><LText text="多余字符"/></span>
                </div>
              </fieldset>
            </>
          </TabPanel>
          <TabPanel active={tab === 'cut'}>
            {/* 截短字符串：五项互相独立，可同时勾选（原版就是这么排的） */}
            <fieldset style={{ border: '1px solid #C8C6BF', padding: '10px 12px', margin: '0 0 10px', background: '#F7F7F7' }}>
              <legend style={{ fontSize: 12.5, padding: '0 4px' }}><LText text="截短字符串"/></legend>

              <div style={{ display: 'flex', gap: 28, marginBottom: 10 }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12.5 }}>
                  <input type="checkbox" data-testid="cut-trim-left" checked={cut.trimLeft === true} onChange={(e) => setCut({ ...cut, trimLeft: e.target.checked || undefined })} />
                  <LText text="删除左侧空格(L)"/>
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12.5 }}>
                  <input type="checkbox" data-testid="cut-trim-right" checked={cut.trimRight === true} onChange={(e) => setCut({ ...cut, trimRight: e.target.checked || undefined })} />
                  <LText text="删除右侧空格(R)"/>
                </label>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '150px 96px 1fr', gap: 8, alignItems: 'center', marginBottom: 8 }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12.5 }}>
                  <input
                    type="checkbox"
                    data-testid="cut-drop-left"
                    checked={cut.dropLeft !== undefined}
                    onChange={(e) => setCut({ ...cut, dropLeft: e.target.checked ? 0 : undefined })}
                  />
                  <LText text="丢弃左侧(D):"/>
                </label>
                <input
                  data-testid="cut-drop-left-count"
                  type="number" min={0} disabled={cut.dropLeft === undefined}
                  value={cut.dropLeft ?? 0}
                  onChange={(e) => setCut({ ...cut, dropLeft: Math.max(0, Number(e.target.value) || 0) })}
                  style={field}
                />
                <span style={{ fontSize: 12.5, color: '#4B5563' }}><LText text="个字符"/></span>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '150px 96px 1fr', gap: 8, alignItems: 'center', marginBottom: 8 }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12.5 }}>
                  <input
                    type="checkbox"
                    data-testid="cut-drop-right"
                    checked={cut.dropRight !== undefined}
                    onChange={(e) => setCut({ ...cut, dropRight: e.target.checked ? 0 : undefined })}
                  />
                  <LText text="丢弃右侧(C):"/>
                </label>
                <input
                  data-testid="cut-drop-right-count"
                  type="number" min={0} disabled={cut.dropRight === undefined}
                  value={cut.dropRight ?? 0}
                  onChange={(e) => setCut({ ...cut, dropRight: Math.max(0, Number(e.target.value) || 0) })}
                  style={field}
                />
                <span style={{ fontSize: 12.5, color: '#4B5563' }}><LText text="个字符"/></span>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '150px 96px 96px 1fr', gap: 8, alignItems: 'center' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12.5 }}>
                  <input
                    type="checkbox"
                    data-testid="cut-keep"
                    checked={cut.keepCount !== undefined}
                    onChange={(e) => setCut({ ...cut, keepCount: e.target.checked ? 0 : undefined, keepSide: cut.keepSide ?? 'left' })}
                  />
                  <LText text="保留(K):"/>
                </label>
                <select
                  data-testid="cut-keep-side"
                  disabled={cut.keepCount === undefined}
                  value={cut.keepSide ?? 'left'}
                  onChange={(e) => setCut({ ...cut, keepSide: e.target.value as 'left' | 'right' })}
                  style={field}
                >
                  <option value="left"><LText text="左侧"/></option>
                  <option value="right"><LText text="右侧"/></option>
                </select>
                <input
                  data-testid="cut-keep-count"
                  type="number" min={0} disabled={cut.keepCount === undefined}
                  value={cut.keepCount ?? 0}
                  onChange={(e) => setCut({ ...cut, keepCount: Math.max(0, Number(e.target.value) || 0) })}
                  style={field}
                />
                <span style={{ fontSize: 12.5, color: '#4B5563' }}><LText text="个字符"/></span>
              </div>
            </fieldset>

            {/* 字符验证暂时不开放（模型字段保留，旧模板里的配置仍生效，只是界面上不显示）。 */}
          </TabPanel>
          </TabPanels>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, padding: '8px 10px', borderTop: '1px solid #C8C6BF' }}>
          <button type="button" data-testid="source-advanced-ok" onClick={save} style={{ padding: '4px 22px', border: '1px solid #7A7A7A', background: '#fff', cursor: 'pointer', fontSize: 12.5, fontFamily: 'inherit' }}><LText text="确定"/></button>
          <button type="button" data-testid="source-advanced-cancel" onClick={onClose} style={{ padding: '4px 22px', border: '1px solid #C8C6BF', background: '#fff', cursor: 'pointer', fontSize: 12.5, fontFamily: 'inherit' }}><LText text="取消"/></button>
        </div>
      </div>
    </div>
  )
}
