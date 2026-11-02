// @vitest-environment jsdom
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it, vi } from 'vitest'
import { importLsdx } from '@/io/lsdxImport'
import { xSizeMilOptionLabel } from '@/dialogs/barcodeSizeFields'
import { normalizeDocument } from '@shared/domain'

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

  it('normalizes serial digits; btype 11 is QR and an incompatible type falls back to Code128', async () => {
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
    // btype=3（EAN-13）遇到日期内容无法编码 → Code128 兜底。
    expect(barcodes[1].symbology).toBe('code128')
    expect(imported.warnings.some((warning) => warning.includes('Code128'))).toBe(true)
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
    expect(imported.doc.orientation).toBe(90)
    expect(imported.doc.printer).toMatchObject({
      printerName: 'TSC TX600',
      model: 'TSC TX600',
      dpi: 600,
      driver: 'tspl',
      port: { type: 'driver' }
    })
    expect(imported.doc.globalScript).toContain('OnBeginPrint')
    const text = imported.doc.objects[0] as { textType?: string; source?: Record<string, unknown>; lengthLimit?: Record<string, unknown> }
    expect(text.textType).toBe('multi')
    expect(text.source).toMatchObject({ kind: 'script', language: 'javascript' })
    expect(text.source?.code).toContain('OnGetData')
    expect(text.lengthLimit).toEqual({ mode: 'max', max: 12, trimDir: 'right' })
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

  it('rejects malformed XML and non-原版 roots', async () => {
    await expect(importLsdx('<not-labelshop/>', 'bad.lsdx')).rejects.toThrow(/labelshopdocument/)
    await expect(importLsdx('<labelshopdocument><broken>', 'bad.lsdx')).rejects.toThrow(/XML 解析失败/)
  })
})
