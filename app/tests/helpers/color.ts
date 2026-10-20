import type { BarcodeObj, ColorChangeConfig, ImageObj, LineObj, TextObj } from '@shared/domain/objects'
import type { DataCtx } from '@shared/domain/datasource'

export function colorChange(overrides: Partial<ColorChangeConfig> = {}): ColorChangeConfig {
  return {
    mode: 'fixed',
    tableSource: 'private',
    privateTable: [],
    changeMode: 'solid',
    blockRows: 1,
    blockCols: 1,
    variableName: '',
    inputValue: '',
    ...overrides
  }
}

export function colorCtx(overrides: Partial<DataCtx> = {}): DataCtx {
  return {
    labelIndex: 1,
    recordIndex: 0,
    copy: 1,
    count: 1,
    totalLabels: 1,
    title: 'colour',
    printerName: 'test',
    datasets: {},
    sharedVars: {},
    keyboardValues: {},
    ...overrides
  }
}

export function textObject(overrides: Partial<TextObj> = {}): TextObj {
  return {
    id: 'text-1',
    type: 'text',
    x: 4,
    y: 4,
    w: 40,
    h: 8,
    rotation: 0,
    fontFamily: 'Arial',
    fontSize: 4,
    bold: false,
    align: 'left',
    color: '#000000',
    textType: 'single',
    source: { kind: 'constant', value: '1A' },
    ...overrides
  } as TextObj
}

export function barcodeObject(overrides: Partial<BarcodeObj> = {}): BarcodeObj {
  return {
    id: 'barcode-1',
    type: 'barcode',
    x: 4,
    y: 14,
    w: 40,
    h: 10,
    rotation: 0,
    symbology: 'code128',
    showText: false,
    color: '#000000',
    source: { kind: 'constant', value: '1234567890' },
    ...overrides
  } as BarcodeObj
}

export function lineObject(overrides: Partial<LineObj> = {}): LineObj {
  return {
    id: 'line-1',
    type: 'line',
    x: 4,
    y: 20,
    w: 30,
    h: 0,
    rotation: 0,
    stroke: '#000000',
    strokeWidth: 0.3,
    ...overrides
  } as LineObj
}

export function imageObject(overrides: Partial<ImageObj> = {}): ImageObj {
  return {
    id: 'image-1',
    type: 'image',
    x: 4,
    y: 24,
    w: 20,
    h: 10,
    rotation: 0,
    src: 'mono-1',
    imgType: 'datasource',
    ...overrides
  } as ImageObj
}

export const SHARED_TABLE = ['#111111', '#222222', '#333333']
export const PRIVATE_TABLE = ['#AABBCC', '#DDEEFF']
