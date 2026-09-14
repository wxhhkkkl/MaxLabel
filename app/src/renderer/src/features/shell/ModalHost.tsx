import type { Dataset, DbConnectionConfig, LabelDoc, LabelObject, PrinterConfig } from '../../../../shared/domain'
import type { DocTab } from '../workspace/useDocumentWorkspace'
import type { ModalKind } from './modalTypes'
import NewLabelDialog from '../../dialogs/NewLabelDialog'
import type { PaperGeometry } from '../../../../shared/domain/paper'
import PrinterSettings from '../../dialogs/PrinterSettings'
import PrintersInstallDialog from '../../dialogs/PrintersInstallDialog'
import DataPanel from '../../dialogs/DataPanel'
import ExportModal from '../../dialogs/ExportModal'
import LicenseDialog from '../../dialogs/LicenseDialog'
import CloudDialog from '../../dialogs/CloudDialog'
import OptionsDialog, { type AppOptions } from '../../dialogs/OptionsDialog'
import AboutDialog from '../../dialogs/AboutDialog'
import HelpDialog from '../../dialogs/HelpDialog'
import ObjectPropsDialog from '../../dialogs/ObjectPropsDialog'
import ChangeDataDialog from '../../dialogs/ChangeDataDialog'
import GetStartedDialog from '../../dialogs/GetStartedDialog'
import FeedbackDialog from '../../dialogs/FeedbackDialog'
import TemplatePropsDialog from '../../dialogs/TemplatePropsDialog'
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
  importWarnings: string[]
  dbRecordCount: number
  dbCols: string[]
  dbRows: string[][]
  tabs: DocTab[]
  active: string
  startKey: string
  onNew: (width: number, height: number, paper?: PaperGeometry, printerName?: string) => void
  onPrinterSave: (printer: PrinterConfig) => void
  onPrinterInstall: (driver: 'tspl' | 'zpl' | 'cpcl', dpi: 203 | 300 | 600, portType: string) => void
  onPrinterRemove: () => void
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
  printTitle: string
  printPrinterLabel: string
  printCount: number
  setPrintCount: (value: number) => void
  printCopies: number
  setPrintCopies: (value: number) => void
  printStartLabel: number
  setPrintStartLabel: (value: number) => void
  printAdvanced: PrintAdvancedOptions
  setPrintAdvanced: (patch: Partial<PrintAdvancedOptions>) => void
  onPrint: () => void
  onSetActive: (key: string) => void
  onRefreshLibrary: () => void
}

export default function ModalHost(props: ModalHostProps) {
  const close = () => props.setModal(null)
  return (
    <>
      {props.modal === 'new' && <NewLabelDialog defaultW={props.options.defaultLabelW} defaultH={props.options.defaultLabelH} defaultShape={props.options.labelShape} onSelect={props.onNew} onClose={close} />}
      {props.modal === 'printer' && <PrinterSettings printer={props.printer} onClose={close} onSave={props.onPrinterSave} />}
      {props.modal === 'data' && props.activeDoc && <DataPanel datasets={props.activeDoc.datasets ?? {}} connections={props.activeDoc.connections ?? {}} onClose={close} onImport={props.onDataImport} onImportReplace={props.onImportReplace} onDelete={props.onDataDelete} onConnectionSave={props.onConnectionSave} onConnectionDelete={props.onConnectionDelete} onRenameField={props.onRenameField} />}
      {props.modal === 'export' && props.activeDoc && <ExportModal doc={props.activeDoc} onClose={close} />}
      {props.modal === 'cloud' && props.activeDoc && <CloudDialog doc={props.activeDoc} serverUrl={props.serverUrl} onClose={close} onLoad={props.onCloudLoad} />}
      {props.modal === 'license' && <LicenseDialog onClose={close} />}
      {props.modal === 'tpllib' && props.activeDoc && <TemplateLibDialog onClose={() => { close(); props.onRefreshLibrary() }} onOpen={props.onOpenLib} docName={props.activeDoc.name} docJson={JSON.stringify(props.activeDoc)} onOpenJson={props.onOpenJson} onSaveCurrent={props.onSaveCurrent} onMsg={props.onMsg} />}
      {props.modal === 'options' && <OptionsDialog options={props.options} onSave={props.onOptionsSave} onClose={close} />}
      {props.modal === 'props' && props.activeDoc && props.selectedObj && <ObjectPropsDialog obj={props.selectedObj} datasets={props.activeDoc.datasets ?? {}} onPatch={props.onUpdateObject} onClose={close} initialTab={props.propsTab} colorIndexTable={props.activeDoc.colorIndexTable} onPatchDoc={props.onPatchDoc} labelWidthMm={props.activeDoc.widthMm} labelHeightMm={props.activeDoc.heightMm} />}
      {props.modal === 'changedata' && props.selectedObj && <ChangeDataDialog obj={props.selectedObj} onPatch={props.onUpdateObject} onClose={close} />}
      {props.modal === 'feedback' && <FeedbackDialog onClose={close} />}
      {props.modal === 'importwarn' && <ImportWarningDialog warnings={props.importWarnings} onClose={close} />}
      {props.modal === 'getstarted' && <GetStartedDialog onClose={close} onNew={() => props.setModal('new')} onPrinter={() => props.setModal('printer')} onEdit={() => { const first = props.tabs.find((tab) => tab.key !== props.startKey); props.onSetActive(first ? first.key : props.active) }} onPreview={props.onPreview} />}
      {props.modal === 'tplprops' && props.activeDoc && <TemplatePropsDialog doc={props.activeDoc} onPatch={props.onPatchDoc} onClose={close} onPrinterSettings={() => props.setModal('printer')} />}
      {props.modal === 'history' && <PrintHistoryDialog onClose={close} />}
      {props.modal === 'print' && props.activeDoc && <PrintDialog title={props.printTitle} printerLabel={props.printPrinterLabel} count={props.printCount} setCount={props.setPrintCount} copies={props.printCopies} setCopies={props.setPrintCopies} startLabel={props.printStartLabel} setStartLabel={props.setPrintStartLabel} advanced={props.printAdvanced} setAdvanced={props.setPrintAdvanced} onClose={close} onPrint={props.onPrint} />}
      {props.modal === 'keyorder' && props.activeDoc && <KeyInputOrderDialog doc={props.activeDoc} onSave={props.onKeyOrderSave} onClose={close} />}
      {props.modal === 'locate' && <LocateRecordDialog total={props.dbRecordCount} dsCols={props.dbCols} dsRows={props.dbRows} onLocate={props.onLocate} onClose={close} />}
      {props.modal === 'weigh' && <WeighDialog onClose={close} />}
      {props.modal === 'printers' && <PrintersInstallDialog printer={props.printer} onInstall={props.onPrinterInstall} onRemove={props.onPrinterRemove} onClose={close} />}
      {props.modal === 'update' && <UpdateDialog onClose={close} />}
      {props.modal === 'about' && <AboutDialog onClose={close} />}
      {props.modal === 'help' && <HelpDialog onClose={close} />}
    </>
  )
}
