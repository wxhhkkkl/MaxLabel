import type { Language } from '../../../shared/i18n/types'
import type { HelpKey } from '../../../shared/i18n/help'

const images = import.meta.glob<string>('../assets/help/*.png', {
  eager: true,
  import: 'default',
  query: '?url'
})

const captions: Record<Language, Partial<Record<HelpKey, readonly string[]>>> = {
  'zh-CN': {
    start: ['填写标签宽度', '填写标签高度', '平张纸核对列数'],
    object: ['打开条码属性页', '选择码制', '调整码高'],
    db: ['确认首行是列名', '检查预览数据', '确认导入'],
    source: ['选择数据库字段', '选择数据集', '选择要显示的字段'],
    installprinter: ['选择 TCP/IP 端口类型', '填写打印机 IP 地址', '填写设备端口号'],
    print: ['打印 2 个条目', '每个条目打 2 份', '先测试打印'],
    cloud: ['选择文件分类', '点击加号上传', '刷新文件列表'],
    export: ['选择保存目录', '选择图片格式', '检查条码预览']
  },
  'en-US': {
    start: ['Enter label width', 'Enter label height', 'Check columns for sheet stock'],
    object: ['Open the Barcode tab', 'Choose a symbology', 'Set the barcode height'],
    db: ['Check the header row', 'Review the data preview', 'Confirm the import'],
    source: ['Choose Database Field', 'Select a dataset', 'Select the field to display'],
    installprinter: ['Choose the TCP/IP port type', 'Enter the printer IP address', 'Enter the device port number'],
    print: ['Print 2 entries', 'Make 2 copies of each', 'Run a test print first'],
    cloud: ['Pick a file category', 'Use the plus tile to upload', 'Refresh the file list'],
    export: ['Choose the destination folder', 'Choose an image format', 'Check the barcode preview']
  }
}

export default function HelpFigure({ topic, language }: { topic: HelpKey; language: Language }) {
  const steps = captions[language][topic]
  const image = images[`../assets/help/${language}-${topic}.png`]
  if (!steps || !image) return null

  return (
    <figure className="help-figure">
      <img src={image} alt="" />
      <figcaption>
        <ol>
          {steps.map((step, index) => (
            <li key={step}><span aria-hidden="true">{index + 1}</span>{step}</li>
          ))}
        </ol>
      </figcaption>
    </figure>
  )
}
