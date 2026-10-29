import { describe, expect, it } from 'vitest'
import { validateDatasetSourcePath } from '@main/ipc/validation'

const ABS = process.platform === 'win32' ? 'C:\\data\\商品.xlsx' : '/data/商品.xlsx'

describe('数据源文件路径校验', () => {
  it('接受绝对路径下的文本 / Excel 数据文件', () => {
    expect(validateDatasetSourcePath(ABS)).toBe(ABS)
    expect(validateDatasetSourcePath(ABS.replace(/\.xlsx$/, '.csv'))).toContain('.csv')
  })

  it('拒绝可执行文件、相对路径与空值', () => {
    expect(() => validateDatasetSourcePath(ABS.replace(/\.xlsx$/, '.exe'))).toThrow()
    expect(() => validateDatasetSourcePath('relative.csv')).toThrow()
    expect(() => validateDatasetSourcePath('')).toThrow()
    expect(() => validateDatasetSourcePath(undefined)).toThrow()
  })

  it.runIf(process.platform === 'win32')('拒绝网络共享路径（避免带凭据访问 UNC）', () => {
    expect(() => validateDatasetSourcePath('\\\\server\\share\\a.csv')).toThrow()
  })
})
