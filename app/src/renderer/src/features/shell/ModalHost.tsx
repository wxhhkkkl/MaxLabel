import { useState } from 'react'
import type { Dataset, DbConnectionConfig, LabelDoc, LabelObject, PrinterConfig } from '../../../../shared/domain'
import type { UpdateCheckResultDto } from '../../../../shared/ipcContract'
import type { DocTab } from '../workspace/useDocumentWorkspace'
import type { ModalKind } from './modalTypes'
import NewLabelDialog, { type LabelFormatSelection } from '../../dialogs/NewLabelDialog'
import type { PaperGeometry } from '../../../../shared/domain/paper'
import { printerSupportsVariableColor } from '../../../../shared/print/capabilities'
import PrinterSettings from '../../dialogs/PrinterSettings'
import PrintersInstallDialog from '../../dialogs/PrintersInstallDialog'
import {
  configFromCatalogEntry,
  installLabelShopPrinter,
  labelShopPrinterById,
  labelShopPrinterValue,
  readInstalledPrinterIds,
  removeLabelShopPrinter
} from './installedPrinters'
import DataPanel from '../../dialogs/DataPanel'
import ExportModal from '../../dialogs/ExportModal'
import LicenseDialog from '../../dialogs/LicenseDialog'
import CloudDialog from '../../dialogs/CloudDialog'
import OptionsDialog, { saveOptions, type AppOptions } from '../../dialogs/OptionsDialog'
import AboutDialog from '../../dialogs/AboutDialog'
import HelpDialog from '../../dialogs/HelpDialog'
import ObjectPropsDialog from '../../dialogs/ObjectPropsDialog'
import ChangeDataDialog from '../../dialogs/ChangeDataDialog'
import GetStartedDialog from '../../dialogs/GetStartedDialog'
import TemplateWizardDialog, { type WizardChoice } from '../../dialogs/TemplateWizardDialog'
import FeedbackDialog from '../../dialogs/FeedbackDialog'
import TemplatePropsDialog from '../../dialogs/TemplatePropsDialog'
import CustomizeToolbarDialog from '../../dialogs/CustomizeToolbarDialog'
import PrintHistoryDialog from '../../dialogs/PrintHistoryDialog'
import PrintDialog, { type PrintAdvancedOptions } from '../../dialogs/PrintDialog'
import KeyInputOrderDialog from '../../dialogs/KeyInputOrderDialog'
import TemplateLibDialog from '../../dialogs/TemplateLibDialog'
import { LocateRecordDialog, WeighDialog, UpdateDialog } from '../../dialogs/MoreDialogs'

interface RecentWarningProps { warnings: string[]; onClose: () => void }

function ImportWarningDialog({ warnings, onClose }: RecentWarningProps) {
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 400 }}>
      <div style={{ background: '#fff', borderRadius: 8, width: 520, maxHeight: 420, display: 'flex', flexDirection: 'column', boxShadow: '0 8px 30px rgba(0,0,0,0.25)' }}>
        <div style={{ padding: '12px 16px', borderBottom: '1px solid #e8e8e8', fontWeight: 600, fontSize: 14 }}>LabelShop 文件导入提示</div>
        <div style={{ padding: '12px 16px', overflow: 'auto', flex: 1, fontSize: 13, lineHeight: 1.7, color: '#333' }}>
          <div style={{ marginBottom: 8, color: '#888' }}>已按 LabelShop 格式打开该文件，以下元素未能完整转换，请在画布中检查并手动补建：</div>
          {warnings.map((warning, index) => <div key={index} style={{ padding: '4px 8px', marginBottom: 4, background: '#fffbe6', border: '1px solid #ffe58f', borderRadius: 4 }}>{warning}</div>)}
        </div>
        <div style={{ padding: '10px 16px', borderTop: '1px solid #e8e8e8', textAlign: 'right' }}>
          <button onClick={onClose} style={{ padding: '6px 18px', background: '#22BDED', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer' }}>知道了</button>
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
  /** 「查找更新版本」/启动自动检查的结果（null=尚未检查）。 */
  updateResult: UpdateCheckResultDto | null
  importWarnings: string[]
  dbRecordCount: number
  dbCols: string[]
  dbRows: string[][]
  dbCurrentIndex: number
  tabs: DocTab[]
  active: string
  startKey: string
  onNew: (width: number, height: number, paper?: PaperGeometry, printerName?: string, format?: LabelFormatSelection) => void
  onRequestNew: () => void
  onWizardNext: (choice: WizardChoice, skip: boolean) => void
  onPrinterSave: (printer: PrinterConfig) => void
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
  onKeyOrderSave: (order: string[]) => void
  onLocate: (index: number) => void
  onPreview: () => void
  /** 文档绑定「签赋LabelShop 打印机」（内置驱动）时禁用预览入口（真机 probe-19/20）。 */
  previewBlocked: boolean
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

export default function ModalHost(props: ModalHostProps) {
  const [returnToPrint, setReturnToPrint] = useState(false)
  const [installedPrinterIds, setInstalledPrinterIds] = useState<string[]>(() => readInstalledPrinterIds())
  const close = () => props.setModal(null)
  const openPrinterInstall = () => {
    // 真机的「安装」对话框内容与当前选中的打印机无关（它是可安装打印机目录），
    // 因此这里只需要把最新的已安装列表读进来。
    setInstalledPrinterIds(readInstalledPrinterIds())
    props.setModal('printers')
  }
  const closePrinterInstall = () => {
    // “安装打印机”目前只从“选择标签格式”页进入；关闭/安装后沿用 LabelShop 的工作流返回该页，
    // 防止底层的打印窗口或其它模态页被意外露出来。
    props.setModal('new')
  }
  /** 安装/移除 LabelShop 打印机：只动「已安装打印机」这条偏好，装机结果与真机一致。 */
  const installCatalogPrinter = async (id: string) => {
    setInstalledPrinterIds(installLabelShopPrinter(id))
    const entry = labelShopPrinterById(id)
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
    setInstalledPrinterIds(removeLabelShopPrinter(id))
    props.onPrinterRemove(labelShopPrinterValue(id))
  }
  const openPrinterSettings = () => {
    setReturnToPrint(props.modal === 'print')
    props.setModal('printer')
  }
  const closePrinterSettings = () => {
    const next = returnToPrint
    setReturnToPrint(false)
    props.setModal(next ? 'print' : null)
  }
  return (
    <>
      {props.modal === 'new' && <NewLabelDialog defaultW={props.options.defaultLabelW} defaultH={props.options.defaultLabelH} defaultShape={props.options.labelShape} onSelect={props.onNew} onClose={close} onInstallPrinter={openPrinterInstall} onPrinterSettings={openPrinterSettings} onHelp={() => props.setModal('help')} />}
      {props.modal === 'wizard' && <TemplateWizardDialog onNext={props.onWizardNext} onClose={close} />}
      {props.modal === 'printer' && <PrinterSettings printer={props.printer} onClose={closePrinterSettings} onSave={props.onPrinterSave} />}
      {props.modal === 'data' && props.activeDoc && <DataPanel datasets={props.activeDoc.datasets ?? {}} connections={props.activeDoc.connections ?? {}} serverUrl={props.serverUrl} onClose={close} onImport={props.onDataImport} onImportReplace={props.onImportReplace} onDelete={props.onDataDelete} onConnectionSave={props.onConnectionSave} onConnectionDelete={props.onConnectionDelete} onRenameField={props.onRenameField} />}
      {props.modal === 'export' && props.activeDoc && <ExportModal doc={props.activeDoc} selectedObj={props.selectedObj} onClose={close} />}
      {props.modal === 'cloud' && props.activeDoc && <CloudDialog doc={props.activeDoc} serverUrl={props.serverUrl} onClose={close} onLoad={props.onCloudLoad} />}
      {props.modal === 'license' && <LicenseDialog onClose={close} />}
      {props.modal === 'tpllib' && <TemplateLibDialog onClose={() => { close(); props.onRefreshLibrary() }} onOpen={props.onOpenLib} docName={props.activeDoc?.name} docJson={props.activeDoc ? JSON.stringify(props.activeDoc) : undefined} onOpenJson={props.onOpenJson} onSaveCurrent={props.onSaveCurrent} onMsg={props.onMsg} />}
      {props.modal === 'options' && <OptionsDialog options={props.options} onSave={props.onOptionsSave} onClose={close} />}
      {props.modal === 'props' && props.activeDoc && props.selectedObj && <ObjectPropsDialog obj={props.selectedObj} datasets={props.activeDoc.datasets ?? {}} connections={props.activeDoc.connections ?? {}} allowMultipleDatabaseConnections={props.options.useMultipleDatabaseConnections} onPatch={props.onUpdateObject} onClose={close} initialTab={props.propsTab} colorIndexTable={props.activeDoc.colorIndexTable} onPatchDoc={props.onPatchDoc} labelWidthMm={props.activeDoc.widthMm} labelHeightMm={props.activeDoc.heightMm} printerSupportsColor={printerSupportsVariableColor(props.printer)} docSharedNames={sharedNamesOf(props.activeDoc)} />}
      {props.modal === 'changedata' && props.selectedObj && <ChangeDataDialog obj={props.selectedObj} onPatch={props.onUpdateObject} onClose={close} />}
      {props.modal === 'feedback' && <FeedbackDialog onClose={close} />}
      {props.modal === 'importwarn' && <ImportWarningDialog warnings={props.importWarnings} onClose={close} />}
      {props.modal === 'getstarted' && <GetStartedDialog onClose={close} onNew={props.onRequestNew} onPrinter={() => props.setModal('printer')} onEdit={() => { const first = props.tabs.find((tab) => tab.key !== props.startKey); props.onSetActive(first ? first.key : props.active) }} onPreview={props.onPreview} />}
      {props.modal === 'customizeToolbar' && <CustomizeToolbarDialog layout={props.options.toolbarLayout} onApply={(layout) => { const next = { ...props.options, toolbarLayout: layout }; saveOptions(next); props.onOptionsSave(next); close() }} onClose={close} />}
      {props.modal === 'tplprops' && props.activeDoc && <TemplatePropsDialog doc={props.activeDoc} onPatch={props.onPatchDoc} onClose={close} onPrinterSettings={() => props.setModal('printer')} />}
      {props.modal === 'history' && <PrintHistoryDialog onClose={close} />}
      {props.modal === 'print' && props.activeDoc && <PrintDialog title={props.printTitle} printerLabel={props.printPrinterLabel} printerPosition={props.printPrinterPosition} commandOutput={props.printer.port.type !== 'driver'} count={props.printCount} setCount={props.setPrintCount} copies={props.printCopies} setCopies={props.setPrintCopies} startRecord={props.printStartRecord} setStartRecord={props.setPrintStartRecord} startLabel={props.printStartLabel} setStartLabel={props.setPrintStartLabel} pageLabelCount={props.printPageLabelCount} advanced={props.printAdvanced} setAdvanced={props.setPrintAdvanced} onPrinterProperties={openPrinterSettings} previewBlocked={props.previewBlocked} onPreview={() => { props.setModal(null); props.onPreview() }} onTestPrint={() => { props.setModal(null); props.onTestPrint() }} onHelp={() => props.setModal('help')} onClose={close} onPrint={props.onPrint} />}
      {props.modal === 'keyorder' && props.activeDoc && <KeyInputOrderDialog doc={props.activeDoc} onSave={props.onKeyOrderSave} onClose={close} />}
      {props.modal === 'locate' && <LocateRecordDialog total={props.dbRecordCount} dsCols={props.dbCols} dsRows={props.dbRows} currentIndex={props.dbCurrentIndex} onLocate={props.onLocate} onClose={close} />}
      {props.modal === 'weigh' && <WeighDialog onClose={close} />}
      {props.modal === 'printers' && <PrintersInstallDialog installedIds={installedPrinterIds} onInstall={installCatalogPrinter} onRemove={removeCatalogPrinter} onHelp={() => props.setModal('help')} onClose={closePrinterInstall} />}
      {props.modal === 'update' && <UpdateDialog result={props.updateResult} onClose={close} />}
      {props.modal === 'about' && <AboutDialog onClose={close} onActivate={() => props.setModal('license')} />}
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
