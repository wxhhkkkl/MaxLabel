// @vitest-environment jsdom
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it, vi } from 'vitest'
import { importLsdx } from '@/io/lsdxImport'
import { xSizeMilOptionLabel } from '@/dialogs/barcodeSizeFields'
import { normalizeDocument } from '@shared/domain'
import { barcodeHumanTextBlockMm } from '@shared/domain/objects'

// jsdom does not decode Image data URLs; the embedded-image decode path is
// exercised in the real Chromium E2E render harness.
vi.mock('@/print/imageValidation', async (importOriginal) => {
  const original = await importOriginal<typeof import('@/print/imageValidation')>()
  return { ...original, validateImageDataUrl: vi.fn(async () => undefined) }
})

const fixture = readFileSync(resolve(__dirname, '../../fixtures/lsdx/minimal.lsdx'), 'utf8')

describe('原版 .lsdx import', () => {
  it('preserves label dimensions and basic object types', async () => {
    const imported = await importLsdx(fixture, 'minimal.lsdx')
    expect(imported.doc.widthMm).toBe(80)
    expect(imported.doc.heightMm).toBe(60)
    expect(imported.doc.objects).toHaveLength(6)
    expect(imported.doc.objects.some((object) => object.type === 'group')).toBe(true)
    expect(imported.doc.objects.some((object) => object.type === 'table' && object.rows === 2 && object.cols === 3)).toBe(true)
    expect(imported.doc.objects.some((object) => object.type === 'rfid' && object.bank === 'EPC')).toBe(true)
    const picture = imported.doc.objects.find((object) => object.type === 'image')
    expect(picture).toMatchObject({ type: 'image', imgType: 'embed' })
    expect(picture?.type === 'image' ? picture.src : '').toMatch(/^data:image\/png;base64,/)
    // wide=5 / radio=2 → 宽窄比 2.5；按 1/100 读成 0.05 会让整份文档校验失败。
    const barcode = imported.doc.objects.find((object) => object.type === 'barcode')
    expect(barcode?.type === 'barcode' ? barcode.barcodeOptions?.w2n : undefined).toBe(2.5)
    expect(() => normalizeDocument(imported.doc)).not.toThrow()
  })

  it('imports rounded paper and a centre hole', async () => {
    const rounded = await importLsdx(
      fixture.replace('<labelobjects>', '<form corner="1" hole="1" holesize="1500"/><labelobjects>'),
      'rounded.lsdx'
    )
    expect(rounded.doc.layout?.shape).toBe('roundRect')
    expect(rounded.doc.layout?.innerDiameterMm).toBe(15)
  })

  it('keeps the database binding (dataset + field) instead of flattening to the saved value', async () => {
    const saved = Buffer.from('多头康乃馨-珍珠粉', 'utf8').toString('base64')
    const fieldNames = '<database><Connection name="Database3"><fields><field id="1" name="ID"/><field id="2" name="name"/></fields></Connection></database>'
    const xml = `<labelshopdocument><labelform>
      <label width="4000" height="3000" rows="1" cols="1" rowgap="0" colgap="0"/>
      <variables><variable type="database" id="1" data="${saved}" databasefield="2|name|Database3|3|0|0"/></variables>
      <labelobjects><drawobj type="drawtext" id="2" left="0" top="0" right="3550" bottom="500">
        <font facename="Arial" height="1200" style="1"/><text type="1" align="0"></text>
      </drawobj></labelobjects>
      <objvarlink link=":2,1"/>
    </labelform>${fieldNames}</labelshopdocument>`
    const imported = await importLsdx(xml, 'db.lsdx')
    const text = imported.doc.objects[0] as { source?: { kind: string; dataset?: string; field?: string; sampleValue?: string }; fontSize?: number; fontFamily?: string }
    // 文件里的 data 只是「保存时那一行的值」，不是数据集；数据集和字段名必须留着，
    // 用户再引入原数据库时只要选数据集就能自动对上字段（而不是变成固定文本）。
    // 保存值退成 sampleValue：数据集没引入前版面照常显示它。
    expect(text.source).toEqual({ kind: 'database', dataset: 'Database3', field: 'name', sampleValue: '多头康乃馨-珍珠粉' })
    // font height=1200 是 12.00 磅，不是 12mm。
    expect(text.fontSize).toBeCloseTo((1200 / 100) * 25.4 / 72, 3)
    // GDI 字体链接：拉丁字体 + 中文逐字回退到宋体。
    expect(text.fontFamily).toBe('Arial, 宋体')
    // style 的 bit0 是粗体，对所有字体生效。
    expect((text as { bold?: boolean }).bold).toBe(true)
    expect(imported.warnings.some((warning) => warning.includes('保留字段绑定'))).toBe(true)
  })

  // 现场 .lsdx「99年冰岛宫廷600克」的正文用 CR、LF、CRLF、CRCRLF 四种写法混着表示同一个
  // 换行（原版 RichEdit 文本框都按一个换行显示）。保留原字符会让行数、折行和行距都与原版
  // 不一致（fabric 把行内 CR 当词分隔符，GDI 还会多出空行）。
  it('collapses CR / LF runs in text values into one line break', async () => {
    const saved = Buffer.from('甲\r\n\r乙\r\r\n丙\r丁\r\n', 'utf8').toString('base64')
    const xml = `<labelshopdocument><labelform>
      <label width="4000" height="3000" rows="1" cols="1" rowgap="0" colgap="0"/>
      <variables><variable type="constant" id="1" data="${saved}"/></variables>
      <labelobjects><drawobj type="drawtext" id="2" left="0" top="0" right="3550" bottom="2500">
        <font facename="Arial" height="700"/><text type="0" align="0"></text>
      </drawobj></labelobjects>
      <objvarlink link=":2,1"/>
    </labelform></labelshopdocument>`
    const imported = await importLsdx(xml, 'breaks.lsdx')
    const text = imported.doc.objects[0] as { source?: { kind: string; value?: string } }
    expect(text.source).toEqual({ kind: 'constant', value: '甲\n乙\n丙\n丁' })
  })

  it('falls back to the saved value when the file has no dataset/field binding at all', async () => {
    const saved = Buffer.from('珍珠粉', 'utf8').toString('base64')
    const xml = `<labelshopdocument><labelform>
      <label width="4000" height="3000" rows="1" cols="1" rowgap="0" colgap="0"/>
      <variables><variable type="database" id="1" data="${saved}"/></variables>
      <labelobjects><drawobj type="drawtext" id="2" left="0" top="0" right="3550" bottom="500">
        <font facename="Arial" height="1200" style="1"/><text type="1" align="0"></text>
      </drawobj></labelobjects>
      <objvarlink link=":2,1"/>
    </labelform></labelshopdocument>`
    const imported = await importLsdx(xml, 'db.lsdx')
    const text = imported.doc.objects[0] as { source?: { kind: string; value?: string } }
    expect(text.source).toEqual({ kind: 'constant', value: '珍珠粉' })
    expect(imported.warnings.some((warning) => warning.includes('固定文本'))).toBe(true)
  })

  it('normalizes serial digits; btype 11 is QR and incompatible content keeps the original symbology', async () => {
    const serial = Buffer.from('001', 'utf8').toString('base64')
    const constant = Buffer.from('02-11-26', 'utf8').toString('base64')
    const xml = `<labelshopdocument><labelform>
      <label width="4000" height="3000" rows="1" cols="1" rowgap="0" colgap="0"/>
      <variables>
        <variable type="serial" id="1" data="${serial}" serialstep="1"/>
        <variable type="constant" id="2" data="${constant}"/>
      </variables>
      <labelobjects>
        <drawobj type="drawtext" id="3" left="0" top="0" right="2000" bottom="500">
          <font facename="Arial" height="600"/><text type="1"></text>
        </drawobj>
        <drawobj type="drawbarcode" id="4" left="0" top="1000" right="2000" bottom="2000">
          <barcode btype="11" barwidth="1500"/><text type="1"></text>
        </drawobj>
        <drawobj type="drawbarcode" id="5" left="0" top="2000" right="2000" bottom="3000">
          <barcode btype="3" barwidth="1000"/><text type="1"></text>
        </drawobj>
      </labelobjects>
      <objvarlink link=":3,1:4,2:5,2"/>
    </labelform></labelshopdocument>`
    const imported = await importLsdx(xml, 'serial.lsdx')
    // 序列号起始值来自 data（"001"），位数为 3；digits=0 会被文档校验拒绝。
    const serialObject = imported.doc.objects.find((object) => object.type === 'text') as { source?: { kind?: string; start?: number; digits?: number; repeat?: number; repeatBasis?: string; resetEachRecord?: boolean } }
    expect(serialObject.source).toMatchObject({ kind: 'serial', start: 1, digits: 3, repeat: 1, repeatBasis: 'record' })
    expect(serialObject.source?.resetEachRecord).toBeUndefined()
    expect(() => normalizeDocument(imported.doc)).not.toThrow()
    const barcodes = imported.doc.objects.filter((object) => object.type === 'barcode') as Array<{ symbology?: string; barcodeOptions?: { xSizeMm?: number; xSizeMil?: number } }>
    // btype=11 是二维码（用户样例确认），日期内容可直接编码。
    expect(barcodes[0].symbology).toBe('qrcode')
    // barwidth 是「1/100 密耳」：1500 → 15.00 mil（真机 X 尺寸下拉的档位）= 0.381mm。
    expect(barcodes[0].barcodeOptions?.xSizeMil).toBe(15)
    expect(barcodes[0].barcodeOptions?.xSizeMm).toBeCloseTo(0.381, 3)
    // btype=3（EAN-13）遇到日期内容：保留原码制并告警（不再退回 Code128）。
    expect(barcodes[1].symbology).toBe('ean13')
    expect(imported.warnings.some((warning) => warning.includes('已保留原码制'))).toBe(true)
  })

  it('maps the original serial repeat / basis / reset attributes', async () => {
    const serial = Buffer.from('001', 'utf8').toString('base64')
    const xml = `<labelshopdocument><labelform>
      <label width="4000" height="3000" rows="1" cols="1" rowgap="0" colgap="0"/>
      <variables>
        <variable type="serial" id="1" data="${serial}" serialstep="1" serialrepeat="3" serealreptype="1" serealreset="1"/>
      </variables>
      <labelobjects>
        <drawobj type="drawtext" id="2" left="0" top="0" right="2000" bottom="500">
          <font facename="Arial" height="600"/><text type="1"></text>
        </drawobj>
      </labelobjects>
      <objvarlink link=":2,1"/>
    </labelform></labelshopdocument>`
    const imported = await importLsdx(xml, 'serial-repeat.lsdx')
    const text = imported.doc.objects[0] as { source?: Record<string, unknown> }
    expect(text.source).toMatchObject({
      kind: 'serial',
      repeat: 3,
      repeatBasis: 'label',
      resetEachRecord: true
    })
    expect(() => normalizeDocument(imported.doc)).not.toThrow()
  })

  it('imports paper/page geometry, rotation, printer binding, global script and per-variable length limits', async () => {
    const scriptJs = Buffer.from('function OnGetData(){ return "ABC"; }', 'utf8').toString('base64')
    const globalScript = Buffer.from('Function OnBeginPrint(State)\nEnd Function', 'utf8').toString('base64')
    const xml = `<labelshopdocument><labelform>
      <paper name="pl" code="0"/>
      <paper width="8200" height="3000" color="255,255,255" leftoffect="0" topoffect="0"/>
      <label width="3900" height="3000" rows="1" cols="2" rowgap="200" colgap="200" rotation="90"/>
      <form corner="1" hole="0" holesize="0"/>
      <variables>
        <variable type="script" id="1" data="${Buffer.from('ABC', 'utf8').toString('base64')}" scriptjs="${scriptJs}">
          <limit filled="left" fillchar="0" maxlength="12" cutout="right"/>
        </variable>
      </variables>
      <labelobjects>
        <drawobj type="drawtext" id="2" left="0" top="0" right="2000" bottom="500">
          <text type="1" align="2"></text><font facename="Arial" height="1000"/>
        </drawobj>
      </labelobjects>
      <objvarlink link=":2,1"/>
      <printer name="TSC TX600" dev="TSC TX600" dpix="600" dpiy="600" script="${globalScript}"/>
    </labelform></labelshopdocument>`
    const imported = await importLsdx(xml, 'page.lsdx')
    expect(imported.doc.layout).toMatchObject({
      rows: 1,
      cols: 2,
      rowGapMm: 2,
      colGapMm: 2,
      shape: 'roundRect',
      pageWidthMm: 82,
      pageHeightMm: 30,
      labelColor: '#ffffff'
    })
    expect(imported.doc.orientation).toBe(270)
    expect(imported.doc.printer).toMatchObject({
      printerName: 'TSC TX600',
      model: 'TSC TX600',
      dpi: 600,
      driver: 'tspl',
      port: { type: 'driver' }
    })
    expect(imported.doc.globalScript).toContain('OnBeginPrint')
    const text = imported.doc.objects[0] as { textType?: string; source?: Record<string, unknown>; lengthLimit?: Record<string, unknown> }
    // type="1" 是单行（多行是 type="0"，见上面的专门用例）
    expect(text.textType).toBeUndefined()
    expect(text.source).toMatchObject({ kind: 'script', language: 'javascript' })
    expect(text.source?.code).toContain('OnGetData')
    expect(text.lengthLimit).toEqual({ mode: 'max', max: 12, trimDir: 'right' })
  })

  it('maps text type 0 to multi-line and type 1 to single-line (real LabelShop files)', async () => {
    const text = (id: string, type: number) => `<drawobj type="drawtext" id="${id}" left="0" top="0" right="3000" bottom="500">
      <font facename="Arial" height="1000"/><text type="${type}" width="0" align="0" str="ABCD"></text>
    </drawobj>`
    const xml = `<labelshopdocument><labelform>
      <label width="4000" height="3000" rows="1" cols="1" rowgap="0" colgap="0"/>
      <labelobjects>${text('1', 0)}${text('2', 1)}</labelobjects>
    </labelform></labelshopdocument>`
    const imported = await importLsdx(xml, 'types.lsdx')
    const [multi, single] = imported.doc.objects as Array<{ textType?: string }>
    // 现场 .lsdx：需要折行的「商品名称」存 type=0，分类/等级/数量等短文本存 type=1
    expect(multi.textType).toBe('multi')
    expect(single.textType).toBeUndefined()
  })

  it('maps bold per font and hides human-readable text for 2D codes', async () => {
    const text = (id: string, face: string, value: string, style = 1) => `<drawobj type="drawtext" id="${id}" left="0" top="0" right="3000" bottom="500">
      <font facename="${face}" height="1000" style="${style}"/><text type="1" align="0" str="${value}"></text>
    </drawobj>`
    const xml = `<labelshopdocument><labelform>
      <label width="4000" height="3000" rows="1" cols="1" rowgap="0" colgap="0"/>
      <labelobjects>
        ${text('1', '微软雅黑', '玫瑰')}
        ${text('2', '宋体', '中文')}
        ${text('3', 'Arial', 'B')}
        <drawobj type="drawbarcode" id="4" left="0" top="2000" right="1000" bottom="3000">
          <barcode btype="11" barwidth="1500" readable="3"/><text type="1"></text>
        </drawobj>
      </labelobjects>
    </labelform></labelshopdocument>`
    const imported = await importLsdx(xml, 'bold.lsdx')
    const [rose, simsun, latin, qr] = imported.doc.objects as Array<{ bold?: boolean; showText?: boolean }>
    expect(rose.bold).toBe(true)
    // 宋体没有真粗体，但 style 的粗体位仍应生效（浏览器合成）。
    expect(simsun.bold).toBe(true)
    expect(latin.bold).toBe(true)
    // 二维码导入默认不显示供人识读文字。
    expect(qr.showText).toBe(false)
  })

  it('maps text align 0/1/2 to left/right/center', async () => {
    const text = (id: string, align: number) => `<drawobj type="drawtext" id="${id}" left="0" top="0" right="1000" bottom="500">
      <font facename="Arial" height="600"/><text type="1" align="${align}"></text>
    </drawobj>`
    const xml = `<labelshopdocument><labelform>
      <label width="4000" height="3000" rows="1" cols="1" rowgap="0" colgap="0"/>
      <labelobjects>${text('1', 0)}${text('2', 1)}${text('3', 2)}</labelobjects>
    </labelform></labelshopdocument>`
    const imported = await importLsdx(xml, 'align.lsdx')
    expect(imported.doc.objects.map((object) => (object as { align?: string }).align)).toEqual(['left', 'right', 'center'])
  })

  it('imports barwidth as 1/100 mil so X 尺寸 lands on the original dropdown step', async () => {
    const xml = (barwidth: number) => `<labelshopdocument><labelform>
      <label width="4000" height="3000" rows="1" cols="1" rowgap="0" colgap="0"/>
      <labelobjects><drawobj type="drawbarcode" id="1" left="0" top="0" right="3000" bottom="1000">
        <barcode btype="2" barwidth="${barwidth}"/><text type="1" str="123456"/>
      </drawobj></labelobjects>
    </labelform></labelshopdocument>`
    // 三个真实样例的取值：833 / 1000 / 1500 都正好落在真机 X 尺寸下拉（1/600 英寸档位）上。
    for (const [raw, mil] of [[833, 8.33], [1000, 10], [1500, 15]] as const) {
      const imported = await importLsdx(xml(raw), 'xsize.lsdx')
      const options = (imported.doc.objects[0] as { barcodeOptions?: { xSizeMil?: number; xSizeMm?: number } }).barcodeOptions
      expect(options?.xSizeMil).toBeCloseTo(mil, 2)
      expect(options?.xSizeMm).toBeCloseTo(mil * 0.0254, 3)
      // 属性页下拉正好选中它，不会再折到别的档位（旧算法 1500 → 6.67 mil）。
      expect(xSizeMilOptionLabel(options?.xSizeMil, false)).toBe(`${mil.toFixed(2)} mil`)
    }
  })

  it('imports barcode 码高 (high) as the symbol height', async () => {
    const xml = (readable: number) => `<labelshopdocument><labelform>
      <label width="3000" height="2000" rows="1" cols="1" rowgap="0" colgap="0"/>
      <labelobjects><drawobj type="drawbarcode" id="1" left="500" top="1250" right="2600" bottom="1890">
        <barcode btype="2" barwidth="667" high="352" readable="${readable}"/>
        <font facename="新宋体" height="800" style="1"/><text type="1" str="2609301555189"/>
      </drawobj></labelobjects>
    </labelform></labelshopdocument>`
    // 原版对象框高 = 码高 + 人读文字；复刻版的对象框是整高，导入时按码高反推，
    // 否则一维码会被压矮（现场：原版 3.52mm，导入后 2.08mm）。
    const withText = await importLsdx(xml(3), 'high.lsdx')
    const bar = withText.doc.objects[0] as { y: number; h: number; showText?: boolean }
    expect(bar.showText).toBe(true)
    expect(bar.h).toBeCloseTo(3.52 + barcodeHumanTextBlockMm({}), 2)
    // 框高按更大的人读文字块算，原框贴底时会把条码推出标签；此时只上移溢出的那一点，
    // 否则整页会被逼成位图（直连打印慢一个数量级）。
    expect(bar.y).toBeCloseTo(20 - bar.h, 2)
    // 原框本来就在标签外（用户故意放的）时不要移动。
    const outsideXml = xml(3).replace('top="1250"', 'top="1600"').replace('bottom="1890"', 'bottom="2400"')
    const outside = await importLsdx(outsideXml, 'high-outside.lsdx')
    expect((outside.doc.objects[0] as { y: number }).y).toBeCloseTo(16, 2)
    // readable=1（真机「位置」下拉的「无」）时没有文字块，对象框就是码高。
    // 注意 readable=0 是「默认」，仍然有供人识读文字（下拉顺序见下面 HRI 用例）。
    const withoutText = await importLsdx(xml(1), 'high-nohri.lsdx')
    expect((withoutText.doc.objects[0] as { h: number }).h).toBeCloseTo(3.52, 2)
    // 二维码的 high 不是码区高度，框尺寸保持不变。
    const qrXml = xml(3).replace('btype="2"', 'btype="11"')
    const qr = await importLsdx(qrXml, 'high-qr.lsdx')
    expect((qr.doc.objects[0] as { h: number }).h).toBeCloseTo(6.4, 2)
  })

  it('imports barcode human-readable font (facename/height/style/width)', async () => {
    const xml = (font: string) => `<labelshopdocument><labelform>
      <label width="3000" height="2000" rows="1" cols="1" rowgap="0" colgap="0"/>
      <labelobjects><drawobj type="drawbarcode" id="1" left="500" top="1250" right="2600" bottom="1890">
        <barcode btype="2" barwidth="667" high="352" readable="3"/>
        ${font}<text type="1" str="2609301555189"/>
      </drawobj></labelobjects>
    </labelform></labelshopdocument>`
    const imported = await importLsdx(xml('<font facename="新宋体" height="1000" style="1" italic="1" underline="1" steikeout="1" width="8482"/>'), 'bfont.lsdx')
    const bar = imported.doc.objects[0] as {
      fontFamily?: string; fontSize?: number; bold?: boolean; italic?: boolean
      underline?: boolean; strikeout?: boolean; fontWidthScale?: number; h: number
    }
    expect(bar.fontFamily).toBe('新宋体')
    // font/height 与文字对象同口径：1/100 磅 → 毫米（1000 = 10.00pt）。
    expect(bar.fontSize).toBeCloseTo((1000 / 100) * 25.4 / 72, 4)
    expect(bar.bold).toBe(true)
    expect(bar.italic).toBe(true)
    expect(bar.underline).toBe(true)
    expect(bar.strikeout).toBe(true)
    expect(bar.fontWidthScale).toBeCloseTo(0.8482, 4)
    // 对象框高度按**导入后的字号**预留人读文字块。
    expect(bar.h).toBeCloseTo(3.52 + barcodeHumanTextBlockMm({ fontSize: (1000 / 100) * 25.4 / 72 }), 2)
    // 没有 font 元素时不写字体字段，交给模型默认值（Arial / 8pt / 常规）。
    const noFont = (await importLsdx(xml(''), 'nofont.lsdx')).doc.objects[0] as { fontFamily?: string; fontSize?: number; bold?: boolean }
    expect(noFont.fontFamily).toBeUndefined()
    expect(noFont.fontSize).toBeUndefined()
    expect(noFont.bold).toBeUndefined()
  })

  it('imports date/time variables as live sources (datatimetype = 原版格式下标)', async () => {
    const saved = (value: string) => Buffer.from(value, 'utf8').toString('base64')
    const xml = `<labelshopdocument><labelform>
      <label width="4000" height="3000" rows="1" cols="1" rowgap="0" colgap="0"/>
      <variables>
        <variable type="date" id="1" data="${saved('02-11-26')}" datatimetype="3" datatimeoffect="259200"/>
        <variable type="date" id="2" data="${saved('26/11/02')}" datatimetype="30" datatimeoffect="259200"/>
        <variable type="date" id="3" data="${saved('20261102')}" datatimetype="9999" datatimeformat="yyyyMMdd" datatimeoffect="0"/>
        <variable type="date" id="4" data="${saved('2026-11-02')}" datatimetype="9999" datatimeoffect="0"/>
      </variables>
      <labelobjects>
        <drawobj type="drawbarcode" id="9" left="0" top="0" right="1000" bottom="1000"><barcode btype="11"/><text type="1"/></drawobj>
        <drawobj type="drawtext" id="10" left="0" top="1000" right="3000" bottom="1500"><font facename="Arial" height="800"/><text type="1"/></drawobj>
        <drawobj type="drawtext" id="11" left="0" top="1500" right="3000" bottom="2000"><font facename="Arial" height="800"/><text type="1"/></drawobj>
        <drawobj type="drawtext" id="12" left="0" top="2000" right="3000" bottom="2500"><font facename="Arial" height="800"/><text type="1"/></drawobj>
      </labelobjects>
      <objvarlink link=":9,1:10,2:11,3:12,4"/>
    </labelform></labelshopdocument>`
    const imported = await importLsdx(xml, 'date.lsdx')
    // 二维码里的日期不再是保存值 02-11-26，而是会随打印日期变化的数据源。
    const [qr] = imported.doc.objects as Array<{ source?: unknown }>
    expect(qr.source).toEqual({ kind: 'date', format: 'dd-MM-yy', offset: 3 })
    expect(imported.doc.objects[1].type === 'text' ? (imported.doc.objects[1] as { source?: unknown }).source : null).toEqual({ kind: 'date', format: 'yy/MM/dd', offset: 3 })
    // datatimeformat 是自定义格式时直接用它
    expect((imported.doc.objects[2] as { source?: unknown }).source).toEqual({ kind: 'date', format: 'yyyyMMdd', offset: 0 })
    // 下标超出已知表：退回默认格式并告警，而不是变成固定文本
    expect((imported.doc.objects[3] as { source?: unknown }).source).toEqual({ kind: 'date', format: 'yyyy-MM-dd', offset: 0 })
    expect(imported.warnings.some((warning) => warning.includes('格式编号 9999'))).toBe(true)
    // 时刻表同样可还原（type="time"，下标进 TIME_FORMATS）
    const timeXml = xml.replace('type="date" id="1"', 'type="time" id="1"')
      .replace('datatimetype="3" datatimeoffect="259200"', 'datatimetype="0" datatimeoffect="120"')
    const withTime = await importLsdx(timeXml, 'time.lsdx')
    expect((withTime.doc.objects[0] as { source?: unknown }).source).toEqual({ kind: 'time', format: 'HH:mm:ss', region: 'default', offset: 2 })
  })

  it('imports 字体宽度方向缩放倍数 from font/width (8482 = 0.85)', async () => {
    const xml = (width: string) => `<labelshopdocument><labelform>
      <label width="4000" height="3000" rows="1" cols="1" rowgap="0" colgap="0"/>
      <labelobjects><drawobj type="drawtext" id="2" left="0" top="0" right="3550" bottom="500">
        <font facename="宋体" height="1300" style="1" width="${width}"/><text type="1" align="2"></text>
      </drawobj></labelobjects>
    </labelform></labelshopdocument>`
    // font/width 是「字体宽度方向缩放倍数」×10000：真机界面 0.85 存的是 8482。
    const narrowed = await importLsdx(xml('8482'), 'narrow.lsdx')
    expect((narrowed.doc.objects[0] as { fontWidthScale?: number }).fontWidthScale).toBeCloseTo(0.8482, 4)
    // 10000 = 1.00；0 与缺省都是「未缩放」，不写进模型，保持既有导入结果不变。
    const whole = await importLsdx(xml('10000'), 'whole.lsdx')
    expect((whole.doc.objects[0] as { fontWidthScale?: number }).fontWidthScale).toBeUndefined()
    const unset = await importLsdx(xml('0'), 'unset.lsdx')
    expect((unset.doc.objects[0] as { fontWidthScale?: number }).fontWidthScale).toBeUndefined()
  })

  it('maps page 左空/上空 to the label grid origin and paper offsets to fine adjustment', async () => {
    // 真机标签格式：<page left/top> = 标签阵列在纸张中的起点（左空/上空），
    // <paper leftoffect/topoffect> = 打印位置微调。旧实现把两者混用了。
    const xml = `<labelshopdocument><labelform>
      <label width="5000" height="2800" rows="4" cols="2" rowgap="150" colgap="200"/>
      <paper width="21000" height="29700" leftoffect="30" topoffect="40"/>
      <page left="200" top="175" right="400" bottom="550"/>
      <labelobjects><drawobj type="drawtext" id="2" left="0" top="0" right="3500" bottom="500">
        <font facename="宋体" height="400" style="1"/><text type="1" align="2"></text>
      </drawobj></labelobjects>
    </labelform></labelshopdocument>`
    const imported = await importLsdx(xml, 'page.lsdx')
    expect(imported.doc.layout).toMatchObject({
      rows: 4,
      cols: 2,
      pageWidthMm: 210,
      pageHeightMm: 297,
      pageLeftMm: 2,
      pageTopMm: 1.75,
      offsetXMm: 0.3,
      offsetYMm: 0.4
    })
  })

  it('imports 方框/圆形 (rect type) and 对象名称标识 (drawobj name)', async () => {
    // 现场 test123.lsdx：圆形对象存成 <drawrect type="drawrect"><rect type="ellipse"/>，
    // 旧实现一律按矩形导入；真机「方框和圆形属性」的形状下拉正是矩形/圆角矩形/椭圆。
    const xml = `<labelshopdocument><labelform>
      <label width="4000" height="3000" rows="1" cols="1" rowgap="0" colgap="0"/>
      <labelobjects>
        <drawobj type="drawrect" id="1" name="圆形边框" left="0" top="0" right="1000" bottom="1000">
          <rect type="ellipse" linewidth="30" linecolor="0,0,0"/>
        </drawobj>
        <drawobj type="drawrect" id="2" left="1000" top="0" right="2000" bottom="1000">
          <rect type="rect" linewidth="30" linecolor="0,0,0"/>
        </drawobj>
      </labelobjects>
    </labelform></labelshopdocument>`
    const imported = await importLsdx(xml, 'shape.lsdx')
    const [ellipse, rect] = imported.doc.objects as Array<{ shape?: string; name?: string }>
    expect(ellipse.shape).toBe('ellipse')
    expect(rect.shape).toBeUndefined()
    // 真机「常规」页的对象名称标识
    expect(ellipse.name).toBe('圆形边框')
    expect(() => normalizeDocument(imported.doc)).not.toThrow()
  })

  it('maps 供人识读字符 position/alignment/offset from readable/ralign/ready', async () => {
    // 证据：parity 分支 probe-46-barcode-page-combos.txt combo[18]/[19]。
    // 位置：0=默认、1=无、2=条码上方、3=条码下方；对齐：0=左齐、1=右齐、2=居中、3=撑满。
    // 现场 .lsdx 两个默认值都存 readable="3"、ralign="2"，与下拉默认项一致。
    const bar = (id: string, readable: number, ralign: number, ready = 0) => `<drawobj type="drawbarcode" id="${id}" left="0" top="0" right="3000" bottom="1000">
      <barcode btype="2" barwidth="1000" readable="${readable}" ralign="${ralign}" ready="${ready}"/><text type="1" str="123456"/>
    </drawobj>`
    const xml = `<labelshopdocument><labelform>
      <label width="4000" height="4000" rows="1" cols="1" rowgap="0" colgap="0"/>
      <labelobjects>${bar('1', 0, 0)}${bar('2', 1, 1)}${bar('3', 2, 2, 250)}${bar('4', 3, 3)}</labelobjects>
    </labelform></labelshopdocument>`
    const imported = await importLsdx(xml, 'hri.lsdx')
    const bars = imported.doc.objects as Array<{
      showText?: boolean
      barcodeOptions?: { humanPosition?: string; humanAlign?: string; humanOffsetMm?: number }
    }>
    // 默认（0）要显示文字；旧实现按 readable!==0 判断，把默认当成“无”、把“无”当成有，正好反了。
    expect(bars[0].showText).toBe(true)
    expect(bars[0].barcodeOptions).toMatchObject({ humanPosition: 'default', humanAlign: 'left' })
    expect(bars[1].showText).toBe(false)
    expect(bars[1].barcodeOptions).toMatchObject({ humanPosition: 'none', humanAlign: 'right' })
    // ready 是垂直偏移（1/100mm）
    expect(bars[2].barcodeOptions).toMatchObject({ humanPosition: 'above', humanAlign: 'center', humanOffsetMm: 2.5 })
    expect(bars[3].barcodeOptions).toMatchObject({ humanPosition: 'below', humanAlign: 'justify' })
    expect(() => normalizeDocument(imported.doc)).not.toThrow()
  })

  it('imports 缩减量 (reduction) and per-symbology special options', async () => {
    const bar = (id: string, btype: number, str: string, inner: string, reduction = 0) => `<drawobj type="drawbarcode" id="${id}" left="0" top="0" right="3000" bottom="1000">
      <barcode btype="${btype}" barwidth="1000" high="800" readable="1" reduction="${reduction}"/>${inner}<text type="1" str="${str}"/>
    </drawobj>`
    const xml = `<labelshopdocument><labelform>
      <label width="4000" height="9000" rows="1" cols="1" rowgap="0" colgap="0"/>
      <labelobjects>
        ${bar('1', 3, '123456789012', '<baroption eanaddon="1"/>', 25)}
        ${bar('2', 11, '12345678', '<baroption2 qrecc="3" qrver="7" codepage="65001"/>')}
        ${bar('3', 2, 'ABC123', '<baroption c128codeset="2" c128ean="1"/>')}
        ${bar('4', 1, 'ABC123', '<baroption check="2"/>')}
        ${bar('5', 9, '1234', '<baroption check="1" codabarechar="1" codabarschar="4"/>')}
        ${bar('6', 23, '12345678901234', '<baroption itf14check="1" itf14bar="2" itf14barwidth="5" itf14barspace="10"/>')}
      </labelobjects>
    </labelform></labelshopdocument>`
    const imported = await importLsdx(xml, 'options.lsdx')
    const [ean, qr, code128, code39, codabar, itf14] = imported.doc.objects as Array<{
      reductionMm?: number
      barcodeOptions?: Record<string, unknown>
    }>
    // 缩减量在 barcode 元素上，单位 1/100mm
    expect(ean.reductionMm).toBe(0.25)
    // EAN 附加码：无 / 2 位 / 5 位
    expect(ean.barcodeOptions?.eanAddon).toBe('2')
    // QR 纠错级别下拉 L/M/Q/H，符号版本 0=自动、1…40；codepage=65001 = UTF-8
    expect(qr.barcodeOptions).toMatchObject({ eclevel: 'H', qrVersion: '7', encoding: 'utf8' })
    // Code128 字符集：0 自动 / 1 A / 2 B / 3 C；GS1/EAN-128
    expect(code128.barcodeOptions).toMatchObject({ charset: 'b', gs1: true })
    // Code39 校验：无 / 模10 / 模43 / 图书馆
    expect(code39.barcodeOptions?.code39Check).toBe('mod43')
    // Codabar 校验 + 起始/终止符（0=自动，1…4=a…d）
    expect(codabar.barcodeOptions).toMatchObject({ codabarCheck: 'mod10', codabarStart: 'a', codabarStop: 'd' })
    // ITF14：保护框 0 无 / 1 方框 / 2 保护条；粗细、空白区是与 X 尺寸的比值
    expect(itf14.barcodeOptions).toMatchObject({
      itf14Check: true,
      itf14BearerMode: 'bar',
      itf14BearerRatio: 5,
      itf14QuietRatio: 10
    })
    expect(() => normalizeDocument(imported.doc)).not.toThrow()
  })

  it('imports 撑满对齐, 字符模板, 序列号允许字符集 and object names', async () => {
    const serial = Buffer.from('001', 'utf8').toString('base64')
    const xml = `<labelshopdocument><labelform>
      <label width="4000" height="3000" rows="1" cols="1" rowgap="0" colgap="0"/>
      <variables><variable type="serial" id="1" data="${serial}" serealchars="0123456789"/></variables>
      <labelobjects>
        <drawobj type="drawtext" id="2" name="编号" left="0" top="0" right="3000" bottom="500">
          <font facename="Arial" height="1000"/><text type="1" align="3" template="1" templtestr="??-??"></text>
        </drawobj>
      </labelobjects>
      <objvarlink link=":2,1"/>
    </labelform></labelshopdocument>`
    const imported = await importLsdx(xml, 'text.lsdx')
    const text = imported.doc.objects[0] as {
      align?: string; charTemplate?: string; name?: string
      source?: { kind?: string; charset?: string }
    }
    // 真机「水平对齐」四项：左/右/居中/撑满；旧实现把 3 落到左对齐
    expect(text.align).toBe('justify')
    expect(text.charTemplate).toBe('??-??')
    expect(text.name).toBe('编号')
    // 序列号「允许字符集」决定进位时能出现哪些字符
    expect(text.source).toMatchObject({ kind: 'serial', charset: '0123456789' })
    expect(() => normalizeDocument(imported.doc)).not.toThrow()
  })

  it('imports 圆形文字 (text type=2) with the real LabelShop circle parameters', async () => {
    // 证据：真机 LabelShop 6.39 新建圆形文字，界面设 半径 12.5mm / 角度 45 / 弧度 180 /
    // 回绕方向 逆时针 / 文字方向 向内 / 字间距 1.5mm，另存为 .lsdx 后实测：
    //   type="2" circr="1250" circstart="45" circradian="180" circway="1" circtw="1" charextra="150"
    const xml = `<labelshopdocument><labelform>
      <label width="4000" height="3000" rows="1" cols="1" rowgap="0" colgap="0"/>
      <labelobjects><drawobj type="drawtext" id="1" left="0" top="0" right="3000" bottom="1000">
        <font facename="Arial" height="1000"/>
        <text type="2" align="0" charextra="150" circr="1250" circradian="180" circstart="45" circtw="1" circway="1"/>
      </drawobj></labelobjects>
    </labelform></labelshopdocument>`
    const imported = await importLsdx(xml, 'circle.lsdx')
    const text = imported.doc.objects[0] as {
      textType?: string; arc?: boolean; charSpacing?: number
      arcRadius?: number; arcAngle?: number; arcExtent?: number
      arcDir?: string; arcTextDir?: string
    }
    expect(text.textType).toBe('circle')
    expect(text.arc).toBe(true)
    // 圆半径/字间距是 1/100mm；角度/弧度本身就是度
    expect(text.arcRadius).toBe(12.5)
    expect(text.charSpacing).toBe(1.5)
    expect(text.arcAngle).toBe(45)
    expect(text.arcExtent).toBe(180)
    // 0=顺时针 / 1=逆时针；0=向外 / 1=向内
    expect(text.arcDir).toBe('ccw')
    expect(text.arcTextDir).toBe('in')
    expect(() => normalizeDocument(imported.doc)).not.toThrow()
  })

  it('imports 多行垂直对齐, 行距模式 and 文字停靠', async () => {
    // 证据：真机 多行页面 垂直对齐=中间 / 行距=自定义 2.00mm；单行+撑满+文字停靠=右侧。
    // 实测属性：drawobj tvalign="1" tpalign="3"；text align="3" spactype="3" spacing="200"。
    const text = (id: string, type: number, align: number, spactype: number, spacing: number, extra: number, tva: number, tpa: number) =>
      `<drawobj type="drawtext" id="${id}" left="0" top="0" right="3000" bottom="1000" tvalign="${tva}" tpalign="${tpa}">
        <font facename="Arial" height="1000"/>
        <text type="${type}" align="${align}" spactype="${spactype}" spacing="${spacing}" charextra="${extra}"/>
      </drawobj>`
    const xml = `<labelshopdocument><labelform>
      <label width="4000" height="3000" rows="1" cols="1" rowgap="0" colgap="0"/>
      <labelobjects>
        ${text('1', 0, 3, 3, 200, 0, 1, 0)}
        ${text('2', 0, 0, 1, 0, 0, 2, 0)}
        ${text('3', 1, 3, 0, 0, 0, 0, 3)}
      </labelobjects>
    </labelform></labelshopdocument>`
    const imported = await importLsdx(xml, 'multiline.lsdx')
    const [custom, half, docked] = imported.doc.objects as Array<{
      align?: string; verticalAlign?: string; lineSpacing?: number; lineSpacingMm?: number; textDock?: string
    }>
    expect(custom.align).toBe('justify')
    expect(custom.verticalAlign).toBe('middle')
    // spactype=3 是「自定义」，spacing 直接给毫米（1/100mm）
    expect(custom.lineSpacingMm).toBe(2)
    // spactype=1 是「一倍半行距」→ 行高倍数 1.5
    expect(half.lineSpacing).toBe(1.5)
    // 文字停靠：0 两端 / 1 左侧 / 2 中间 / 3 右侧
    expect(docked.textDock).toBe('right')
    expect(() => normalizeDocument(imported.doc)).not.toThrow()
  })

  it('imports 字符模板 text (template=1 + templtestr) as charTemplate', async () => {
    const xml = `<labelshopdocument><labelform>
      <label width="4000" height="3000" rows="1" cols="1" rowgap="0" colgap="0"/>
      <labelobjects><drawobj type="drawtext" id="1" left="0" top="0" right="3000" bottom="1000">
        <font facename="Arial" height="1000"/>
        <text type="1" align="0" template="1" templtestr="AB??CD"/>
      </drawobj></labelobjects>
    </labelform></labelshopdocument>`
    const imported = await importLsdx(xml, 'template.lsdx')
    expect((imported.doc.objects[0] as { charTemplate?: string }).charTemplate).toBe('AB??CD')
  })

  it('把 .lsdx 的旋转显示框反算成未旋转框（竖排文字不再横跨标签）', async () => {
    const xml = `<labelshopdocument version="1.5"><labelform>
      <label width="7600" height="13000" rows="1" cols="1" rowgap="0" colgap="0"/>
      <labelobjects><drawobj type="drawtext" id="1" left="1000" top="2000" right="2900" bottom="13400" rotation="left">
        <text type="1" align="0"/><font facename="Arial" height="1000"/>
      </drawobj></labelobjects>
    </labelform></labelshopdocument>`
    const imported = await importLsdx(xml, 'rotated.lsdx')
    const text = imported.doc.objects[0] as { x: number; y: number; w: number; h: number; rotation: number }
    expect(text).toMatchObject({ x: -37.5, y: 67.5, w: 114, h: 19, rotation: 90 })
  })

  it('条码的旋转显示框同样反算成未旋转框', async () => {
    const xml = `<labelshopdocument version="1.5"><labelform>
      <label width="7600" height="13000" rows="1" cols="1" rowgap="0" colgap="0"/>
      <labelobjects><drawobj type="drawbarcode" id="1" left="0" top="0" right="1000" bottom="4000" rotation="left">
        <barcode btype="2" barwidth="1000" high="0" readable="1"/><text type="1" str="ABC"/>
      </drawobj></labelobjects>
    </labelform></labelshopdocument>`
    const imported = await importLsdx(xml, 'rotated-barcode.lsdx')
    expect(imported.doc.objects[0]).toMatchObject({ x: -15, y: 15, w: 40, h: 10, rotation: 90 })
  })

  it('imports rotation strings and 常规页 style bits', async () => {
    // 证据：真机 LabelShop 6.39「常规」页逐项设置后另存（case-general.lsdx）：
    //   旋转 0/90/180/270（LabelShop 逆时针角度）→ rotation="none"/"right"/"invert"/"left"；
    //   编辑器/Fabric/打印机指令是顺时针，因此导入后换算成 360 - angle。
    //   位置锁定 → style|1、不打印输出 → style|4、水平镜像 → style|16、
    //   垂直镜像 → style|32、背景不透明 → style|256（默认透明，不带位）
    const obj = (id: string, rotation: string, style: number) => `<drawobj type="drawtext" id="${id}" left="0" top="0" right="1000" bottom="500" rotation="${rotation}" style="${style}">
      <font facename="Arial" height="1000"/><text type="1"/>
    </drawobj>`
    const xml = `<labelshopdocument><labelform>
      <label width="4000" height="3000" rows="1" cols="1" rowgap="0" colgap="0"/>
      <labelobjects>
        ${obj('1', 'none', 0)}
        ${obj('2', 'right', 0)}
        ${obj('3', 'invert', 0)}
        ${obj('4', 'left', 0)}
        ${obj('5', 'none', 277)}
        ${obj('6', '1', 0)}
        ${obj('7', '2', 0)}
        ${obj('8', '3', 0)}
      </labelobjects>
    </labelform></labelshopdocument>`
    const imported = await importLsdx(xml, 'general.lsdx')
    const [none, right, invert, left, flags, idx1, idx2, idx3] = imported.doc.objects as Array<{
      rotation?: number; locked?: boolean; suppressPrint?: boolean
      flipX?: boolean; flipY?: boolean; backgroundTransparent?: boolean
    }>
    expect([none.rotation, right.rotation, invert.rotation, left.rotation]).toEqual([0, 270, 180, 90])
    // 老版本 v1.5 存下标 0/1/2/3
    expect([idx1.rotation, idx2.rotation, idx3.rotation]).toEqual([270, 180, 90])
    // 277 = 256+16+4+1：背景不透明、水平镜像、不打印、位置锁定
    expect(flags).toMatchObject({ locked: true, suppressPrint: true, flipX: true })
    expect(flags.flipY).toBeUndefined()
    // 背景不透明时模型不写 backgroundTransparent；默认（不带 256）是透明
    expect(flags.backgroundTransparent).toBeUndefined()
    expect(none.backgroundTransparent).toBe(true)
    expect(() => normalizeDocument(imported.doc)).not.toThrow()
  })

  it('imports 图片类型/缩放方式/长宽比/对齐/无效图片 (真机图片页枚举)', async () => {
    // 证据：真机「图片」页下拉（case-general.lsdx 中新图片实测）：
    //   类型 0嵌入/1链接/2数据源/3目录文件；缩放 0原始/1比例/2适合边框/3保持边框；
    //   对齐 0中心 1左上 2上中 3右上 4右中 5右下 6下中 7左下 8左中；
    //   无效图片 0终止打印/1询问/2打印标记/3全部忽略。
    // 保存为：type="1" scale="2" keep="1" dbalign="5" onerr="2" mono="1"。
    const readImage = vi.fn(async () => ({ ok: false, message: 'missing' }))
    ;(globalThis as unknown as { window: { maxlabel: unknown } }).window.maxlabel = { readImage }
    const xml = `<labelshopdocument><labelform>
      <label width="4000" height="3000" rows="1" cols="1" rowgap="0" colgap="0"/>
      <labelobjects><drawobj type="drawpicture" id="1" left="0" top="0" right="1000" bottom="1000">
        <picture type="1" scale="2" keep="1" dbalign="5" onerr="2" mono="1" file="pics/a.png"></picture>
      </drawobj></labelobjects>
    </labelform></labelshopdocument>`
    const imported = await importLsdx(xml, 'image.lsdx', { sourcePath: 'C:/tpl/t.lsdx' })
    const image = imported.doc.objects[0] as {
      type: string; imgType?: string; linkPath?: string; imageFit?: string
      keepAspect?: boolean; imageAlign?: string; missingImage?: string
    }
    // 链接式图片保留链接（不再强转为内嵌），文件缺失时由「无效图片」策略兜底
    expect(image.type).toBe('image')
    expect(image.imgType).toBe('link')
    expect(image.linkPath).toBe('C:/tpl/pics/a.png')
    expect(image.imageFit).toBe('fit')
    expect(image.keepAspect).toBe(true)
    expect(image.imageAlign).toBe('bottomRight')
    expect(image.missingImage).toBe('placeholder')
    expect(imported.warnings.some((warning) => warning.includes('保留链接'))).toBe(true)
    expect(() => normalizeDocument(imported.doc)).not.toThrow()
  })

  it('imports 圆角矩形/填充色 (rect type=roundrect, roundness, fill=solid)', async () => {
    // 证据：真机「图形」页 形状=圆角矩形、圆角半径 2mm、填充方框内部、反白，另存后实测：
    //   <rect type="roundrect" roundness="200,200" fill="solid" fillcolor="255,255,255"/> style=512
    const xml = `<labelshopdocument><labelform>
      <label width="4000" height="3000" rows="1" cols="1" rowgap="0" colgap="0"/>
      <labelobjects><drawobj type="drawrect" id="1" left="0" top="0" right="1000" bottom="500" style="512">
        <rect type="roundrect" roundness="200,200" linewidth="30" linecolor="0,0,0" fill="solid" fillcolor="12,34,56"/>
      </drawobj></labelobjects>
    </labelform></labelshopdocument>`
    const imported = await importLsdx(xml, 'rect.lsdx')
    const rect = imported.doc.objects[0] as { shape?: string; cornerRadius?: number; fill?: string; fillEnabled?: boolean }
    expect(rect.shape).toBe('roundRect')
    // roundness 是 1/100mm
    expect(rect.cornerRadius).toBe(2)
    expect(rect.fill).toBe('#0c2238')
    expect(rect.fillEnabled).toBe(true)
    expect(() => normalizeDocument(imported.doc)).not.toThrow()
  })

  it('imports 条宽比 from barcode wide (真机 2.00 → wide=200)', async () => {
    // 证据：真机 Code39 条宽比下拉 2.00/2.50/3.00，另存为 radio="300" + wide="200"/"250"/"300"。
    // 比例 = wide/100；旧实现用 wide/radio（得 0.67）且默认 3.00 时直接丢弃。
    const bar = (id: string, wide: number) => `<drawobj type="drawbarcode" id="${id}" left="0" top="0" right="3000" bottom="1000">
      <barcode btype="1" barwidth="1000" radio="300" wide="${wide}" readable="1"/><text type="1" str="ABC123"/>
    </drawobj>`
    const xml = `<labelshopdocument><labelform>
      <label width="4000" height="3000" rows="1" cols="1" rowgap="0" colgap="0"/>
      <labelobjects>${bar('1', 200)}${bar('2', 300)}</labelobjects>
    </labelform></labelshopdocument>`
    const imported = await importLsdx(xml, 'ratio.lsdx')
    const [two, three] = imported.doc.objects as Array<{ barcodeOptions?: { w2n?: number } }>
    expect(two.barcodeOptions?.w2n).toBe(2)
    expect(three.barcodeOptions?.w2n).toBe(3)
  })

  it('imports 黑底白字 from font style bit2 (style=5 = 粗体+反白)', async () => {
    // 证据：模板库 55 个「黑底白字版」模板里，反白单元格的 font/style="5"
    // （bit0=粗体、bit2=黑底白字），缩略图显示白字黑底；underline/italic 均为 0。
    const xml = `<labelshopdocument><labelform>
      <label width="4000" height="3000" rows="1" cols="1" rowgap="0" colgap="0"/>
      <labelobjects>
        <drawobj type="drawtext" id="1" left="0" top="0" right="3000" bottom="500">
          <font facename="Arial" height="1600" style="5"/><text type="1" str="-10( -10 )"/>
        </drawobj>
        <drawobj type="drawbarcode" id="2" left="0" top="1000" right="3000" bottom="2000">
          <barcode btype="2" readable="3"/><font facename="Arial" height="800" style="5"/><text type="1" str="123456"/>
        </drawobj>
      </labelobjects>
    </labelform></labelshopdocument>`
    const imported = await importLsdx(xml, 'reverse.lsdx')
    const [text, barcode] = imported.doc.objects as Array<{ bold?: boolean; reverse?: boolean }>
    expect(text.bold).toBe(true)
    expect(text.reverse).toBe(true)
    expect(barcode.bold).toBe(true)
    expect(barcode.reverse).toBe(true)
    expect(() => normalizeDocument(imported.doc)).not.toThrow()
  })

  it('maps 真机码制编号 (4-8, 19 China Post, 20 Data Matrix, 23 ITF14)', async () => {
    // 证据：本机 LabelShop 6.39 打开真实模板逐个读「条码符号类型(码制)」：
    //   4=Interleaved 25、5=Code 93、6=UPC-A、7=EAN-8、8=UPC-E、
    //   19=China Post、20=Data Matrix、23=ITF 14。
    const bar = (id: string, btype: number, text: string) => `<drawobj type="drawbarcode" id="${id}" left="0" top="0" right="3000" bottom="1000">
      <barcode btype="${btype}" barwidth="1000" readable="1"/><text type="1" str="${text}"/>
    </drawobj>`
    const xml = `<labelshopdocument><labelform>
      <label width="4000" height="12000" rows="1" cols="1" rowgap="0" colgap="0"/>
      <labelobjects>
        ${bar('1', 4, '09114413250035')}
        ${bar('2', 5, '12345678')}
        ${bar('3', 6, '889162079341')}
        ${bar('4', 7, '69069505')}
        ${bar('5', 8, '232485')}
        ${bar('6', 19, '6734757856715')}
        ${bar('7', 20, '1234567890')}
        ${bar('8', 23, '10889245152302')}
      </labelobjects>
    </labelform></labelshopdocument>`
    const imported = await importLsdx(xml, 'btypes.lsdx')
    const syms = (imported.doc.objects as Array<{ symbology?: string }>).map((o) => o.symbology)
    expect(syms).toEqual(['interleaved2of5', 'code93', 'upca', 'ean8', 'upce', 'datalogic2of5', 'datamatrix', 'itf14'])
    expect(() => normalizeDocument(imported.doc)).not.toThrow()
  })

  it('imports 数据源图片 (picture type=2) keeping directory and data binding', async () => {
    // 证据：模板库 5 个数据源图片（picture type="2"），file 是图片路径/目录，
    // 图片文件名来自绑定的变量（database/constant）。
    const saved = Buffer.from('校验.jpg', 'utf8').toString('base64')
    const xml = `<labelshopdocument><labelform>
      <label width="4000" height="3000" rows="1" cols="1" rowgap="0" colgap="0"/>
      <variables><variable type="database" id="3" data="${saved}" databasefield="1|图片|Database1|1|0|0"/></variables>
      <labelobjects><drawobj type="drawpicture" id="4" left="0" top="0" right="1000" bottom="1000">
        <picture type="2" scale="2" keep="1" dbalign="0" onerr="3" file="C:/imgs/logo.png"/>
      </drawobj></labelobjects>
      <objvarlink link=":4,3"/>
    </labelform></labelshopdocument>`
    const imported = await importLsdx(xml, 'datasource-image.lsdx')
    const image = imported.doc.objects[0] as {
      type: string; imgType?: string; linkPath?: string; imageFit?: string
      source?: { kind?: string; dataset?: string; field?: string; sampleValue?: string }
    }
    // 不再丢弃：保留对象框、目录与数据源绑定，打印前由用户确认目录/数据集
    expect(image.type).toBe('image')
    expect(image.imgType).toBe('datasource')
    expect(image.linkPath).toBe('C:/imgs')
    expect(image.imageFit).toBe('fit')
    expect(image.source).toMatchObject({ kind: 'database', dataset: 'Database1', field: '图片', sampleValue: '校验.jpg' })
    expect(imported.warnings.some((warning) => warning.includes('数据源图片'))).toBe(true)
    expect(() => normalizeDocument(imported.doc)).not.toThrow()
  })

  it('imports 13 位序列号 and 卷筒哨兵 rows=255', async () => {
    // 现场 F SZ.lsdx：序列号起始值 6734757856715（13 位），旧模型上限 1e12 会判无效；
    // 明治雪吻500g.lsdx：卷筒标签 rows=255（表示不限），旧实现会判「拼版行列无效」。
    const serial = Buffer.from('6734757856715', 'utf8').toString('base64')
    const xml = `<labelshopdocument><labelform>
      <label width="10000" height="4000" rows="255" cols="1" rowgap="300" colgap="300"/>
      <variables><variable type="serial" id="1" data="${serial}" serialstep="1"/></variables>
      <labelobjects><drawobj type="drawtext" id="2" left="0" top="0" right="3000" bottom="500">
        <font facename="Arial" height="2200"/><text type="1"/>
      </drawobj></labelobjects>
      <objvarlink link=":2,1"/>
    </labelform></labelshopdocument>`
    const imported = await importLsdx(xml, 'roll.lsdx')
    expect(imported.doc.layout?.rows).toBe(1)
    expect((imported.doc.objects[0] as { source?: { start?: number } }).source?.start).toBe(6734757856715)
    expect(imported.warnings.some((warning) => warning.includes('卷筒'))).toBe(true)
    expect(() => normalizeDocument(imported.doc)).not.toThrow()
  })

  it('imports 超出安全整数范围的序列号 as fixed text with a warning', async () => {
    // 现场 20 位序列号（青岛啤酒类模板：40002006117030101022）超出 JS 安全整数，
    // 模型无法无损保存；按固定文本导入，保证整份模板能打开。
    const saved = Buffer.from('40002006117030101022', 'utf8').toString('base64')
    const xml = `<labelshopdocument><labelform>
      <label width="4000" height="3000" rows="1" cols="1" rowgap="0" colgap="0"/>
      <variables><variable type="serial" id="1" data="${saved}" serialstep="1"/></variables>
      <labelobjects><drawobj type="drawbarcode" id="2" left="0" top="0" right="3000" bottom="1000">
        <barcode btype="2" readable="1"/><text type="1"/>
      </drawobj></labelobjects>
      <objvarlink link=":2,1"/>
    </labelform></labelshopdocument>`
    const imported = await importLsdx(xml, 'big-serial.lsdx')
    expect((imported.doc.objects[0] as { source?: unknown }).source).toEqual({ kind: 'constant', value: '40002006117030101022' })
    expect(imported.warnings.some((warning) => warning.includes('安全整数'))).toBe(true)
    expect(() => normalizeDocument(imported.doc)).not.toThrow()
  })

  it('keeps EAN-13 and auto-corrects a wrong check digit', async () => {
    // 模板库里存在校验位与内容不符的常量 EAN-13（如 1001165001001）。
    // 按用户确认的口径：保留原码制，按前 12 位重算末位。
    const xml = `<labelshopdocument><labelform>
      <label width="4000" height="3000" rows="1" cols="1" rowgap="0" colgap="0"/>
      <labelobjects><drawobj type="drawbarcode" id="1" left="0" top="0" right="3000" bottom="1000">
        <barcode btype="3" barwidth="1000" readable="1"/><text type="1" str="7350068240460"/>
      </drawobj></labelobjects>
    </labelform></labelshopdocument>`
    const imported = await importLsdx(xml, 'ean-fix.lsdx')
    const bar = imported.doc.objects[0] as { symbology?: string; source?: { kind?: string; value?: string } }
    expect(bar.symbology).toBe('ean13')
    // 735006824046 的正确校验位是 1，原内容末位 0 被修正
    expect(bar.source).toEqual({ kind: 'constant', value: '7350068240461' })
    expect(imported.warnings.some((warning) => warning.includes('校验位已按内容修正'))).toBe(true)
    expect(() => normalizeDocument(imported.doc)).not.toThrow()
  })

  it('maps 打印机内建字体名单 (verified / 同族 / 不支持)', async () => {
    // 名单来源：LabelShop.exe 内置的 UTF-16 字库目录。
    // verified：GP/Tsc Font N → TSPL FontN，Zebra Font X → ZPL，Zebra Scalable → 0；
    // 同族：ZJ/XP/BY/RTA/JQTEK/Argox/Postek Font N → TSPL，EZ Font A–I → ZPL，
    //       TEC Font A–F/K → TPCL，均提示确认目标指令族；
    // 不支持：SATO/Datamax/Intermec/Printronix/HPRT 等私有指令集、未校准的 TEC G–J/L–R
    //       或 OCR/无编号字库。
    const text = (id: string, face: string) => `<drawobj type="drawtext" id="${id}" left="0" top="0" right="3000" bottom="500">
      <font facename="${face}" height="1000"/><text type="1" str="ABC"/>
    </drawobj>`
    const xml = `<labelshopdocument><labelform>
      <label width="4000" height="3000" rows="1" cols="1" rowgap="0" colgap="0"/>
      <labelobjects>
        ${text('1', 'GP Font 3')}
        ${text('2', 'Tsc Font 5')}
        ${text('3', 'Zebra Font A')}
        ${text('4', 'HPRT 16')}
        ${text('5', 'ZJ Font 2')}
        ${text('6', 'Zebra Scalable')}
        ${text('7', 'Zebra Font 3')}
        ${text('8', 'SATO Font U')}
        ${text('9', 'ROMAN.TTF')}
        ${text('10', 'GP TSS24')}
        ${text('11', 'XPrinter Font 3')}
        ${text('12', 'TEC Font A')}
        ${text('13', 'TEC Font G')}
        ${text('14', 'EZ Font C')}
        ${text('15', 'TEC OCR-A')}
        ${text('16', 'Printronix OCR-A')}
        ${text('17', 'Printronix OCR-B')}
      </labelobjects>
    </labelform></labelshopdocument>`
    const imported = await importLsdx(xml, 'printer-font.lsdx')
    const [gp, tsc, zebra, hprt, zj, scalable, zebra3, sato, roman, gpTss, xprinter, tecA, tecG, ezC, tecOcr, pglA, pglB] =
      imported.doc.objects as Array<{ printerFont?: string }>
    expect(gp.printerFont).toBe('Font3')
    expect(tsc.printerFont).toBe('Font5')
    expect(zebra.printerFont).toBe('A')
    expect(scalable.printerFont).toBe('0')
    expect(zebra3.printerFont).toBe('3')
    // 同族按 TSPL 推断，并提示确认机型（现场模板用的是 XPrinter 写法）
    expect(zj.printerFont).toBe('Font2')
    expect(xprinter.printerFont).toBe('Font3')
    expect(imported.warnings.some((warning) => warning.includes('同族字库'))).toBe(true)
    // 私有指令集 / 无编号字库：保留普通字体名并告警
    expect(hprt.printerFont).toBeUndefined()
    // SATO Font U 与 SBPL 字库命令字母一致
    expect(sato.printerFont).toBe('U')
    expect(imported.warnings.some((warning) => warning.includes('SATO Font U') && warning.includes('SATO'))).toBe(true)
    expect(gpTss.printerFont).toBeUndefined()
    // TEC 是 TPCL 厂商：A–F/K 与 TPCL 字库编号一致；G 未校准，OCR 无编号。
    expect(tecA.printerFont).toBe('A')
    expect(imported.warnings.some((warning) => warning.includes('TEC Font A') && warning.includes('TPCL'))).toBe(true)
    expect(tecG.printerFont).toBeUndefined()
    expect(imported.warnings.some((warning) => warning.includes('TEC Font G'))).toBe(true)
    expect(tecOcr.printerFont).toBeUndefined()
    // EZPL 是 ZPL 同族：EZ Font C → ZPL C
    expect(ezC.printerFont).toBe('C')
    expect(imported.warnings.some((warning) => warning.includes('EZ Font C') && warning.includes('ZPL'))).toBe(true)
    // PGL 的 OCR 字库：Printronix OCR-A/B → ALPHA C10A/C10B
    expect(pglA.printerFont).toBe('OA')
    expect(pglB.printerFont).toBe('OB')
    expect(imported.warnings.some((warning) => warning.includes('Printronix OCR-A') && warning.includes('PGL'))).toBe(true)
    expect(imported.warnings.some((warning) => warning.includes('HPRT 16'))).toBe(true)
    expect(imported.warnings.some((warning) => warning.includes('SATO'))).toBe(true)
    // 可下载软字体/TrueType 文件名不是 ROM 字库，按普通字体处理
    expect(roman.printerFont).toBeUndefined()
    expect(() => normalizeDocument(imported.doc)).not.toThrow()
  })

  it('maps 原版机型名 to engines and warns for unsupported command sets', async () => {
    const xml = (printer: string) => `<labelshopdocument><labelform>
      <paper width="8000" height="3000"/>
      <label width="4000" height="3000" rows="1" cols="1" rowgap="0" colgap="0"/>
      <labelobjects><drawobj type="drawtext" id="1" left="0" top="0" right="1000" bottom="500">
        <font facename="Arial" height="800"/><text type="1" str="A"/>
      </drawobj></labelobjects>
      <printer name="${printer}" dpix="203" dpiy="203"/>
    </labelform></labelshopdocument>`
    const cases: Array<[string, string, boolean]> = [
      ['Zebra ZPL-N (203 dpi)', 'zpl', false],
      ['Zebra EZPL-N (203 dpi)', 'zpl', false],
      ['Gprinter GPLZ-N (203 dpi)', 'zpl', false],
      ['Argox PPLA-N (203 dpi)', 'tspl', false],
      ['SNBC BPLA-U (203 dpi)', 'tspl', false],
      ['Zebra EPL-N (203 dpi)', 'epl', false],
      ['Argox PPLB-N (203 dpi)', 'epl', false],
      ['SATO CLNX-N (203 dpi)', 'sato', false],
      ['Printronix PGL-N (203 dpi)', 'pgl', false],
      ['TOSHIBA-TEC TPCL-N (203 dpi)', 'tpcl', false],
      ['Gprinter ESCPOS-N (200 dpi)', 'escpos', false],
      ['Zebra CPCL-N (203 dpi)', 'cpcl', false],
      ['Zebra ZT220 (203 dpi)', 'zpl', false],
      // 只有品牌、没有指令集型号的现场 Windows 驱动名：Zenpert 是 TSC 的 TSPL 系。
      ['Zenpert 4T530', 'tspl', false]
    ]
    for (const [name, driver, warned] of cases) {
      const imported = await importLsdx(xml(name), 'printer.lsdx')
      expect(imported.doc.printer?.driver, name).toBe(driver)
      expect(imported.warnings.some((warning) => warning.includes('暂未支持')), name).toBe(warned)
    }
  })

  it('rejects malformed XML and non-原版 roots', async () => {
    await expect(importLsdx('<not-labelshop/>', 'bad.lsdx')).rejects.toThrow(/labelshopdocument/)
    await expect(importLsdx('<labelshopdocument><broken>', 'bad.lsdx')).rejects.toThrow(/XML 解析失败/)
  })
})
