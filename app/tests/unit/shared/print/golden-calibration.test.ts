import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import type { LabelDoc } from '@shared/domain/document'
import type { CommandSet } from '@shared/domain/printer'
import { buildCommands } from '@shared/print/engine'
import { dataCtx, printerConfig, sampleDoc } from '../../../helpers/factories'

/**
 * LabelShop「打印到文件」导出的真机指令（app/fixtures/print/golden/*.prn）。
 * 模板等价于：63×20mm，Code128 数据 12345678，对象位于 (3.75mm, 2.25mm)，
 * 条宽 0.25mm / 宽窄比 3，柱高 10mm，不印人读文字。
 */
function goldenDoc(): LabelDoc {
  return sampleDoc({
    widthMm: 63,
    heightMm: 20,
    objects: [
      {
        id: 'b',
        type: 'barcode',
        x: 3.75,
        y: 2.25,
        w: 40,
        h: 10,
        rotation: 0,
        symbology: 'code128',
        showText: false,
        barcodeOptions: { xSizeMm: 0.25, w2n: 3 },
        source: { kind: 'constant', value: '12345678' }
      }
    ]
  })
}

function commands(driver: CommandSet, doc: LabelDoc = goldenDoc()): string {
  return buildCommands(doc, printerConfig({ driver, dpi: 203, port: { type: 'file', encoding: 'utf8' } }), dataCtx()).text
}

function golden(name: string): string {
  return readFileSync(resolve(__dirname, '../../../../fixtures/print/golden', name), 'utf8').replace(/\r\n/g, '\n')
}

describe('LabelShop golden 校准', () => {
  it('TSPL：Code128 用 128M，偶数纯数字用 !105 Start C', () => {
    const expected = golden('tsc-tspl-n.prn')
    expect(expected).toContain('BARCODE 30,18,"128M",80,0,0,2,6,"!10512345678"')
    expect(commands('tspl')).toContain('BARCODE 30,18,"128M",80,0,0,2,6,"!10512345678"')
  })

  it('ZPL：^BY 只带窄条宽与比例，偶数纯数字用 >; Start C', () => {
    const expected = golden('zebra-zpl-n.prn')
    expect(expected).toContain('^FO30,18^BY2,3.0^BCN,80,N')
    expect(expected).toContain('^FD>;12345678^FS')
    const text = commands('zpl')
    expect(text).toContain('^FO30,18^BY2,3.0')
    expect(text).toContain('^FD>;12345678^FS')
  })

  it('EPL：B 命令字段一致，x 按 EPL 原点左移 8 dot', () => {
    const expected = golden('zebra-epl-n.prn')
    expect(expected).toContain('B22,18,0,1,2,6,80,N,"12345678"')
    expect(commands('epl')).toContain('B22,18,0,1,2,6,80,N,"12345678"')
  })

  it('CPCL：使用短命令 B，字段顺序与 golden 一致', () => {
    const expected = golden('zebra-cpcl-n.prn')
    expect(expected).toContain('B 128 1 1 80 30 18 12345678')
    // 条宽/宽窄比按对象设置换算（golden 记录的 1 1 是该模板的驱动默认值）。
    expect(commands('cpcl')).toContain('B 128 2 3 80 30 18 12345678')
  })

  it('TPCL：备用定界符 {…|}、XB 类型 A、内联数据并用 >5 Start C', () => {
    const expected = golden('toshiba-tec-tpcl-n.prn')
    expect(expected).toContain('{C|}')
    expect(expected).toContain('{XB00;0037,0022,A,1,02,0,0100,+0000000000,000,0,00=>512345678|}')
    const text = commands('tpcl')
    expect(text).toContain('{C|}')
    expect(text).toContain('{XB00;0037,0022,A,1,02,0,0100,+0000000000,000,0,00=>512345678|}')
  })

  it('SATO：STX/ETX 帧、A1 标签尺寸、BG 原生 Code128（Start C）', () => {
    const expected = golden('sato-clnx-n.prn')
    expect(expected.startsWith('\x02\x1bA')).toBe(true)
    expect(expected).toContain('\x1bA1V0160H0504')
    expect(expected).toContain('\x1bBG02080>I12345678')
    const text = commands('sato')
    expect(text.startsWith('\x02\x1bA')).toBe(true)
    expect(text).toContain('\x1bA1V0160H0504')
    expect(text).toContain('\x1bBG02080>I12345678')
  })

  it('SATO 码制：Code39/Codabar 用 BT+BW，Code93 带数据长度，EAN/UPC/ITF 仍位图', () => {
    const expected = golden('sato-barcodes.prn')
    expect(expected).toContain('\x1bBT102060206')
    expect(expected).toContain('\x1bBW01080*ABC-123*')
    expect(expected).toContain('\x1bBC0208007ABC-123')
    expect(expected).toContain('\x1bBT002060206')
    expect(expected).toContain('\x1bBW01080A1234A')
    // LabelShop 对 ITF/EAN/UPC 输出 PCX，而不是原生命令。
    expect((expected.match(/\x1bGP\d{5},/g) ?? []).length).toBe(5)
  })

  it('SATO 字库：L 放大倍数与 WB/WL 参数 1 与真机一致', () => {
    const expected = golden('sato-fonts.prn')
    expect(expected).toContain('\x1bPS\x1bL0303\x1bU')
    expect(expected).toContain('\x1bPS\x1bL0202\x1bXM')
    expect(expected).toContain('\x1bPS\x1bL0101\x1bWB1')
    expect(expected).toContain('\x1bPS\x1bL0101\x1bWL1')
  })

  it('PGL 条码：XRD 比值随窄条点数线性变化', () => {
    const expected = golden('pgl-barcodes.prn')
    expect(expected).toContain('C128B;XRD2:2:4:4:6:6:8:8')
    expect(expected).toContain('C128B;XRD4:4:8:8:12:12:16:16')
    expect(expected).toContain("*\x0e'12345678*")
    const base = sampleDoc()
    const doc = {
      ...base,
      objects: base.objects.map((object) =>
        object.type === 'barcode'
          ? {
              ...object,
              showText: false,
              barcodeOptions: { xSizeMm: 0.5, w2n: 3 },
              source: { kind: 'constant' as const, value: '12345678' }
            }
          : object
      )
    } as typeof base
    expect(commands('pgl', doc)).toContain('C128B;XRD4:4:8:8:12:12:16:16')
  })

  it('PGL 条高：H 是对象框高（英寸），随模板高度线性变化', () => {
    const expected = golden('pgl-barcode2.prn')
    expect(expected).toContain('H3.20;28;90')
    expect(expected).toContain('H7.19;123;123')
    expect(expected).toContain('H5.20;130;402')
    const base = sampleDoc()
    const doc = {
      ...base,
      objects: base.objects.map((object) =>
        object.type === 'barcode'
          ? {
              ...object,
              h: 8.13,
              showText: false,
              barcodeOptions: { xSizeMm: 0.25, w2n: 3 },
              source: { kind: 'constant' as const, value: '12345678' }
            }
          : object
      )
    } as typeof base
    // .lsdx：high=500（5mm）+ 3.13mm 边框余量 = 8.13mm → 8.13/25.4 英寸 = H3.20
    expect(commands('pgl', doc)).toContain('H3.20;')
  })

  it('PGL 文字：Printronix OCR-A/B 走 ALPHA C10A/C10B', () => {
    const expected = golden('pgl-text.prn')
    expect(expected).toContain('ISET;0\nALPHA\nC10A;67;63;0;0;*ABC123*\nSTOP')
    expect(expected).toContain('ISET;0\nALPHA\nC10B;134;65;0;0;*ABC123*\nSTOP')
    expect(expected).toContain('~LOGO;GRAPHIC1;PCX')
  })

  it('PGL：PTX 头、PCX LOGO 与 dot-scale 表单', () => {
    const expected = golden('printronix-pgl-n.prn')
    expect(expected).toContain('!PTX_SETUP')
    expect(expected).toContain('ENGINE-WIDTH;2480:LENGTH;787.')
    expect(expected).toContain('~LOGO;GRAPHIC1;PCX')
    expect(expected).toContain('SCALE;DOT;203;203')
    expect(expected).toContain('C128B;XRD2:2:4:4:6:6:8:8')
    expect(expected).toContain("*\x0e'12345678*")
    const text = commands('pgl')
    expect(text).toContain('!PTX_SETUP')
    expect(text).toContain('ENGINE-WIDTH;2480:LENGTH;787.')
    expect(text).toContain('~CREATE;MAXLBL')
    expect(text).toContain('SCALE;DOT;203;203')
    expect(text).toContain('C128B;XRD2:2:4:4:6:6:8:8')
    expect(text).toContain("*\x0e'12345678*")
    expect(text).toContain('~EXECUTE;MAXLBL')
  })
})
