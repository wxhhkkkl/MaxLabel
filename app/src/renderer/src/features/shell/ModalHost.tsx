import { useEffect, useRef, useState } from 'react'
import { useI18n } from '../i18n/useI18n'
import { localizeErrorText } from '../../../../shared/i18n/errors.en-US'
import type { Dataset, DbConnectionConfig, LabelDoc, LabelObject, PrinterConfig } from '../../../../shared/domain'
import type { MallMember } from '../../../../shared/ipcContract'
import type { DocTab } from '../workspace/useDocumentWorkspace'
import type { ModalKind } from './modalTypes'
import NewLabelDialog, { type LabelFormatInitial, type LabelFormatSelection } from '../../dialogs/NewLabelDialog'
import type { PaperGeometry, PaperShape } from '../../../../shared/domain/paper'
import { bannerStripGeometry } from '../../../../shared/domain/banner'
import { printerSupportsVariableColor } from '../../../../shared/print/capabilities'
import PrinterSettings from '../../dialogs/PrinterSettings'
import PrintersInstallDialog from '../../dialogs/PrintersInstallDialog'
import {
  configFromCatalogEntry,
  installBuiltInPrinter,
  builtInPrinterById,
  builtInPrinterValue,
  readInstalledPrinterIds,
  removeBuiltInPrinter
} from './installedPrinters'
import DataPanel from '../../dialogs/DataPanel'
import ExportModal from '../../dialogs/ExportModal'
import LicenseDialog from '../../dialogs/LicenseDialog'
import MallAccountDialog from '../../dialogs/MallAccountDialog'
import MallLoginDialog from '../../dialogs/MallLoginDialog'
import CloudTemplateDialog from '../../dialogs/CloudTemplateDialog'
import OptionsDialog, { saveOptions, type AppOptions } from '../../dialogs/OptionsDialog'
import AboutDialog from '../../dialogs/AboutDialog'
import HelpDialog from '../../dialogs/HelpDialog'
import ObjectPropsDialog from '../../dialogs/ObjectPropsDialog'
import ChangeDataDialog from '../../dialogs/ChangeDataDialog'
import GetStartedDialog from '../../dialogs/GetStartedDialog'
import FeedbackDialog from '../../dialogs/FeedbackDialog'
import TemplatePropsDialog from '../../dialogs/TemplatePropsDialog'
import CustomizeToolbarDialog from '../../dialogs/CustomizeToolbarDialog'
import PrintHistoryDialog from '../../dialogs/PrintHistoryDialog'
import PrintDialog, { type PrintAdvancedOptions } from '../../dialogs/PrintDialog'
import { printRecordTotal } from '../../dialogs/printRecordTotal'
import KeyInputOrderDialog, { collectKeyboardLabels } from '../../dialogs/KeyInputOrderDialog'
import TemplateLibDialog from '../../dialogs/TemplateLibDialog'
import ShareSpaceDialog from '../../dialogs/ShareSpaceDialog'
import { LocateRecordDialog, WeighDialog } from '../../dialogs/MoreDialogs'

interface RecentWarningProps { warnings: string[]; onClose: () => void }

function ImportWarningDialog({ warnings, onClose }: RecentWarningProps) {
  const { t, language } = useI18n()
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 400 }}>
      <div style={{ background: '#fff', borderRadius: 8, width: 520, maxHeight: 420, display: 'flex', flexDirection: 'column', boxShadow: '0 8px 30px rgba(0,0,0,0.25)' }}>
        <div style={{ padding: '12px 16px', borderBottom: '1px solid #e8e8e8', fontWeight: 600, fontSize: 14 }}>{t('importWarn.title')}</div>
        <div style={{ padding: '12px 16px', overflow: 'auto', flex: 1, fontSize: 13, lineHeight: 1.7, color: '#333' }}>
          <div style={{ marginBottom: 8, color: '#888' }}>{t('importWarn.intro')}</div>
          {warnings.map((warning, index) => <div key={index} style={{ padding: '4px 8px', marginBottom: 4, background: '#fffbe6', border: '1px solid #ffe58f', borderRadius: 4 }}>{localizeErrorText(language, warning)}</div>)}
        </div>
        <div style={{ padding: '10px 16px', borderTop: '1px solid #e8e8e8', textAlign: 'right' }}>
          <button onClick={onClose} style={{ padding: '6px 18px', background: '#22BDED', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer' }}>{t('importWarn.ok')}</button>
        </div>
      </div>
    </div>
  )
}

export interface ModalHostProps {
  modal: ModalKind
  setModal: (modal: ModalKind) => void
  activeDoc?: LabelDoc
  selectedObj: LabelObject | null
  propsTab: string
  options: AppOptions
  printer: PrinterConfig
  serverUrl: string
  onMallMember?: (member: MallMember | null) => void
  /** 软件内登录完成（member）或取消（null）；起始页/购买入口据此更新状态。 */
  onMallLogin?: (member: MallMember | null) => void
  importWarnings: string[]
  dbRecordCount: number
  dbCols: string[]
  dbRows: string[][]
  dbCurrentIndex: number
  tabs: DocTab[]
  active: string
  startKey: string
  onNew: (width: number, height: number, paper?: PaperGeometry, printerName?: string, format?: LabelFormatSelection) => void
  /** 「标签格式设置」确认：把新几何应用到当前标签（不新建文档）。 */
  onApplyLabelFormat: (width: number, height: number, paper?: PaperGeometry, printerName?: string, format?: LabelFormatSelection) => void
  onRequestNew: () => void
  onPrinterSave: (printer: PrinterConfig) => void
  /** 从「新建标签」打开打印机设置并保存：只更新默认打印机偏好，不改当前文档。 */
  onPrinterPreferenceSave: (printer: PrinterConfig) => void
  onPrinterInstall: (printer: PrinterConfig) => void
  onPrinterRemove: (removedValue: string) => void
  onDataImport: (dataset: Dataset) => void
  onImportReplace: (name: string, dataset: Dataset) => void
  onDataDelete: (name: string) => void
  onConnectionSave: (connection: DbConnectionConfig) => void
  onConnectionDelete: (id: string) => void
  onRenameField: (name: string, field: string, newField: string) => void
  onCloudLoad: (json: string) => void
  onOpenLib: (item: { name: string; path: string; mtime: number; size: number; widthMm?: number; heightMm?: number; remark?: string; thumb?: string }) => void
  onOpenJson: (json: string, name: string) => void
  onSaveCurrent: () => Promise<{ ok: boolean; message?: string }>
  onMsg: (message: string) => void
  onOptionsSave: (options: AppOptions) => void
  onPatchDoc: (patch: Partial<LabelDoc>) => void
  onUpdateObject: (patch: Partial<LabelObject>) => void
  /** 对象属性「确定」提交后：按共享变量名把最新设置同步到其它对象。 */
  onObjectCommit: (object: LabelObject) => void
  onKeyOrderSave: (order: string[]) => void
  onLocate: (index: number) => void
  onPreview: () => void
  onTestPrint: () => void
  printTitle: string
  printPrinterLabel: string
  printPrinterPosition: string
  printCount: number
  setPrintCount: (value: number) => void
  printCopies: number
  setPrintCopies: (value: number) => void
  printStartRecord: number
  setPrintStartRecord: (value: number) => void
  printStartLabel: number
  printPageLabelCount?: number
  setPrintStartLabel: (value: number) => void
  printAdvanced: PrintAdvancedOptions
  setPrintAdvanced: (patch: Partial<PrintAdvancedOptions>) => void
  onPrint: (count?: number) => void
  onSetActive: (key: string) => void
  onRefreshLibrary: () => void
}

/** 当前文档 → 「标签格式设置」编辑模式的初值。 */
function labelFormatInitialOf(doc: LabelDoc, fallbackShape: PaperShape): LabelFormatInitial {
  const layout = doc.layout
  const double = layout?.jointMode === 'double' || (layout?.jointWidthMm ?? 0) > 0
  const orientation = layout?.jointOrientation ?? 'vertical'
  // 文档存的是双联成品尺寸；格式对话框的宽/高输入的是单条尺寸。
  const strip = double ? bannerStripGeometry(doc.widthMm, doc.heightMm, layout?.jointWidthMm ?? 0, orientation) : { widthMm: doc.widthMm, heightMm: doc.heightMm }
  return {
    widthMm: strip.widthMm,
    heightMm: strip.heightMm,
    rows: double ? 1 : layout?.rows ?? 1,
    cols: double ? 1 : layout?.cols ?? 1,
    rowGapMm: layout?.rowGapMm ?? 0,
    colGapMm: layout?.colGapMm ?? 0,
    ...(layout?.pagesPerBox !== undefined ? { pagesPerBox: layout.pagesPerBox } : {}),
    ...(layout?.pageWidthMm !== undefined ? { pageWidthMm: layout.pageWidthMm } : {}),
    ...(layout?.pageHeightMm !== undefined ? { pageHeightMm: layout.pageHeightMm } : {}),
    ...(layout?.pageLeftMm !== undefined ? { pageLeftMm: layout.pageLeftMm } : {}),
    ...(layout?.pageTopMm !== undefined ? { pageTopMm: layout.pageTopMm } : {}),
    ...(layout?.shape ? { shape: layout.shape } : { shape: fallbackShape }),
    ...(layout?.innerShape ? { innerShape: layout.innerShape } : {}),
    ...(layout?.innerDiameterMm !== undefined ? { innerDiameterMm: layout.innerDiameterMm } : {}),
    ...(layout?.jointMode === 'double' ? { jointMode: 'double' as const } : {}),
    ...(layout?.jointWidthMm !== undefined ? { jointWidthMm: layout.jointWidthMm } : {}),
    ...(layout?.jointOrientation ? { jointOrientation: layout.jointOrientation } : {}),
    ...(layout?.mediaType !== undefined ? { mediaType: layout.mediaType } : {}),
    ...(layout?.labelColor ? { labelColor: layout.labelColor } : {}),
    ...(doc.formatKind ? { formatKind: doc.formatKind } : {})
  }
}

export default function ModalHost(props: ModalHostProps) {
  /** 关闭打印机设置后要回到的模态页（打印 / 新建标签 / 无）。用 ref：无需触发渲染，
   *  且离开设置页就清空 —— 直接 `setModal('printer')` 的入口（打印基座、起始页等）没有返回目标。 */
  const printerSettingsReturn = useRef<ModalKind | null>(null)
  /** 从「新建标签」打开设置时，配置的是对话框里选中的打印机，而不是当前文档的打印机。 */
  const [printerSettingsOverride, setPrinterSettingsOverride] = useState<PrinterConfig | null>(null)
  useEffect(() => {
    // 「安装打印机」是从设置页叠上去的，往返一趟不应丢掉返回目标。
    if (props.modal !== 'printer' && props.modal !== 'printers') {
      printerSettingsReturn.current = null
      setPrinterSettingsOverride(null)
    }
  }, [props.modal])
  const [installedPrinterIds, setInstalledPrinterIds] = useState<string[]>(() => readInstalledPrinterIds())
  /** 「安装打印机」的返回目标：新建标签页（自定义弹窗里的安装）或打印机设置页。 */
  const [installReturn, setInstallReturn] = useState<'new' | 'printer'>('new')
  const close = () => props.setModal(null)
  const openPrinterInstall = (returnTo: 'new' | 'printer') => {
    // 真机的「安装」对话框内容与当前选中的打印机无关（它是可安装打印机目录），
    // 因此这里只需要把最新的已安装列表读进来。
    setInstalledPrinterIds(readInstalledPrinterIds())
    setInstallReturn(returnTo)
    props.setModal('printers')
  }
  const closePrinterInstall = () => {
    // 从「打印机设置」里的安装入口进来时回到设置页，否则沿用原版工作流回到「选择标签格式」页。
    props.setModal(installReturn === 'printer' ? 'printer' : 'new')
  }
  /** 安装/移除 内置驱动打印机：只动「已安装打印机」这条偏好，装机结果与真机一致。 */
  const installCatalogPrinter = async (id: string) => {
    setInstalledPrinterIds(installBuiltInPrinter(id))
    const entry = builtInPrinterById(id)
    if (!entry) return
    // 真机把新装的打印机默认配成「USB 打印机端口 + 端口(O) 里排第一的设备」；
    // 复刻版在这里把枚举到的 USB 端口一起带上。
    let usbPort: string | undefined
    try {
      const ports = await window.maxlabel.listPorts()
      usbPort = (ports.usbPrinterPorts ?? [])[0]
    } catch {
      usbPort = undefined
    }
    props.onPrinterInstall(configFromCatalogEntry(entry, undefined, usbPort))
  }
  const removeCatalogPrinter = (id: string) => {
    setInstalledPrinterIds(removeBuiltInPrinter(id))
    props.onPrinterRemove(builtInPrinterValue(id))
  }
  const openPrinterSettings = (override?: PrinterConfig) => {
    // 从打印对话框 / 新建标签进入时，关闭设置要回到原窗口；其余入口关闭后回工作区。
    printerSettingsReturn.current = props.modal === 'print' || props.modal === 'new' ? props.modal : null
    setPrinterSettingsOverride(override ?? null)
    props.setModal('printer')
  }
  const closePrinterSettings = () => {
    const next = printerSettingsReturn.current
    printerSettingsReturn.current = null
    setPrinterSettingsOverride(null)
    props.setModal(next)
  }
  return (
    <>
      {props.modal === 'new' && <NewLabelDialog defaultW={props.options.defaultLabelW} defaultH={props.options.defaultLabelH} defaultShape={props.options.labelShape} onSelect={props.onNew} onClose={close} onPrinterSettings={openPrinterSettings} onInstallPrinter={() => openPrinterInstall('new')} />}
      {props.modal === 'labelFormat' && props.activeDoc && (
        <NewLabelDialog
          mode="edit"
          initial={labelFormatInitialOf(props.activeDoc, props.options.labelShape)}
          defaultShape={props.options.labelShape}
          onSelect={props.onApplyLabelFormat}
          onClose={close}
          onPrinterSettings={openPrinterSettings}
          onInstallPrinter={() => openPrinterInstall('new')}
        />
      )}
      {props.modal === 'printer' && (
        <PrinterSettings
          printer={printerSettingsOverride ?? props.printer}
          onClose={closePrinterSettings}
          onSave={(printer) => {
            if (printerSettingsOverride) props.onPrinterPreferenceSave(printer)
            else props.onPrinterSave(printer)
          }}
          onHelp={() => props.setModal('help')}
        />
      )}
      {props.modal === 'data' && props.activeDoc && <DataPanel datasets={props.activeDoc.datasets ?? {}} connections={props.activeDoc.connections ?? {}} onClose={close} onImport={props.onDataImport} onImportReplace={props.onImportReplace} onDelete={props.onDataDelete} onConnectionSave={props.onConnectionSave} onConnectionDelete={props.onConnectionDelete} onRenameField={props.onRenameField} />}
      {props.modal === 'export' && props.activeDoc && <ExportModal doc={props.activeDoc} selectedObj={props.selectedObj} allowScript={props.options.allowScript} onClose={close} />}
      {props.modal === 'mall' && <MallAccountDialog options={props.options} onClose={close} onMember={props.onMallMember} />}
      {props.modal === 'mallLogin' && (
        <MallLoginDialog
          options={props.options}
          onClose={() => { props.onMallLogin?.(null); close() }}
          onMember={(member) => { props.onMallLogin?.(member); close() }}
        />
      )}
      {props.modal === 'cloudtpl' && props.activeDoc && <CloudTemplateDialog doc={props.activeDoc} options={props.options} onClose={close} onLoad={props.onCloudLoad} />}
      {props.modal === 'shareSpace' && <ShareSpaceDialog options={props.options} onClose={close} onLoad={props.onCloudLoad} docName={props.activeDoc?.name} docJson={props.activeDoc ? JSON.stringify(props.activeDoc) : undefined} docWidthMm={props.activeDoc?.widthMm} docHeightMm={props.activeDoc?.heightMm} />}
      {props.modal === 'license' && <LicenseDialog onClose={close} />}
      {props.modal === 'tpllib' && <TemplateLibDialog onClose={() => { close(); props.onRefreshLibrary() }} onOpen={props.onOpenLib} docName={props.activeDoc?.name} docJson={props.activeDoc ? JSON.stringify(props.activeDoc) : undefined} onOpenJson={props.onOpenJson} onSaveCurrent={props.onSaveCurrent} onMsg={props.onMsg} />}
      {props.modal === 'options' && <OptionsDialog options={props.options} onSave={props.onOptionsSave} onClose={close} onHelp={() => props.setModal('help')} />}
      {props.modal === 'props' && props.activeDoc && props.selectedObj && <ObjectPropsDialog obj={props.selectedObj} datasets={props.activeDoc.datasets ?? {}} connections={props.activeDoc.connections ?? {}} allowMultipleDatabaseConnections={props.options.useMultipleDatabaseConnections} onPatch={props.onUpdateObject} onCommit={props.onObjectCommit} onClose={close} initialTab={props.propsTab} colorIndexTable={props.activeDoc.colorIndexTable} onPatchDoc={props.onPatchDoc} labelWidthMm={props.activeDoc.widthMm} labelHeightMm={props.activeDoc.heightMm} printerSupportsColor={printerSupportsVariableColor(props.printer)} printerDriver={props.printer.driver} printerPortType={props.printer.port.type} docSharedNames={sharedNamesOf(props.activeDoc)} layers={props.activeDoc.layers ?? []} docKeyboardLabels={collectKeyboardLabels(props.activeDoc)} onHelp={() => props.setModal('help')} />}
      {props.modal === 'changedata' && props.selectedObj && <ChangeDataDialog obj={props.selectedObj} onPatch={props.onUpdateObject} onClose={close} />}
      {props.modal === 'feedback' && <FeedbackDialog onClose={close} />}
      {props.modal === 'importwarn' && <ImportWarningDialog warnings={props.importWarnings} onClose={close} />}
      {props.modal === 'getstarted' && <GetStartedDialog onClose={close} onNew={props.onRequestNew} onPrinter={() => props.setModal('printer')} onEdit={() => { const first = props.tabs.find((tab) => tab.key !== props.startKey); props.onSetActive(first ? first.key : props.active) }} onPreview={props.onPreview} />}
      {props.modal === 'customizeToolbar' && <CustomizeToolbarDialog layout={props.options.toolbarLayout} onApply={(layout) => { const next = { ...props.options, toolbarLayout: layout }; saveOptions(next); props.onOptionsSave(next); close() }} onClose={close} />}
      {props.modal === 'tplprops' && props.activeDoc && <TemplatePropsDialog doc={props.activeDoc} onPatch={props.onPatchDoc} onClose={close} onPrinterSettings={() => props.setModal('printer')} />}
      {props.modal === 'history' && <PrintHistoryDialog onClose={close} />}
      {props.modal === 'print' && props.activeDoc && <PrintDialog title={props.printTitle} printerLabel={props.printPrinterLabel} printerPosition={props.printPrinterPosition} commandOutput={props.printer.port.type !== 'driver'} count={props.printCount} setCount={props.setPrintCount} copies={props.printCopies} setCopies={props.setPrintCopies} recordTotal={printRecordTotal(props.activeDoc.datasets, props.dbRecordCount)} startRecord={props.printStartRecord} setStartRecord={props.setPrintStartRecord} startLabel={props.printStartLabel} setStartLabel={props.setPrintStartLabel} pageLabelCount={props.printPageLabelCount} datasetFields={props.dbCols} advanced={props.printAdvanced} setAdvanced={props.setPrintAdvanced} onPrinterProperties={() => openPrinterSettings()} onPreview={() => { props.setModal(null); props.onPreview() }} onTestPrint={() => { props.setModal(null); props.onTestPrint() }} onHelp={() => props.setModal('help')} onClose={close} onPrint={props.onPrint} />}
      {props.modal === 'keyorder' && props.activeDoc && <KeyInputOrderDialog doc={props.activeDoc} onSave={props.onKeyOrderSave} onClose={close} />}
      {props.modal === 'locate' && <LocateRecordDialog total={props.dbRecordCount} dsCols={props.dbCols} dsRows={props.dbRows} currentIndex={props.dbCurrentIndex} onLocate={props.onLocate} onClose={close} />}
      {props.modal === 'weigh' && <WeighDialog onClose={close} />}
      {props.modal === 'printers' && <PrintersInstallDialog installedIds={installedPrinterIds} onInstall={installCatalogPrinter} onRemove={removeCatalogPrinter} onHelp={() => props.setModal('help')} onClose={closePrinterInstall} />}
      {props.modal === 'about' && <AboutDialog onClose={close} />}
      {props.modal === 'help' && <HelpDialog onClose={close} />}
    </>
  )
}
/** 文档里已用过的共享变量名（真机「变量共享名称」是可编辑组合框，可从已有名里选）。 */
type SharedNameCarrier = { sharedName?: string; subSources?: unknown[] }
type SharedNameObject = { type: string; children?: unknown; source?: SharedNameCarrier; subSources?: SharedNameCarrier[] }
function sharedNamesOf(doc: { objects: SharedNameObject[] }): string[] {
  const names = new Set<string>()
  const visit = (source: SharedNameCarrier | undefined): void => {
    if (!source) return
    if (source.sharedName) names.add(source.sharedName)
    for (const sub of source.subSources ?? []) visit(sub as SharedNameCarrier)
  }
  const walk = (objects: SharedNameObject[]): void => {
    for (const object of objects) {
      if (object.type === 'group' && Array.isArray(object.children)) { walk(object.children as SharedNameObject[]); continue }
      visit(object.source)
      // 子串挂在对象上（objects.ts 的 subSources），不在 source 里，这里必须单独走一遍，
      // 否则对象 B 的下拉里选不到对象 A 子串上命名的共享变量名。
      for (const sub of object.subSources ?? []) visit(sub)
    }
  }
  walk(doc.objects)
  return [...names].sort()
}
