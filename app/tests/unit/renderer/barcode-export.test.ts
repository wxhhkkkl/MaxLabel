import { describe, expect, it } from 'vitest'
import { barcodeExportFilename, resolveBarcodeExportScenes } from '@/features/exporting/barcodeExport'
import { sampleDoc } from '../../helpers/factories'

const base = {
  text: 'ABC/123',
  index: 0,
  count: 3,
  naming: 'serial' as const,
  prefix: '',
  format: 'png' as const,
  objectIndex: 0,
  objectCount: 1
}

describe('barcode export filenames', () => {
  it('pads serial names to at least four digits', () => {
    expect(barcodeExportFilename(base)).toBe('0001.png')
    expect(barcodeExportFilename({ ...base, index: 2, count: 10000 })).toBe('00003.png')
  })

  it('uses sanitized content names and content+serial names', () => {
    expect(barcodeExportFilename({ ...base, naming: 'content', count: 1 })).toBe('ABC_123.png')
    expect(barcodeExportFilename({ ...base, naming: 'content', count: 3 })).toBe('ABC_123_0001.png')
    expect(barcodeExportFilename({ ...base, naming: 'content_serial', index: 1 })).toBe('ABC_123_0002.png')
  })

  it('sanitizes the prefix and adds an object suffix', () => {
    expect(barcodeExportFilename({ ...base, prefix: '批/次:', objectCount: 2, objectIndex: 1 })).toBe('批_次__0001_b2.png')
  })
})

describe('barcode export scenes', () => {
  it('resolves one scene per requested label and honors preview-only', () => {
    expect(resolveBarcodeExportScenes(sampleDoc(), 3, false)).toHaveLength(3)
    expect(resolveBarcodeExportScenes(sampleDoc(), 3, false, true)).toHaveLength(1)
  })

  it('honors a script-defined total label count only when scripts are allowed', () => {
    const doc = {
      ...sampleDoc(),
      globalScript: 'Function OnBeginPrint(State)\nV_TOTALLABELS = 2\nEnd Function'
    }
    expect(resolveBarcodeExportScenes(doc, 5, true)).toHaveLength(2)
    expect(resolveBarcodeExportScenes(doc, 5, false)).toHaveLength(5)
  })
})
