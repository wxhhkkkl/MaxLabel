import { describe, expect, it } from 'vitest'
import { parseRecentRecords } from '@/features/workspace/useRecentTemplates'

/**
 * 013 现场回归：新装后起始页出现「新标签模板1 / test123」两张卡片，
 * 点了只会弹「打开」对话框。这两条是旧版本写下的无路径记录，
 * 当前版本只允许写入带路径的条目。
 */
describe('最近文件读取', () => {
  it('丢弃没有路径的旧记录', () => {
    const list = parseRecentRecords([
      { name: '新标签模板1' },
      { title: 'test123' },
      { name: 'test123.lsdx', path: 'C:\\Users\\liyan\\Downloads\\test123.lsdx' }
    ])

    expect(list.map((item) => item.name)).toEqual(['test123.lsdx'])
  })

  it('丢弃被标记删除的记录', () => {
    expect(parseRecentRecords([{ name: 'a', path: 'C:\\a.msdx', state: 1 }])).toEqual([])
  })

  it('非数组或损坏内容返回空列表', () => {
    expect(parseRecentRecords(null)).toEqual([])
    expect(parseRecentRecords('oops')).toEqual([])
    expect(parseRecentRecords([null, 1, 'x'])).toEqual([])
  })

  it('标题优先于 name，并裁掉首尾空白', () => {
    const [item] = parseRecentRecords([{ title: '  标签A  ', name: 'ignored', path: 'C:\\a.msdx' }])
    expect(item.name).toBe('标签A')
    expect(item.path).toBe('C:\\a.msdx')
  })

  it('最多保留 10 条，顺序不变', () => {
    const raw = Array.from({ length: 12 }, (_, i) => ({ name: `t${i}`, path: `C:\\t${i}.msdx` }))
    const list = parseRecentRecords(raw)
    expect(list).toHaveLength(10)
    expect(list[0].name).toBe('t0')
  })
})
