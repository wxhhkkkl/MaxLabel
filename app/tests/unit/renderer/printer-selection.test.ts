import { describe, expect, it } from 'vitest'
import { pickInitialPrinterValue } from '@/features/shell/installedPrinters'

/**
 * 015 现场反馈：卸载掉一台打印机后，新建标签页的「打印机」下拉里仍然多出一行
 * 「已保存打印机：xxx」。偏好里记的名字必须在本机仍然装着时才算数。
 */
describe('「选择标签格式」页的打印机初值', () => {
  const catalog = [{ id: 'tsc-tspl', name: 'TSC TSPL-N (203 dpi)' }]

  it('偏好里的系统打印机已被卸载时不再选它，退回第一台可用打印机', () => {
    expect(pickInitialPrinterValue([], ['Microsoft Print to PDF'], 'Gprinter GPL-N (203 dpi)'))
      .toBe('Microsoft Print to PDF')
  })

  it('偏好里的系统打印机还装着时沿用偏好', () => {
    expect(pickInitialPrinterValue([], ['Microsoft Print to PDF', 'HP7E6C81'], 'HP7E6C81')).toBe('HP7E6C81')
  })

  it('偏好里是已安装的 LabelShop 打印机时返回带前缀的取值', () => {
    expect(pickInitialPrinterValue(catalog, [], 'TSC TSPL-N (203 dpi)')).toBe('ls:tsc-tspl')
  })

  it('没有可用偏好时优先已安装的 LabelShop 打印机', () => {
    expect(pickInitialPrinterValue(catalog, ['Microsoft Print to PDF'], '')).toBe('ls:tsc-tspl')
  })

  it('一台打印机都没有时返回空串', () => {
    expect(pickInitialPrinterValue([], [], '已卸载的打印机')).toBe('')
  })
})
