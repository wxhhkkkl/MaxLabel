// @vitest-environment jsdom
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { importLsdx } from '@/io/lsdxImport'

const fixture = readFileSync(resolve(__dirname, '../../fixtures/lsdx/minimal.lsdx'), 'utf8')

describe('LabelShop .lsdx import', () => {
  it('preserves label dimensions and basic object types', async () => {
    const imported = await importLsdx(fixture, 'minimal.lsdx')
    expect(imported.doc.widthMm).toBe(80)
    expect(imported.doc.heightMm).toBe(60)
    expect(imported.doc.objects).toHaveLength(5)
    expect(imported.doc.objects.some((object) => object.type === 'group')).toBe(true)
    expect(imported.doc.objects.some((object) => object.type === 'table' && object.rows === 2 && object.cols === 3)).toBe(true)
    expect(imported.doc.objects.some((object) => object.type === 'rfid' && object.bank === 'EPC')).toBe(true)
  })

  it('imports rounded paper and a centre hole', async () => {
    const rounded = await importLsdx(
      fixture.replace('<labelobjects>', '<form corner="1" hole="1" holesize="1500"/><labelobjects>'),
      'rounded.lsdx'
    )
    expect(rounded.doc.layout?.shape).toBe('roundRect')
    expect(rounded.doc.layout?.innerDiameterMm).toBe(15)
  })

  it('rejects malformed XML and non-LabelShop roots', async () => {
    await expect(importLsdx('<not-labelshop/>', 'bad.lsdx')).rejects.toThrow(/labelshopdocument/)
    await expect(importLsdx('<labelshopdocument><broken>', 'bad.lsdx')).rejects.toThrow(/XML 解析失败/)
  })
})
