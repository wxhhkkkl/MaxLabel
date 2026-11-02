import { describe, expect, it } from 'vitest'
import { defaultPrinterConfig, type PrinterConfig } from '@shared/domain/printer'
import { pruneUnavailablePrinter } from '@/features/shell/templatePrinter'
import { sampleDoc } from '../../helpers/factories'

const fallback: PrinterConfig = {
  ...defaultPrinterConfig(),
  printerName: '本机默认打印机',
  port: { type: 'driver', encoding: 'utf8' }
}

function template(printerName?: string, port: PrinterConfig['port'] = { type: 'driver', encoding: 'utf8' }) {
  return {
    ...sampleDoc(),
    printer: { ...defaultPrinterConfig(), ...(printerName ? { printerName } : {}), port }
  }
}

describe('打开模板时清理本机不存在的打印机', () => {
  it('内置驱动打印机已安装：保留原配置（大小写不敏感）', () => {
    const doc = template('TSC TX600')
    const next = pruneUnavailablePrinter(doc, {
      builtInNames: ['tsc tx600'],
      systemPrinters: [],
      defaultPrinter: fallback
    })
    expect(next).toBe(doc)
  })

  it('系统打印机存在（队列名或显示名匹配）：保留原配置', () => {
    const byName = template('HP7E6C81')
    expect(pruneUnavailablePrinter(byName, {
      builtInNames: [],
      systemPrinters: [{ name: 'hp7e6c81', displayName: 'HP LaserJet Pro M329' }],
      defaultPrinter: fallback
    })).toBe(byName)

    const byDisplay = template('HP LaserJet Pro M329')
    expect(pruneUnavailablePrinter(byDisplay, {
      builtInNames: [],
      systemPrinters: [{ name: 'HP7E6C81', displayName: 'HP LaserJet Pro M329' }],
      defaultPrinter: fallback
    })).toBe(byDisplay)
  })

  it('本机找不到原打印机：整份打印机配置换成当前默认打印机', () => {
    const doc = template('客户电脑上的 TSC TX600')
    const next = pruneUnavailablePrinter(doc, {
      builtInNames: ['Gprinter GPL-N (203 dpi)'],
      systemPrinters: [{ name: 'Microsoft Print to PDF' }],
      defaultPrinter: fallback
    })
    expect(next).not.toBe(doc)
    expect(next.printer).toEqual(fallback)
    // 文档其他内容不变
    expect(next.widthMm).toBe(doc.widthMm)
    expect(next.objects).toBe(doc.objects)
  })

  it('打印机枚举为空或失败：按本机没有处理', () => {
    const doc = template('TSC TX600')
    expect(pruneUnavailablePrinter(doc, { builtInNames: [], systemPrinters: [], defaultPrinter: fallback }).printer).toEqual(fallback)
  })

  it('没有绑定打印机名的直连端口配置原样保留', () => {
    const direct = template(undefined, { type: 'tcp', encoding: 'utf8', tcpHost: '192.168.1.50', tcpPort: 9100 })
    const next = pruneUnavailablePrinter(direct, { builtInNames: [], systemPrinters: [], defaultPrinter: fallback })
    expect(next).toBe(direct)
  })

  it('没有打印机配置时原样返回', () => {
    const doc = { ...sampleDoc(), printer: undefined }
    const next = pruneUnavailablePrinter(doc, { builtInNames: [], systemPrinters: [], defaultPrinter: fallback })
    expect(next).toBe(doc)
  })
})
