import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { localizeErrorText } from '@shared/i18n/errors.en-US'

const APP_ROOT = resolve(__dirname, '../../../..')
const CJK = '一-鿿'

const ERROR_MODULES = [
  'src/renderer/src/io/lsdxImport.ts',
  'src/renderer/src/io/msdx.ts',
  'src/renderer/src/editor/dataImport.ts',
  'src/renderer/src/editor/barcode.ts',
  'src/renderer/src/features/editor/operations.ts',
  'src/renderer/src/features/printing/printPreviewService.ts',
  'src/renderer/src/features/workspace/documentPersistence.ts',
  'src/renderer/src/print/imageValidation.ts',
  'src/renderer/src/print/renderLabel.ts',
  'src/renderer/src/print/vectorBarcode.ts',
  'src/renderer/src/print/bitmapSource.ts',
  'src/renderer/src/print/driverPage.ts',
  'src/renderer/src/rendering/fabricObjects.ts'
]

function exactMessages(source: string): string[] {
  const patterns = [
    new RegExp(`throw new Error\\('([^']*[${CJK}][^']*)'\\)`, 'g'),
    new RegExp(`warnings\\.push\\('([^']*[${CJK}][^']*)'\\)`, 'g'),
    new RegExp(`message:\\s*'([^']*[${CJK}][^']*)'`, 'g')
  ]
  return patterns.flatMap((pattern) => [...source.matchAll(pattern)].map((match) => match[1])).filter((text) => !text.includes('${'))
}

describe('localized error catalog', () => {
  it('translates every fixed user-facing error thrown by import/print/render modules', () => {
    const missing = ERROR_MODULES.flatMap((file) => {
      const source = readFileSync(resolve(APP_ROOT, file), 'utf8')
      return exactMessages(source)
        .filter((message) => localizeErrorText('en-US', message) === message)
        .map((message) => `${file}: ${message}`)
    })
    expect([...new Set(missing)]).toEqual([])
  })

  it('keeps Chinese messages unchanged for the source language', () => {
    expect(localizeErrorText('zh-CN', '图片内容无法解码')).toBe('图片内容无法解码')
  })
})
