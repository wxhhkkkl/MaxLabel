// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest'
import { importLsdx } from '@/io/lsdxImport'
import { DEFAULT_LAYER_ID } from '@shared/domain/layers'
import { normalizeDocument } from '@shared/domain/document'
import type { LabelObject } from '@shared/domain/objects'

// jsdom 不解码 Image data URL；这里只关心图层归属
vi.mock('@/print/imageValidation', async (importOriginal) => {
  const original = await importOriginal<typeof import('@/print/imageValidation')>()
  return { ...original, validateImageDataUrl: vi.fn(async () => undefined) }
})

// ⚠️ 用最小合成样例而不是 fixtures/lsdx/minimal.lsdx：后者含一个 xSizeMm 越界的
//    条码，normalizeDocument 会先按既有规则拒掉，与本用例无关。
const XML = `<labelshopdocument><labelform>
  <label width="4000" height="3000" rows="1" cols="1" rowgap="0" colgap="0"/>
  <labelobjects>
    <drawobj type="drawtext" id="2" left="0" top="0" right="3550" bottom="500">
      <font facename="Arial" height="1200" style="1"/><text type="1" align="0">hello</text>
    </drawobj>
    <drawobj type="drawtext" id="3" left="0" top="1000" right="3550" bottom="1500">
      <font facename="Arial" height="1200" style="1"/><text type="1" align="0">world</text>
    </drawobj>
  </labelobjects>
</labelform></labelshopdocument>`

/** 递归收集所有对象（含分组子项） */
function walk(objects: LabelObject[]): LabelObject[] {
  return objects.flatMap((object) => [object, ...(object.type === 'group' ? walk(object.children) : [])])
}

/**
 * lsdx 没有图层概念（019 / R6 / T027）
 *
 * 导入结果本身不带 `layers`，靠 `normalizeDocument` 补默认图层 —— 这条链路一旦断，
 * 导入的模板会有一批「不属于任何图层」的对象。
 */
describe('lsdx 导入 —— 图层归属', () => {
  it('导入的文档只有默认图层', async () => {
    const imported = await importLsdx(XML, 'sample.lsdx')
    const normalized = normalizeDocument(imported.doc)

    expect(normalized.layers?.map((layer) => layer.id)).toEqual([DEFAULT_LAYER_ID])
  })

  it('所有对象（含分组子项）都归默认图层', async () => {
    const imported = await importLsdx(XML, 'sample.lsdx')
    const normalized = normalizeDocument(imported.doc)

    const all = walk(normalized.objects)
    expect(all.length).toBeGreaterThan(0)
    expect(all.every((object) => object.layerId === DEFAULT_LAYER_ID)).toBe(true)
  })
})
