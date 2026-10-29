import { describe, expect, it } from 'vitest'
import { FONTS, mergeFontOptions } from '@/features/fonts/fontList'

describe('字体下拉清单', () => {
  it('固定清单排在最前，顺序不变', () => {
    expect(mergeFontOptions(['Arial'], ['微软雅黑', '宋体'])).toEqual(['微软雅黑', '宋体', 'Arial'])
  })

  it('追加的系统字族按名称排序', () => {
    const merged = mergeFontOptions(['宋体', 'Arial', '等线'], [])
    expect(merged).toHaveLength(3)
    expect(merged).toEqual([...merged].sort((a, b) => a.localeCompare(b, 'zh-CN')))
  })

  it('与固定清单重名的不重复追加（忽略大小写）', () => {
    const merged = mergeFontOptions(['arial', 'Arial', 'SimSun'], FONTS)
    expect(merged.filter((name) => name.toLowerCase() === 'arial')).toHaveLength(1)
    expect(merged).toContain('SimSun')
  })

  it('过滤空行和 @ 竖排变体', () => {
    expect(mergeFontOptions(['', '  ', '@宋体', 'Romand'], [])).toEqual(['Romand'])
  })

  it('系统清单为空时保持固定清单原样', () => {
    expect(mergeFontOptions([], FONTS)).toEqual(FONTS)
  })
})
