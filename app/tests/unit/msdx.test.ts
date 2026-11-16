import { describe, expect, it } from 'vitest'
import { cloudContentKind, looksLikeLegacyCloudJson } from '../../src/renderer/src/io/msdx'

describe('cloudContentKind', () => {
  it('recognizes lsdx content', () => {
    expect(
      cloudContentKind('<?xml version="1.0"?><labelshopdocument></labelshopdocument>', 'a.lsdx')
    ).toBe('lsdx')
  })

  it('recognizes legacy LabelShop cloud json', () => {
    const content = JSON.stringify({ docid: 'x', lfrm: {}, pfrm: {} })
    expect(looksLikeLegacyCloudJson(content)).toBe(true)
    expect(cloudContentKind(content, 'a.json')).toBe('archive-json')
  })

  it('treats msdx envelope as doc-json', () => {
    const content = JSON.stringify({ format: 'maxlabel-msdx', version: 3, doc: {} })
    expect(cloudContentKind(content, 'a.msdx')).toBe('doc-json')
  })

  it('treats bare LabelDoc json as doc-json', () => {
    const content = JSON.stringify({ objects: [], widthMm: 60, heightMm: 40 })
    expect(cloudContentKind(content, 'a.json')).toBe('doc-json')
  })
})
