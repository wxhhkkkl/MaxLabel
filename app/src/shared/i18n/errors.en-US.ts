import type { Language } from './types'

/**
 * Source-text lookup catalog for errors thrown by low-level modules without a
 * React/locale context. Approved exception: keys are the Chinese source copy.
 * Dynamic messages are handled by the ordered prefix rules below.
 */
const EXACT: Record<string, string> = {
  '图片尺寸无效': 'Invalid image size',
  '无法读取图片文件': 'Could not read the image file',
  '图片像素尺寸过大（最大 4000 万像素）': 'The image is too large (maximum 40 megapixels)',
  '图片内容无法解码': 'The image could not be decoded',
  '仅支持 PNG/JPG/GIF/WEBP/BMP 图片，且大小不能超过 32 MB': 'Only PNG/JPG/GIF/WEBP/BMP images up to 32 MB are supported',
  '无效的打印分辨率': 'Invalid print resolution',
  '无法创建输出画布': 'Could not create the output canvas',
  '无法创建打印位图上下文': 'Could not create the print bitmap context',
  '条码 SVG 缺少 viewBox': 'The barcode SVG has no viewBox',
  '无法创建条码文字度量上下文': 'Could not create the barcode text measurement context',
  '当前 bwip-js 版本不支持矢量条码': 'This bwip-js version does not support vector barcodes',
  '条码文字图片尺寸超限，请减小字号、字宽、间距或导出分辨率': 'The barcode text image is too large; reduce the font size, width, spacing or export resolution',
  '图片着色失败': 'Image colouring failed',
  '条码着色失败': 'Barcode colouring failed',
  '条码块/渐变着色需要位图回退': 'Block/gradient barcode colouring requires the bitmap fallback',
  '分组子对象渲染失败': 'Group child rendering failed',
  '组合尺寸无效，无法缩放': 'The group size is invalid; cannot resize',
  '旋转子对象无法非等比缩放，请先取消组合或使用等比尺寸': 'A rotated child cannot be scaled non-uniformly; ungroup it or use proportional sizing',
  '模板格式不正确': 'Invalid template format',
  '预览已取消': 'Preview canceled',
  '无法生成导出指令': 'Could not generate the export commands',
  '脚本设置的输出标签数量小于等于 0，未导出': 'The script set the output label count to zero or less; nothing was exported',
  '指令导出已阻止：': 'Command export blocked: ',
  '该文件已在其他标签中打开，请切换到该标签保存或选择其他文件名': 'The file is open in another tab; switch to that tab or choose another file name',
  '保存失败': 'Save failed',
  '保存失败：未返回保存路径': 'Save failed: no save path was returned',
  'LabelShop 内嵌图片压缩数据超过限制': 'The LabelShop embedded image exceeds the size limit',
  'LabelShop 文件 XML 解析失败': 'Failed to parse the LabelShop XML',
  '不是有效的 LabelShop 标签文件（labelshopdocument 根节点缺失）': 'Not a valid LabelShop label file (missing the labelshopdocument root)',
  '标签文件中未找到有效的标签尺寸': 'No valid label size was found in the file',
  'LabelShop 内嵌图片超过大小限制': 'The LabelShop embedded image exceeds the size limit',
  'Excel 文件没有可读取的工作表': 'The Excel file has no readable worksheet',
  'Excel 数据规模超过限制': 'The Excel data exceeds the size limit',
  'CSV 文件包含未闭合的引号': 'The CSV file contains an unclosed quote',
  '数据文件超过 64 MB 限制': 'The data file exceeds the 64 MB limit',
  '导入数据': 'Import Data',
}

const PREFIXES: Array<[RegExp, (match: RegExpMatchArray) => string]> = [
  [/^驱动打印数据超过 (\d+) MB，请减少打印数量或降低分辨率$/, (m) => `Driver print data exceeds ${m[1]} MB; reduce the print count or resolution`],
  [/^指令文件任务过大，请减少打印数量或降低分辨率$/, () => 'The command file job is too large; reduce the print count or resolution'],
  [/^渲染画布过大（(\d+)×(\d+)，最大 ([\d,]+) 像素）$/, (m) => `Rendered canvas too large (${m[1]}×${m[2]}, maximum ${m[3]} pixels)`],
  [/^预览数据超过 (\d+) MB，请缩小预览范围或降低打印分辨率$/, (m) => `Preview data exceeds ${m[1]} MB; reduce the preview range or print resolution`],
  [/^CSV 单元格超过 (\d+) 个字符限制$/, (m) => `A CSV cell exceeds the ${m[1]}-character limit`],
  [/^CSV 字段数量超过 (\d+) 列限制$/, (m) => `The CSV has more than ${m[1]} columns`],
  [/^CSV 数据行数超过 (\d+) 行限制$/, (m) => `The CSV has more than ${m[1]} rows`],
  [/^Excel 数据行数超过 (\d+) 行限制$/, (m) => `The Excel data has more than ${m[1]} rows`],
  [/^Excel 字段数量超过 (\d+) 列限制$/, (m) => `The Excel data has more than ${m[1]} columns`],
  [/^LabelShop 内嵌图片解压后超过 (\d+) MB 限制$/, (m) => `The decompressed LabelShop image exceeds ${m[1]} MB`],
  [/^LabelShop 文件超过 (\d+) MB 限制$/, (m) => `The LabelShop file exceeds ${m[1]} MB`],
  [/^LabelShop 分组嵌套超过 (\d+) 层限制$/, (m) => `LabelShop group nesting exceeds ${m[1]} levels`],
  [/^LabelShop 对象数量超过 (\d+) 个限制$/, (m) => `The LabelShop object count exceeds ${m[1]}`],
  [/^模板文件版本不受支持（最高 v(\d+)）$/, (m) => `Unsupported template version (maximum v${m[1]})`],
  [/^图片没有可用内容：(.*)$/, (m) => `The image has no usable content: ${m[1]}`],
  [/^无法读取图片：(.*)$/, (m) => `Could not read the image: ${m[1]}`],
  [/^图片对象 (.*) 引用的文件不存在或无法读取：(.*)$/, (m) => `Image object ${m[1]} references a file that is missing or unreadable: ${m[2]}`],
  [/^图片对象 (.*) 图像数据解码失败：(.*)$/, (m) => `Image object ${m[1]} could not be decoded: ${m[2]}`],
  [/^图片对象 (.*) 无可用图像数据，请打开后重新插入图片$/, (m) => `Image object ${m[1]} has no usable image data; reopen the template and insert the image again`],
  [/^表格对象 (.*) 已导入基础网格；单元格文本、合并和专用样式请打开后核对$/, (m) => `Table object ${m[1]} was imported as a basic grid; check cell text, merges and styles after opening`],
  [/^RFID 对象 (.*) 已导入基础写入参数，请按目标打印机核对区段和锁定策略$/, (m) => `RFID object ${m[1]} was imported with basic write parameters; check the bank and locking strategy against the printer`],
  [/^未知对象类型「(.*)」$/, (m) => `Unknown object type "${m[1]}"`],
  [/^条码对象 (.*) 码制编号 (.*) 未确认，按 Code128 打开$/, (m) => `Barcode object ${m[1]} has an unrecognised symbology (${m[2]}); opened as Code128`],
  [/^变量 (.*) 的类型（(.*)）暂不支持，已按固定文本处理$/, (m) => `Variable ${m[1]} has an unsupported type (${m[2]}); treated as fixed text`],
  [/^数据库变量 (.*) 未携带数据集名称，导入后请在数据面板重新绑定字段$/, (m) => `Database variable ${m[1]} has no dataset name; rebind its field in the data panel after import`],
  [/^列(\d+)$/, (m) => `Column ${m[1]}`]
]

export function localizeErrorText(language: Language, text: string): string {
  if (language !== 'en-US' || !text) return text
  const exact = EXACT[text]
  if (exact) return exact
  for (const [pattern, render] of PREFIXES) {
    const match = text.match(pattern)
    if (match) return render(match)
  }
  return text
}
