import { buildCommands } from '../src/shared/print/engine'
import { defaultPrinterConfig, type LabelDoc } from '../src/shared/model'

const printer = { ...defaultPrinterConfig(), driver: 'tspl' as const, dpi: 203 }
const doc: LabelDoc = {
  version: 0.1,
  name: 't',
  widthMm: 40,
  heightMm: 30,
  layout: { rows: 2, cols: 3, rowGapMm: 0, colGapMm: 0, shape: 'rect', printOrder: 'row' },
  objects: [{ id: 'o1', type: 'text', x: 2, y: 2, w: 30, h: 6, rotation: 0, fontSize: 4, fontFamily: 'Arial', text: 'NO.123', color: '#000000', bold: false, italic: false, underline: false, source: { type: 'constant', text: 'NO.123' } }]
}
const job = { count: 2, copy: 1, title: 't', datasets: {}, layout: { rows: 2, cols: 3 } }
const res = buildCommands(doc, printer, job as never)
const clses = (res.text.match(/CLS/g) || []).length
const sizes = (res.text.match(/SIZE/g) || []).length
console.log('CLS count (labels) =', clses, 'expected 12 (count2 × grid6)')
console.log('SIZE count =', sizes, 'expected 12')
console.log('labelCount =', res.labelCount, 'expected 12')
if (clses === 12 && sizes === 12 && res.labelCount === 12) console.log('PASS')
else { console.log('FAIL'); process.exit(1) }
