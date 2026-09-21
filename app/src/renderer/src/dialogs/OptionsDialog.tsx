import { useState } from 'react'
import {
  TOOLBAR_GROUPS,
  TOOLBAR_GROUP_KEYS,
  defaultToolbarLayout,
  defaultToolbarGroups,
  normalizeToolbarGroups,
  normalizeToolbarLayout,
  type ToolbarGroupKey,
  type ToolbarGroupVisibility,
  type ToolbarLayout
} from '../editor/toolbarLayout'

// 工具栏分组/布局的定义已集中到 editor/toolbarLayout.ts（工具栏与系统选项共用单一来源），
// 这里转出以保持既有引用路径不变。
export { TOOLBAR_GROUPS, TOOLBAR_GROUP_KEYS, defaultToolbarGroups, normalizeToolbarGroups }
export type { ToolbarGroupKey, ToolbarGroupVisibility, ToolbarLayout }

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
  /** 真机「系统设置 → 常规」：新建对象后自动打开属性页（默认关闭）。 */
  autoOpenObjectProps: boolean
  /**
   * 真机「系统设置 → 编辑 → 表格操作」：`增删行列时，保持表格尺寸`。
   * 作为新建表格对象 `keepSize` 的全局默认值（真机该页实测为未勾选态，复刻版默认随之取 false）。
   */
  tableKeepSizeOnResize: boolean
  /** 主工具栏各按钮组的显示/隐藏（帮助 toolbar_mainbar.html「添加或删除按钮」）。 */
  toolbarGroups: ToolbarGroupVisibility
  /** 主工具栏逐按钮的自定义布局：顺序 / 显示 / 按键（「添加或删除按钮 → 自定义...」）。 */
  toolbarLayout: ToolbarLayout
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
  // 真机「系统设置 → 常规」的「新建对象后自动打开属性页」（默认未勾选，见 65-dlg-options.png）
  autoOpenObjectProps: false,
  // 真机「系统设置 → 编辑 → 表格操作」实测为未勾选态（probe-r112-sysset-tab-edit.png）
  tableKeepSizeOnResize: false,
  toolbarGroups: defaultToolbarGroups(),
  toolbarLayout: defaultToolbarLayout()
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
    autoOpenObjectProps: raw.autoOpenObjectProps === true,
    tableKeepSizeOnResize: raw.tableKeepSizeOnResize === true,
    toolbarGroups: normalizeToolbarGroups(raw.toolbarGroups),
    toolbarLayout: normalizeToolbarLayout(raw.toolbarLayout)
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
  /** 底排「帮助」按钮（真机底排 = 确定 / 取消 / 帮助，probe-r112-sysset.png）。 */
  onHelp?: () => void
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

/** 分组框（真机「系统设置」每一页都由分组框构成，见 probe-r112-sysset.png）。 */
function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <fieldset data-testid={`options-group-${title}`} style={{ border: '1px solid #D9D8D2', borderRadius: 4, padding: '2px 12px 6px', margin: '0 0 10px' }}>
      <legend style={{ fontSize: 12.5, color: '#1A1B1C', padding: '0 6px' }}>{title}</legend>
      {children}
    </fieldset>
  )
}

/**
 * 复刻版扩展区：承载真机「系统设置」里没有、但复刻版已提供且用户正在使用的设置。
 * DIFF-71 要求「不许为了页签一致把设置直接砍掉」，故这些项保留在对应页底部并显式标注来源，
 * 同时刻意不用 `options-group-*` 前缀，以免污染真机四个分组框的逐项断言。
 */
function ExtGroup({ children }: { children: React.ReactNode }) {
  return (
    <fieldset
      data-testid="options-extensions"
      style={{ border: '1px dashed #D9D8D2', borderRadius: 4, padding: '2px 12px 6px', margin: '10px 0 0' }}
    >
      <legend style={{ fontSize: 12, color: '#6B7280', padding: '0 6px' }}>复刻版扩展（原版系统设置中无此项）</legend>
      {children}
    </fieldset>
  )
}

export default function OptionsDialog({ options, onSave, onClose, onHelp }: Props) {
  const [o, setO] = useState<AppOptions>(options)
  // 页签按真机「系统设置」原文与顺序：常规 / 打印和数据库 / 编辑 / 系统（probe-r112-sysset.md 第一节）。
  // 复刻版原先自造的「标签」页在真机没有对应物，其设置已移入各页底部的「复刻版扩展」区（见 DIFF-71）。
  const [tab, setTab] = useState<'general' | 'print' | 'edit' | 'system'>('general')
  const set = (patch: Partial<AppOptions>) => setO((prev) => ({ ...prev, ...patch }))

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.35)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 300 }}>
      <div data-testid="options-dialog" style={{ background: '#fff', borderRadius: 12, width: 520, maxWidth: '94vw', boxShadow: '0 16px 60px rgba(0,0,0,0.3)', padding: 0, overflow: 'hidden' }}>
        {/* 真机窗口标题是「系统设置」（菜单项叫「系统选项(C)...」）—— 见 65-dlg-options.png / probe-r112-sysset.png */}
        <div style={{ padding: '12px 16px', borderBottom: '1px solid #ECEBE6', fontSize: 15, fontWeight: 600, color: '#1A1B1C' }}>系统设置</div>

        <div style={{ display: 'flex', gap: 4, borderBottom: '1px solid #ECEBE6', padding: '0 16px' }}>
          <button type="button" data-testid="options-tab-general" style={TAB_STYLE(tab === 'general')} onClick={() => setTab('general')}>常规</button>
          <button type="button" data-testid="options-tab-print" style={TAB_STYLE(tab === 'print')} onClick={() => setTab('print')}>打印和数据库</button>
          <button type="button" data-testid="options-tab-edit" style={TAB_STYLE(tab === 'edit')} onClick={() => setTab('edit')}>编辑</button>
          <button type="button" data-testid="options-tab-system" style={TAB_STYLE(tab === 'system')} onClick={() => setTab('system')}>系统</button>
        </div>

        <div style={{ padding: '10px 16px', maxHeight: 380, overflowY: 'auto' }}>
          {tab === 'general' && (
            <>
              {/* 真机「系统设置 → 常规」页的四个分组框与字段原文：
                  probe-r112-sysset.png、probe-r112-sysset-tree.txt、帮助 config_general.html */}
              <Group title="语言">
                <Row label="界面语言(L):">
                  <select value={o.language} onChange={(e) => set({ language: e.target.value as AppOptions['language'] })} style={field}>
                    <option value="zh-CN">简体中文</option>
                  </select>
                </Row>
              </Group>
              <Group title="单位">
                <Row label="标尺单位(U):" hint="编辑标签时使用的长度单位">
                  <select value={o.unit} onChange={(e) => set({ unit: e.target.value as AppOptions['unit'] })} style={field}>
                    {/* 真机下拉原文就是 `毫米` / `英寸`（2 项，无「（公制）/（英制）」后缀）——
                        probe-r112-sysset.png 实拍值显示 `毫米`，PROBE-verifier-round100-sysset-controls.md 枚举确认。 */}
                    <option value="mm">毫米</option>
                    <option value="inch">英寸</option>
                  </select>
                </Row>
              </Group>
              <Group title="非打印对象">
                <Row label="输出非打印对象(P)" hint="可以输出具有非打印属性的对象">
                  <input type="checkbox" checked={o.printNonPrintable} onChange={(e) => set({ printNonPrintable: e.target.checked })} style={{ width: 16, height: 16, cursor: 'pointer' }} />
                </Row>
                <Row label="不选中非打印对象(N)" hint="非打印对象仅作为背景显示，不能被选中">
                  <input type="checkbox" checked={o.deselectNonPrintable} onChange={(e) => set({ deselectNonPrintable: e.target.checked })} style={{ width: 16, height: 16, cursor: 'pointer' }} />
                </Row>
              </Group>
              <Group title="其它">
                <Row label="允许运行脚本(S)" hint="允许执行脚本变量中的脚本，实现高级数据处理">
                  <input data-testid="allow-script" type="checkbox" checked={o.allowScript} onChange={(e) => set({ allowScript: e.target.checked })} style={{ width: 16, height: 16, cursor: 'pointer' }} />
                </Row>
                <Row label="启动时运行模板向导" hint="设置是否在启动时启动模板向导对话框">
                  <input data-testid="start-with-wizard" type="checkbox" checked={o.startWithWizard} onChange={(e) => set({ startWithWizard: e.target.checked })} style={{ width: 16, height: 16, cursor: 'pointer' }} />
                </Row>
                <Row label="自动旋转输出页面" hint="打印时让内容自动跟随纸张的旋转方向">
                  <input data-testid="auto-rotate-output-page" type="checkbox" checked={o.autoRotateOutput} onChange={(e) => set({ autoRotateOutput: e.target.checked })} style={{ width: 16, height: 16, cursor: 'pointer' }} />
                </Row>
                {/* 真机「系统设置 → 常规」：新建对象后自动打开属性页（probe-r112-sysset.png，默认未勾选） */}
                <Row label="新建对象后自动打开属性页" hint="用工具新建对象后立即弹出该对象的属性对话框">
                  <input data-testid="auto-open-object-props" type="checkbox" checked={o.autoOpenObjectProps} onChange={(e) => set({ autoOpenObjectProps: e.target.checked })} style={{ width: 16, height: 16, cursor: 'pointer' }} />
                </Row>
                <Row label="标签工作区背景颜色：">
                  <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                    <input type="color" value={o.workspaceBg} onChange={(e) => set({ workspaceBg: e.target.value })} style={{ width: 56, height: 28, border: '1px solid #D5D4CD', borderRadius: 6, cursor: 'pointer' }} />
                    <button type="button" onClick={() => set({ workspaceBg: DEFAULT_BG })} style={{ padding: '5px 10px', borderRadius: 6, border: '1px solid #D5D4CD', background: '#fff', color: '#1A1B1C', cursor: 'pointer', fontSize: 12 }}>
                      恢复默认
                    </button>
                  </div>
                </Row>
              </Group>
              {/* 以下为复刻版扩展项：真机「系统设置」无对应物，但复刻版已提供且用户在用（DIFF-71 处置要求） */}
              <ExtGroup>
                {/* 云服务地址是复刻版自有的扩展项（真机系统设置里没有） */}
                <Row label="云服务器地址" hint="部署在您服务器上的云服务（在线授权鉴权 + 云存储），如 https://cloud.example.com">
                  <input value={o.serverUrl} onChange={(e) => set({ serverUrl: e.target.value })} style={{ ...field, width: 250, fontFamily: 'Consolas, monospace' }} placeholder="https://cloud.example.com" />
                </Row>
                {/* 原先挂在复刻版自造「标签」页上的新建默认值（真机把形状/行列/间距放在「标签格式设置」里） */}
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
                <Row label="外观形状" hint="新建标签时的默认形状；「标签格式设置」里按真机叫「方角矩形/圆角矩形/圆形」">
                  <select data-testid="default-label-shape" value={o.labelShape} onChange={(e) => set({ labelShape: e.target.value as AppOptions['labelShape'] })} style={field}>
                    <option value="rect">方角矩形</option>
                    <option value="roundRect">圆角矩形</option>
                    <option value="ellipse">圆形</option>
                  </select>
                </Row>
                <Row label="显示标尺">
                  <input data-testid="show-rulers" type="checkbox" checked={o.showRulers} onChange={(e) => set({ showRulers: e.target.checked })} style={{ width: 16, height: 16, cursor: 'pointer' }} />
                </Row>
                <Row label="显示网格">
                  <input data-testid="show-grid" type="checkbox" checked={o.showGrid} onChange={(e) => set({ showGrid: e.target.checked })} style={{ width: 16, height: 16, cursor: 'pointer' }} />
                </Row>
              </ExtGroup>
            </>
          )}

          {tab === 'print' && (
            <>
              {/* 真机「系统设置 → 打印和数据库」的分组框与字段原文见 probe-r112-sysset-tab2.png。
                  复刻版只渲染已有真实行为可挂的项；其余（打印到文件 / 打印设置(S) / 使用常规 Excel engine /
                  发现重复数据时允许打印）登记为待实现，见 parity/diffs.md DIFF-71，不做空壳控件。 */}
              <Group title="数据库">
                <Row label="默认使用多个数据库连接(M)" hint="打开后，数据源可以按对象选择数据库连接；关闭时沿用单连接模式">
                  <input data-testid="use-multiple-database-connections" type="checkbox" checked={o.useMultipleDatabaseConnections} onChange={(e) => set({ useMultipleDatabaseConnections: e.target.checked })} style={{ width: 16, height: 16, cursor: 'pointer' }} />
                </Row>
              </Group>
              <ExtGroup>
                <Row label="默认打印方式">
                  <select data-testid="default-print-mode" value={o.defaultPrintMode} onChange={(e) => set({ defaultPrintMode: e.target.value as AppOptions['defaultPrintMode'] })} style={field}>
                    <option value="driver">Windows 驱动打印</option>
                    <option value="command">指令直连打印</option>
                  </select>
                </Row>
                <Row label="默认指令集">
                  <select data-testid="default-command-set" value={o.defaultCommandSet} onChange={(e) => set({ defaultCommandSet: e.target.value as AppOptions['defaultCommandSet'] })} style={field}>
                    <option value="tspl">TSPL</option>
                    <option value="zpl">ZPL</option>
                    <option value="cpcl">CPCL</option>
                  </select>
                </Row>
                <Row label="默认分辨率">
                  <select data-testid="default-dpi" value={o.defaultDpi} onChange={(e) => set({ defaultDpi: parseInt(e.target.value, 10) })} style={field}>
                    <option value={203}>203 dpi</option>
                    <option value={300}>300 dpi</option>
                    <option value={600}>600 dpi</option>
                  </select>
                </Row>
              </ExtGroup>
            </>
          )}

          {tab === 'edit' && (
            <>
              {/* 真机「系统设置 → 编辑」页（probe-r112-sysset-tab-edit.png）：
                  表格操作 = 增删行列时，保持表格尺寸 / 鼠标拖动时仅调整首行首列尺寸 / 鼠标拖动时仅调整末行末列尺寸
                  选项     = 禁用鼠标拖动复制功能 / 使用宽松圈选模式
                  复刻版目前只有「表格尺寸」这一条有对应行为（新建表格对象的全局默认），其余三条登记为待实现
                  （见 parity/diffs.md DIFF-71），不渲染无行为的空壳控件。 */}
              <Group title="表格操作">
                <Row label="增删行列时，保持表格尺寸" hint="新建表格对象时的默认值：在表格外框内重排行高列宽">
                  <input data-testid="table-keep-size-on-resize" type="checkbox" checked={o.tableKeepSizeOnResize} onChange={(e) => set({ tableKeepSizeOnResize: e.target.checked })} style={{ width: 16, height: 16, cursor: 'pointer' }} />
                </Row>
              </Group>
            </>
          )}

          {tab === 'system' && (
            <>
              {/* 真机「系统设置 → 系统」页（probe-r112-sysset-tab3.png）：
                  系统操作 = 按钮「恢复默认窗体布局」；文档 = 自动打开最后使用的文档 + 按钮「恢复模板文档双击链接」；
                  授权许可 = 下拉。
                  复刻版的「窗体布局」体现在工具栏分组/逐按钮布局（AppOptions.toolbarGroups/toolbarLayout），
                  故按钮按真机作用域重置这两项；文档与授权许可两组登记为待实现（见 parity/diffs.md DIFF-71）。 */}
              <Group title="系统操作">
                <Row label="恢复默认窗体布局" hint="把工具栏分组与逐按钮布局恢复为出厂状态（保存后生效）">
                  <button
                    type="button"
                    data-testid="reset-window-layout"
                    onClick={() => set({ toolbarGroups: defaultToolbarGroups(), toolbarLayout: defaultToolbarLayout() })}
                    style={{ padding: '5px 12px', borderRadius: 6, border: '1px solid #D5D4CD', background: '#fff', color: '#1A1B1C', cursor: 'pointer', fontSize: 12, fontFamily: 'inherit' }}
                  >
                    恢复默认窗体布局
                  </button>
                </Row>
              </Group>
            </>
          )}
        </div>

        {/* 底排按钮按真机顺序与点位（probe-r112-sysset.png 实拍，左→右）：`确定` / `取消` / `帮助`；
            真机的 `应用(&A)` 是**隐藏**控件（控件树 dump 行首 `[ ]`），复刻版不显示。 */}
        <div style={{ padding: '12px 16px', borderTop: '1px solid #ECEBE6', display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button type="button" data-testid="options-save" onClick={() => { saveOptions(o); onSave(o); onClose() }} style={{ padding: '7px 18px', borderRadius: 7, border: '1px solid #2E6E93', background: '#2E6E93', color: '#fff', cursor: 'pointer', fontSize: 13, fontFamily: 'inherit' }}>
            确定
          </button>
          <button type="button" onClick={onClose} style={{ padding: '7px 18px', borderRadius: 7, border: '1px solid #D5D4CD', background: '#fff', color: '#1A1B1C', cursor: 'pointer', fontSize: 13, fontFamily: 'inherit' }}>
            取消
          </button>
          <button type="button" data-testid="options-help" onClick={onHelp} style={{ padding: '7px 18px', borderRadius: 7, border: '1px solid #D5D4CD', background: '#fff', color: '#1A1B1C', cursor: 'pointer', fontSize: 13, fontFamily: 'inherit' }}>
            帮助
          </button>
        </div>
      </div>
    </div>
  )
}
