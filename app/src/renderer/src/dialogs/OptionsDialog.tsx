import { useState } from 'react'

/** 主工具栏按钮组（分组名逐条取自帮助 toolbar_mainbar.html 的小节标题）。
 *  「添加或删除按钮」按组勾选显示/隐藏，勾选结果随系统选项持久化。 */
export const TOOLBAR_GROUPS = [
  { key: 'file', label: '文件操作' },
  { key: 'edit', label: '复制、粘贴' },
  { key: 'history', label: '撤消、重做' },
  { key: 'print', label: '打印' },
  { key: 'object', label: '对象' },
  { key: 'database', label: '数据库' },
  { key: 'view', label: '显示' },
  { key: 'help', label: '帮助' }
] as const

export type ToolbarGroupKey = (typeof TOOLBAR_GROUPS)[number]['key']

export const TOOLBAR_GROUP_KEYS: ToolbarGroupKey[] = TOOLBAR_GROUPS.map((g) => g.key)

export type ToolbarGroupVisibility = Record<ToolbarGroupKey, boolean>

export function defaultToolbarGroups(): ToolbarGroupVisibility {
  return TOOLBAR_GROUP_KEYS.reduce((acc, key) => { acc[key] = true; return acc }, {} as ToolbarGroupVisibility)
}

/** 只接受已知分组的布尔值，未知键丢弃；缺失键按原版默认（显示）补齐。 */
export function normalizeToolbarGroups(value: unknown): ToolbarGroupVisibility {
  const raw = value && typeof value === 'object' ? value as Record<string, unknown> : {}
  const out = defaultToolbarGroups()
  for (const key of TOOLBAR_GROUP_KEYS) if (typeof raw[key] === 'boolean') out[key] = raw[key] as boolean
  return out
}

export interface AppOptions {
  // 通用
  language: 'zh-CN'
  unit: 'mm' | 'inch'
  printNonPrintable: boolean
  deselectNonPrintable: boolean
  allowScript: boolean
  workspaceBg: string
  /** 云服务器地址（部署在用户自己的服务器上，用于在线授权鉴权与云存储） */
  serverUrl: string
  // 标签
  defaultLabelW: number
  defaultLabelH: number
  labelRows: number
  labelCols: number
  rowGapMm: number
  colGapMm: number
  labelShape: 'rect' | 'roundRect' | 'ellipse'
  // 打印参数
  defaultPrintMode: 'driver' | 'command'
  defaultCommandSet: 'tspl' | 'zpl' | 'cpcl'
  defaultDpi: number
  /** LabelShop“打印和数据库”中的默认多连接开关。 */
  useMultipleDatabaseConnections: boolean
  startWithWizard: boolean
  showRulers: boolean
  showGrid: boolean
  /** 打印时按物理纸张方向自动旋转输出内容。 */
  autoRotateOutput: boolean
  /** 主工具栏各按钮组的显示/隐藏（帮助 toolbar_mainbar.html「添加或删除按钮」）。 */
  toolbarGroups: ToolbarGroupVisibility
}

const DEFAULT_BG = '#22BDED'

export const DEFAULTS: AppOptions = {
  language: 'zh-CN',
  unit: 'mm',
  printNonPrintable: true,
  deselectNonPrintable: false,
  allowScript: false,
  workspaceBg: DEFAULT_BG,
  serverUrl: 'http://127.0.0.1:8420',
  defaultLabelW: 60,
  defaultLabelH: 40,
  labelRows: 1,
  labelCols: 1,
  rowGapMm: 2,
  colGapMm: 2,
  labelShape: 'rect',
  defaultPrintMode: 'driver',
  defaultCommandSet: 'tspl',
  defaultDpi: 203,
  useMultipleDatabaseConnections: false,
  startWithWizard: false,
  showRulers: true,
  showGrid: false,
  autoRotateOutput: false,
  toolbarGroups: defaultToolbarGroups()
}

export function normalizeAppOptions(value: unknown): AppOptions {
  const raw = value && typeof value === 'object' ? value as Partial<AppOptions> : {}
  const commandSet = raw.defaultCommandSet === 'zpl' || raw.defaultCommandSet === 'cpcl' ? raw.defaultCommandSet : DEFAULTS.defaultCommandSet
  const printMode = raw.defaultPrintMode === 'command' ? 'command' : 'driver'
  const shape = raw.labelShape === 'roundRect' || raw.labelShape === 'ellipse' ? raw.labelShape : DEFAULTS.labelShape
  const finite = (input: unknown, fallback: number, min: number, max: number) => {
    const n = typeof input === 'number' && Number.isFinite(input) ? input : fallback
    return Math.max(min, Math.min(max, n))
  }
  return {
    ...DEFAULTS,
    language: 'zh-CN',
    unit: raw.unit === 'inch' ? 'inch' : 'mm',
    printNonPrintable: raw.printNonPrintable === undefined ? DEFAULTS.printNonPrintable : raw.printNonPrintable === true,
    deselectNonPrintable: raw.deselectNonPrintable === undefined ? DEFAULTS.deselectNonPrintable : raw.deselectNonPrintable === true,
    allowScript: raw.allowScript === undefined ? DEFAULTS.allowScript : raw.allowScript === true,
    workspaceBg: typeof raw.workspaceBg === 'string' && /^#[0-9a-f]{6}$/i.test(raw.workspaceBg) ? raw.workspaceBg : DEFAULTS.workspaceBg,
    serverUrl: typeof raw.serverUrl === 'string' ? raw.serverUrl.trim().slice(0, 2048) : DEFAULTS.serverUrl,
    defaultLabelW: finite(raw.defaultLabelW, DEFAULTS.defaultLabelW, 1, 10000),
    defaultLabelH: finite(raw.defaultLabelH, DEFAULTS.defaultLabelH, 1, 10000),
    labelRows: Math.floor(finite(raw.labelRows, DEFAULTS.labelRows, 1, 100)),
    labelCols: Math.floor(finite(raw.labelCols, DEFAULTS.labelCols, 1, 100)),
    rowGapMm: finite(raw.rowGapMm, DEFAULTS.rowGapMm, 0, 1000),
    colGapMm: finite(raw.colGapMm, DEFAULTS.colGapMm, 0, 1000),
    labelShape: shape,
    defaultPrintMode: printMode,
    defaultCommandSet: commandSet,
    defaultDpi: [203, 300, 600].includes(Number(raw.defaultDpi)) ? Number(raw.defaultDpi) : DEFAULTS.defaultDpi,
    useMultipleDatabaseConnections: raw.useMultipleDatabaseConnections === true,
    startWithWizard: raw.startWithWizard === true,
    showRulers: raw.showRulers !== false,
    showGrid: raw.showGrid === true,
    autoRotateOutput: raw.autoRotateOutput === true,
    toolbarGroups: normalizeToolbarGroups(raw.toolbarGroups)
  }
}

export function loadOptions(): AppOptions {
  try {
    const raw = localStorage.getItem('maxlabel.options')
    const saved = normalizeAppOptions(raw ? JSON.parse(raw) : undefined)
    // 云服务器地址以独立 key 为准（授权对话框同样读写它），保持单一来源
    const sv = localStorage.getItem('maxlabel_server_url')
    if (sv) saved.serverUrl = sv.trim()
    return saved
  } catch {
    return { ...DEFAULTS }
  }
}

export function saveOptions(o: AppOptions) {
  const normalized = normalizeAppOptions(o)
  try {
    localStorage.setItem('maxlabel.options', JSON.stringify(normalized))
    localStorage.setItem('maxlabel_server_url', normalized.serverUrl)
  } catch {
    // The in-memory options still apply for this session when browser storage
    // is full or disabled by the host environment.
  }
}

interface Props {
  options: AppOptions
  onSave: (o: AppOptions) => void
  onClose: () => void
}

const field = { padding: '6px 8px', border: '1px solid #D5D4CD', borderRadius: 6, fontSize: 13, background: '#fff', color: '#1A1B1C' }
const numField = { ...field, width: 80 }

const TAB_STYLE = (active: boolean) => ({
  padding: '8px 18px',
  fontSize: 13,
  fontWeight: active ? 600 : 400,
  color: active ? '#2E6E93' : '#4B5563',
  borderBottom: active ? '2px solid #2E6E93' : '2px solid transparent',
  background: 'none',
  cursor: 'pointer',
  fontFamily: 'inherit'
})

function Row({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, padding: '7px 0', borderBottom: '1px solid #F4F3EE' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
        <span style={{ fontSize: 13, color: '#1A1B1C' }}>{label}</span>
        {hint && <span style={{ fontSize: 11.5, color: '#9AA0A6' }}>{hint}</span>}
      </div>
      {children}
    </div>
  )
}

export default function OptionsDialog({ options, onSave, onClose }: Props) {
  const [o, setO] = useState<AppOptions>(options)
  const [tab, setTab] = useState<'general' | 'label' | 'print'>('general')
  const set = (patch: Partial<AppOptions>) => setO((prev) => ({ ...prev, ...patch }))

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.35)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 300 }}>
      <div data-testid="options-dialog" style={{ background: '#fff', borderRadius: 12, width: 520, maxWidth: '94vw', boxShadow: '0 16px 60px rgba(0,0,0,0.3)', padding: 0, overflow: 'hidden' }}>
        <div style={{ padding: '12px 16px', borderBottom: '1px solid #ECEBE6', fontSize: 15, fontWeight: 600, color: '#1A1B1C' }}>系统选项</div>

        <div style={{ display: 'flex', gap: 4, borderBottom: '1px solid #ECEBE6', padding: '0 16px' }}>
          <button type="button" style={TAB_STYLE(tab === 'general')} onClick={() => setTab('general')}>通用</button>
          <button type="button" style={TAB_STYLE(tab === 'label')} onClick={() => setTab('label')}>标签</button>
          <button type="button" style={TAB_STYLE(tab === 'print')} onClick={() => setTab('print')}>打印参数</button>
        </div>

        <div style={{ padding: '10px 16px', maxHeight: 380, overflowY: 'auto' }}>
          {tab === 'general' && (
            <>
              <Row label="界面语言">
                <select value={o.language} onChange={(e) => set({ language: e.target.value as AppOptions['language'] })} style={field}>
                  <option value="zh-CN">简体中文</option>
                </select>
              </Row>
              <Row label="标尺单位" hint="编辑标签时使用的长度单位">
                <select value={o.unit} onChange={(e) => set({ unit: e.target.value as AppOptions['unit'] })} style={field}>
                  <option value="mm">毫米（公制）</option>
                  <option value="inch">英寸（英制）</option>
                </select>
              </Row>
              <Row label="输出非打印对象" hint="可以输出具有非打印属性的对象">
                <input type="checkbox" checked={o.printNonPrintable} onChange={(e) => set({ printNonPrintable: e.target.checked })} style={{ width: 16, height: 16, cursor: 'pointer' }} />
              </Row>
              <Row label="不选中非打印对象" hint="非打印对象仅作为背景显示，不能被选中">
                <input type="checkbox" checked={o.deselectNonPrintable} onChange={(e) => set({ deselectNonPrintable: e.target.checked })} style={{ width: 16, height: 16, cursor: 'pointer' }} />
              </Row>
              <Row label="允许执行脚本" hint="允许执行脚本变量中的脚本，实现高级数据处理">
                <input data-testid="allow-script" type="checkbox" checked={o.allowScript} onChange={(e) => set({ allowScript: e.target.checked })} style={{ width: 16, height: 16, cursor: 'pointer' }} />
              </Row>
              <Row label="自动旋转输出页面" hint="打印时让内容自动跟随纸张的旋转方向">
                <input data-testid="auto-rotate-output-page" type="checkbox" checked={o.autoRotateOutput} onChange={(e) => set({ autoRotateOutput: e.target.checked })} style={{ width: 16, height: 16, cursor: 'pointer' }} />
              </Row>
              <Row label="云服务器地址" hint="部署在您服务器上的云服务（在线授权鉴权 + 云存储），如 https://cloud.example.com">
                <input value={o.serverUrl} onChange={(e) => set({ serverUrl: e.target.value })} style={{ ...field, width: 250, fontFamily: 'Consolas, monospace' }} placeholder="https://cloud.example.com" />
              </Row>
              <Row label="标签工作区背景颜色">
                <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                  <input type="color" value={o.workspaceBg} onChange={(e) => set({ workspaceBg: e.target.value })} style={{ width: 56, height: 28, border: '1px solid #D5D4CD', borderRadius: 6, cursor: 'pointer' }} />
                  <button type="button" onClick={() => set({ workspaceBg: DEFAULT_BG })} style={{ padding: '5px 10px', borderRadius: 6, border: '1px solid #D5D4CD', background: '#fff', color: '#1A1B1C', cursor: 'pointer', fontSize: 12 }}>
                    恢复默认
                  </button>
                </div>
              </Row>
            </>
          )}

          {tab === 'label' && (
            <>
              <Row label="默认标签尺寸" hint="新建标签时的默认宽度/高度">
                <div style={{ display: 'flex', gap: 6, alignItems: 'center', fontSize: 13, color: '#1A1B1C' }}>
                  <input type="number" min={5} max={500} value={o.defaultLabelW} onChange={(e) => set({ defaultLabelW: parseFloat(e.target.value) || 60 })} style={numField} /> mm ×
                  <input type="number" min={5} max={500} value={o.defaultLabelH} onChange={(e) => set({ defaultLabelH: parseFloat(e.target.value) || 40 })} style={numField} /> mm
                </div>
              </Row>
              <Row label="排列" hint="页面上的行数与列数">
                <div style={{ display: 'flex', gap: 6, alignItems: 'center', fontSize: 13, color: '#1A1B1C' }}>
                  行
                  <input type="number" min={1} max={20} value={o.labelRows} onChange={(e) => set({ labelRows: parseInt(e.target.value, 10) || 1 })} style={numField} /> 列
                  <input type="number" min={1} max={20} value={o.labelCols} onChange={(e) => set({ labelCols: parseInt(e.target.value, 10) || 1 })} style={numField} />
                </div>
              </Row>
              <Row label="行列间隔" hint="标签之间的间隔（mm）">
                <div style={{ display: 'flex', gap: 6, alignItems: 'center', fontSize: 13, color: '#1A1B1C' }}>
                  行
                  <input type="number" min={0} step={0.5} value={o.rowGapMm} onChange={(e) => set({ rowGapMm: parseFloat(e.target.value) || 0 })} style={numField} /> 列
                  <input type="number" min={0} step={0.5} value={o.colGapMm} onChange={(e) => set({ colGapMm: parseFloat(e.target.value) || 0 })} style={numField} />
                </div>
              </Row>
              <Row label="外观形状">
                <select value={o.labelShape} onChange={(e) => set({ labelShape: e.target.value as AppOptions['labelShape'] })} style={field}>
                  <option value="rect">直角矩形</option>
                  <option value="roundRect">圆角矩形</option>
                  <option value="ellipse">圆形</option>
                </select>
              </Row>
            </>
          )}

          {tab === 'print' && (
            <>
              <Row label="默认打印方式">
                <select value={o.defaultPrintMode} onChange={(e) => set({ defaultPrintMode: e.target.value as AppOptions['defaultPrintMode'] })} style={field}>
                  <option value="driver">Windows 驱动打印</option>
                  <option value="command">指令直连打印</option>
                </select>
              </Row>
              <Row label="默认指令集">
                <select value={o.defaultCommandSet} onChange={(e) => set({ defaultCommandSet: e.target.value as AppOptions['defaultCommandSet'] })} style={field}>
                  <option value="tspl">TSPL</option>
                  <option value="zpl">ZPL</option>
                  <option value="cpcl">CPCL</option>
                </select>
              </Row>
              <Row label="默认分辨率">
                <select value={o.defaultDpi} onChange={(e) => set({ defaultDpi: parseInt(e.target.value, 10) })} style={field}>
                  <option value={203}>203 dpi</option>
                  <option value={300}>300 dpi</option>
                  <option value={600}>600 dpi</option>
                </select>
              </Row>
              <Row label="默认使用多个数据库连接" hint="打开后，数据源可以按对象选择数据库连接；关闭时沿用单连接模式">
                <input data-testid="use-multiple-database-connections" type="checkbox" checked={o.useMultipleDatabaseConnections} onChange={(e) => set({ useMultipleDatabaseConnections: e.target.checked })} style={{ width: 16, height: 16, cursor: 'pointer' }} />
              </Row>
              <Row label="启动时运行模板向导" hint="启动时弹出新建标签模板向导">
                <input type="checkbox" checked={o.startWithWizard} onChange={(e) => set({ startWithWizard: e.target.checked })} style={{ width: 16, height: 16, cursor: 'pointer' }} />
              </Row>
              <Row label="显示标尺">
                <input type="checkbox" checked={o.showRulers} onChange={(e) => set({ showRulers: e.target.checked })} style={{ width: 16, height: 16, cursor: 'pointer' }} />
              </Row>
              <Row label="显示网格">
                <input type="checkbox" checked={o.showGrid} onChange={(e) => set({ showGrid: e.target.checked })} style={{ width: 16, height: 16, cursor: 'pointer' }} />
              </Row>
            </>
          )}
        </div>

        <div style={{ padding: '12px 16px', borderTop: '1px solid #ECEBE6', display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button type="button" onClick={onClose} style={{ padding: '7px 18px', borderRadius: 7, border: '1px solid #D5D4CD', background: '#fff', color: '#1A1B1C', cursor: 'pointer', fontSize: 13, fontFamily: 'inherit' }}>
            取消
          </button>
          <button type="button" onClick={() => { saveOptions(o); onSave(o); }} style={{ padding: '7px 18px', borderRadius: 7, border: '1px solid #2E6E93', background: '#2E6E93', color: '#fff', cursor: 'pointer', fontSize: 13, fontFamily: 'inherit' }}>
            保存
          </button>
        </div>
      </div>
    </div>
  )
}
