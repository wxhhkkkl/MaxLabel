import { useEffect, useState , useMemo } from 'react'
import type { LabelDoc } from '../types'
import { resolvePrintScene } from '../../../shared/print/scene'
import { printModeHint } from '../../../shared/print/capabilities'
import { defaultPrinterConfig } from '../../../shared/domain/printer'
import { useI18n } from '../features/i18n/useI18n'
import { useEntitlements } from '../features/entitlement/useEntitlements'
import LText from '../features/i18n/LText'
import { MAX_PRINT_COPIES, MAX_PRINT_LOGICAL_LABELS } from '../../../shared/print/plan'
import { TabPanel, TabPanels } from '../dialogs/Modal'
import ContextMenu from './ContextMenu'
import type { MenuItem } from './MenuBar'

interface Props {
  doc: LabelDoc
  title?: string
  busy: boolean
  count: number
  setCount: (n: number) => void
  copies: number
  setCopies: (n: number) => void
  datasetNames: string[]
  datasetName: string
  onDatasetChange: (name: string) => void
  onPrinterSettings: () => void
  onPrinterNameChange?: (name: string) => void
  onData: () => void
  onPrint: () => void
  onCancel?: () => void
  /** Shown only when a weigh source enables automatic printing. */
  autoPrintAvailable?: boolean
  autoPrinting?: boolean
  onToggleAutoPrint?: () => void
  /** 打开打印历史记录 */
  onHistory?: () => void
  /** 隐藏面板（停靠菜单"隐藏"项） */
  onHide?: () => void
}

export default function PrintDock(props: Props) {
  const { t } = useI18n()
  const { state: entitlement } = useEntitlements()
  const features = entitlement.features
  const { doc, busy } = props
  // 实时算当前打印方式：文档或打印机一变就重算，保证提示和真正打印用的是同一份判定。
  const modeHint = useMemo(() => {
    try {
      const printer = doc.printer ?? defaultPrinterConfig()
      const scene = resolvePrintScene(doc, { labelIndex: 1, recordIndex: 0, copy: 1, count: 1, totalLabels: 1, title: doc.name, printerName: '', datasets: doc.datasets ?? {}, sharedVars: {}, keyboardValues: {} })
      return printModeHint(scene, printer)
    } catch {
      return null
    }
  }, [doc])
  /** 打印方式文字：端口先行（驱动/文件都会弹对话框），端口能直连时才看版面能否用指令还原。 */
  const modeLabel = modeHint
    ? modeHint.mode === 'native' ? t('print.modeNative')
      : modeHint.mode === 'mixed' ? t('print.modeMixed')
        : modeHint.mode === 'raster' ? t('print.modeRaster')
          : modeHint.mode === 'driver' ? t('print.modeDriver')
            : t('print.modeFile')
    : null
  const [tab, setTab] = useState<'params' | 'server' | 'help'>('params')
  const [dockMenu, setDockMenu] = useState<{ x: number; y: number } | null>(null)
  const [installedPrinters, setInstalledPrinters] = useState<Array<{ name: string; displayName: string }>>([])
  useEffect(() => {
    let alive = true
    window.maxlabel.listPrinters().then((result) => {
      if (alive) setInstalledPrinters((result.printers ?? []).map((item) => ({ name: item.name, displayName: item.displayName || item.name })))
    }).catch(() => {
      if (alive) setInstalledPrinters([])
    })
    return () => { alive = false }
  }, [])
  const portLabel = doc.printer?.port.type === 'lpt'
    ? t('print.dock.lpt', { port: doc.printer.port.lptPort ?? 'LPT1' })
    : doc.printer?.port.type === 'driver'
      ? t('print.dock.driver', { detail: doc.printer.printerName ? t('print.dock.driverDetail', { name: doc.printer.printerName }) : '' })
      : doc.printer?.port.type ?? ''
  const driverLabel = doc.printer ? `${doc.printer.driver.toUpperCase()} · ${doc.printer.dpi}dpi · ${portLabel}` : t('print.dock.notConfigured')

  const dockMenuItems: MenuItem[] = [
    { label: t('print.dock.float'), disabled: true },
    { label: t('print.dock.dock'), checked: true, disabled: true },
    { label: t('print.dock.tabbed'), disabled: true },
    { label: t('print.dock.autoHide'), disabled: true },
    { label: t('print.dock.hide'), action: () => props.onHide?.() }
  ]

  return (
    <div data-testid="print-dock" style={{ width: 300, background: '#FBFBF8', borderLeft: '1px solid #E4E3DD', display: 'flex', flexDirection: 'column', boxSizing: 'border-box', overflow: 'auto' }}>
      <div
        onContextMenu={(e) => {
          e.preventDefault()
          setDockMenu({ x: e.clientX, y: e.clientY })
        }}
        style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 8px 8px 12px', fontSize: 12, color: '#6B7280', borderBottom: '1px solid #ECEBE6', fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', cursor: 'default' }}
      >
        <span data-testid="print-dock-title" style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{t('print.dock.title', { title: props.title ?? doc.name })}</span>
        <span style={{ display: 'flex', gap: 2, alignItems: 'center', flexShrink: 0, marginLeft: 8 }}>
          <span aria-hidden="true" title={t('print.dock.autoHideTitle')} style={{ color: '#9AA0A6', fontSize: 12 }}>📌</span>
          <span onClick={() => props.onHide?.()} title={t('print.dock.closeTitle')} style={{ cursor: 'pointer', color: '#9AA0A6', padding: '0 2px', fontSize: 14, lineHeight: 1 }}>×</span>
        </span>
      </div>
      <div style={{ display: 'flex', borderBottom: '1px solid #ECEBE6', background: '#F6F5F2' }}>
        {(
          [
            ['params', t('print.tab.params')],
            ['server', t('print.tab.server')],
            ['help', t('print.tab.help')]
          ] as const
        ).map(([k, label]) => (
          <button
            key={k}
            type="button"
            data-testid={`print-tab-${k}`}
            disabled={k === 'help'}
            onClick={() => { if (k !== 'help') setTab(k) }}
            style={{
              flex: 1,
              padding: '7px 0',
              fontSize: 12.5,
              border: 'none',
              background: tab === k ? '#FFFFFF' : 'transparent',
              borderBottom: tab === k ? '2px solid #2E6E93' : '2px solid transparent',
              color: k === 'help' ? '#B0AFA9' : tab === k ? '#1A1B1C' : '#6B7280',
              cursor: k === 'help' ? 'not-allowed' : 'pointer',
              fontFamily: 'inherit'
            }}
          >
            {label}
          </button>
        ))}
      </div>

      <TabPanels>
      <TabPanel active={tab === 'params'}>
        <div style={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div data-testid="print-input-data" style={{ border: '1px solid #E4E3DD', minHeight: 132, padding: '10px 10px 12px', boxSizing: 'border-box' }}>
            <div style={{ fontSize: 12, color: '#6B7280', marginBottom: 8 }}>{t('print.inputData')}</div>
            <div style={{ display: 'flex', gap: 6, alignItems: 'flex-start' }}>
              <select
                value={props.datasetName}
                onChange={(e) => props.onDatasetChange(e.target.value)}
                aria-label={t('print.inputData')}
                style={{ flex: 1, minWidth: 0, padding: '6px 8px', border: '1px solid #D5D4CD', borderRadius: 6, fontSize: 13, background: '#fff', color: '#1A1B1C' }}
              >
                {props.datasetNames.length === 0 && <option value="">{t('print.noDataset')}</option>}
                {props.datasetNames.map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={props.onData}
                style={{ padding: '6px 10px', borderRadius: 6, border: '1px solid #D5D4CD', background: '#fff', color: '#1A1B1C', cursor: 'pointer', fontSize: 12.5, fontFamily: 'inherit', whiteSpace: 'nowrap' }}
                title={t('print.manageTitle')}
              >
                {t('print.manage')}
              </button>
            </div>
          </div>

          <div>
            <div style={{ fontSize: 12, color: '#6B7280', marginBottom: 6 }}>{t('print.printer')}</div>
            <div style={{ display: 'flex', gap: 6 }}>
              <select
                value={doc.printer?.printerName ?? ''}
                data-testid="print-printer"
                onChange={(e) => props.onPrinterNameChange?.(e.target.value)}
                disabled={doc.printer?.port.type !== 'driver'}
                style={{ flex: 1, minWidth: 0, padding: '6px 8px', border: '1px solid #D5D4CD', borderRadius: 6, fontSize: 13, background: '#fff', color: '#1A1B1C' }}
                title={driverLabel}
              >
                <option value="">{doc.printer?.printerName?.trim() || t('print.systemDefault')}</option>
                {doc.printer?.printerName && !installedPrinters.some((item) => item.name === doc.printer?.printerName) && <option value={doc.printer.printerName}>{t('print.currentTemplatePrinter', { name: doc.printer.printerName })}</option>}
                {installedPrinters.map((item) => <option key={item.name} value={item.name}>{item.displayName}</option>)}
              </select>
              <button
                type="button"
                data-testid="print-printer-settings"
                onClick={props.onPrinterSettings}
                style={{ flexShrink: 0, padding: '6px 12px', borderRadius: 6, border: '1px solid #D5D4CD', background: '#fff', color: '#1A1B1C', cursor: 'pointer', fontSize: 12.5, fontFamily: 'inherit', whiteSpace: 'nowrap' }}
                title={t('print.settingsTitle')}
              >
                {t('print.settings')}
              </button>
            </div>
          </div>

          <div style={{ display: 'flex', gap: 8 }}>
            <label style={{ fontSize: 12.5, color: '#1A1B1C', flex: 1, display: 'flex', alignItems: 'center', gap: 6 }}>
              {t('print.count')}
              <input
                type="number"
                data-testid="print-count"
                min={1}
                max={99999}
                value={props.count}
                onChange={(e) => props.setCount(Math.min(MAX_PRINT_LOGICAL_LABELS, Math.max(1, parseInt(e.target.value || '1', 10))))}
                style={{ width: 56, padding: '6px 6px', border: '1px solid #D5D4CD', borderRadius: 6, fontSize: 13 }}
              />
            </label>
            <label style={{ fontSize: 12.5, color: '#1A1B1C', flex: 1, display: 'flex', alignItems: 'center', gap: 6 }}>
              {t('print.copies')}
              <input
                type="number"
                data-testid="print-copies"
                min={1}
                max={99999}
                value={props.copies}
                onChange={(e) => props.setCopies(Math.min(MAX_PRINT_COPIES, Math.max(1, parseInt(e.target.value || '1', 10))))}
                style={{ width: 56, padding: '6px 6px', border: '1px solid #D5D4CD', borderRadius: 6, fontSize: 13 }}
              />
            </label>
          </div>
          <button
            type="button"
            data-testid="print-submit"
            onClick={busy ? props.onCancel : props.onPrint}
            disabled={busy && !props.onCancel}
            style={{ padding: '10px 0', borderRadius: 8, border: busy ? '1px solid #B34747' : '1px solid #2E6E93', background: busy ? '#FFF5F5' : '#2E6E93', color: busy ? '#B34747' : '#fff', cursor: busy && !props.onCancel ? 'not-allowed' : 'pointer', fontSize: 14, fontWeight: 600, fontFamily: 'inherit' }}
          >
            {busy ? t('print.cancelOperation') : t('print.print')}
          </button>
          {modeHint && (
            <div data-testid="print-mode-hint" style={{ marginTop: 6, fontSize: 11, lineHeight: 1.5, color: modeHint.mode === 'native' ? '#2E7D32' : '#B26A00' }}>
              <div>{modeLabel}</div>
              {modeHint.reason && <div data-testid="print-mode-reason" style={{ color: '#6B7280' }}>{t('print.modeReason')}{modeHint.reason}</div>}
            </div>
          )}
          {props.autoPrintAvailable && (
            <button
              type="button"
              data-testid="scale-auto-print"
              onClick={() => features.scaleAutoPrint ? props.onToggleAutoPrint?.() : undefined}
              disabled={!features.scaleAutoPrint}
              title={features.scaleAutoPrint ? undefined : t('entitlement.featureLocked')}
              style={{ padding: '8px 0', borderRadius: 8, border: props.autoPrinting ? '1px solid #B34747' : '1px solid #D5D4CD', background: props.autoPrinting ? '#FFF5F5' : '#fff', color: props.autoPrinting ? '#B34747' : '#1A1B1C', cursor: features.scaleAutoPrint ? 'pointer' : 'not-allowed', opacity: features.scaleAutoPrint ? 1 : 0.5, fontSize: 13, fontFamily: 'inherit' }}
            >
              {props.autoPrinting ? t('scale.autoStop') : t('scale.autoStart')}
            </button>
          )}
        </div>
      </TabPanel>

      <TabPanel active={tab === 'server'}>
        <div style={{ padding: 14, fontSize: 12.5, color: '#4B5563', lineHeight: 1.7 }}>
          <div style={{ fontWeight: 600, color: '#1A1B1C', marginBottom: 8 }}>{t('print.service.title')}</div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
            <span style={{ width: 8, height: 8, borderRadius: 4, background: '#52C41A', display: 'inline-block' }} />
            <span style={{ color: '#1A1B1C' }}>{t('print.service.local')}</span>
            <span style={{ color: '#9CA3AF' }}>{t('print.service.running')}</span>
          </div>
          <div style={{ fontSize: 12, color: '#6B7280', marginBottom: 12 }}>
            {t('print.service.output', { mode: doc.printer ? doc.printer.driver.toUpperCase() : t('print.service.unconfigured'), port: portLabel, dpi: doc.printer?.dpi ?? 203 })}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
            <span style={{ width: 8, height: 8, borderRadius: 4, background: '#F5222D', display: 'inline-block' }} />
            <span style={{ color: '#1A1B1C' }}><LText text="打印服务连接"/></span>
            <span style={{ color: '#9CA3AF' }}><LText text="未连接（需云服务）"/></span>
          </div>
          <div style={{ fontSize: 12, color: '#6B7280' }}>
            <LText text="云端模板、打印日志与集中分发使用同一版本功能；连接服务器后即可使用。"/>
          </div>
          <button
            type="button"
            onClick={() => features.databaseSources && entitlement.editable ? props.onData() : undefined}
            disabled={!features.databaseSources || !entitlement.editable}
            title={features.databaseSources ? (entitlement.editable ? undefined : t('entitlement.readOnly')) : t('entitlement.featureLocked')}
            style={{ marginTop: 10, padding: '7px 14px', borderRadius: 6, border: '1px solid #2E6E93', background: '#fff', color: '#2E6E93', cursor: features.databaseSources && entitlement.editable ? 'pointer' : 'not-allowed', opacity: features.databaseSources && entitlement.editable ? 1 : 0.5, fontSize: 12.5, fontFamily: 'inherit' }}
          >
            <LText text="打开数据设置"/>
          </button>
          {props.onHistory && (
            <button
              type="button"
              onClick={() => features.printHistory ? props.onHistory?.() : undefined}
              disabled={!features.printHistory}
              title={features.printHistory ? undefined : t('entitlement.featureLocked')}
              style={{ marginTop: 8, marginLeft: 8, padding: '7px 14px', borderRadius: 6, border: '1px solid #D5D4CD', background: '#fff', color: '#1A1B1C', cursor: features.printHistory ? 'pointer' : 'not-allowed', opacity: features.printHistory ? 1 : 0.5, fontSize: 12.5, fontFamily: 'inherit' }}
            >
              <LText text="打印历史记录"/>
            </button>
          )}
        </div>
      </TabPanel>

      <TabPanel active={tab === 'help'}>
        <div style={{ padding: 14, fontSize: 12.5, color: '#4B5563', lineHeight: 1.75 }}>
          <div style={{ fontWeight: 600, color: '#1A1B1C', marginBottom: 6 }}><LText text="打印帮助"/></div>
          <div style={{ marginBottom: 6 }}>· <b><LText text="打印数量"/></b><LText text="：打印变化标签的数量。当变量为序列号/数据库时，按此数量逐张推进变量。"/></div>
          <div style={{ marginBottom: 6 }}>· <b><LText text="单签拷贝"/></b><LText text="：同一张标签重复输出的份数。实际输出 = 打印数量 × 单签拷贝。"/></div>
          <div style={{ marginBottom: 6 }}>· <b><LText text="测试打印"/></b><LText text="：打印 1 张，不写日志、不更新序列号变量。"/></div>
          <div style={{ marginBottom: 6 }}>· <b><LText text="指令直连"/></b><LText text="：TSPL/ZPL/CPCL 等指令集直发打印机，支持文件/TCP/COM/LPT/蓝牙（SPP 虚拟串口）/USB（经已安装的驱动队列 RAW 发送）。"/></div>
          <div style={{ marginBottom: 6 }}>· <b><LText text="驱动打印"/></b><LText text="：走 Windows 打印机驱动（图形打印），兼容激光/喷墨等页式打印机；默认静默提交，失败时才弹系统对话框。"/></div>
          <div style={{ marginBottom: 6 }}>· <b><LText text="序列号回写"/></b><LText text="：可选择打印后自动递增并保存，便于批量连续标签；关闭后保留当前序列号。"/></div>
          <div style={{ marginBottom: 6 }}>· <b><LText text="数据库打印"/></b><LText text="：结合数据集逐记录打印；可选择打印数量、起始记录、仅当前记录、查重，以及打印后是否更新序列号。"/></div>
        </div>
      </TabPanel>
      </TabPanels>
      {dockMenu && (
        <ContextMenu
          x={dockMenu.x}
          y={dockMenu.y}
          items={dockMenuItems}
          onClose={() => setDockMenu(null)}
        />
      )}
    </div>
  )
}
