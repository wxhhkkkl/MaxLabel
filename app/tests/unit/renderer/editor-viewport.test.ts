import { describe, expect, it } from 'vitest'
import {
  OUTSIDE_LABEL_MARGIN_MM,
  computeEditorViewport,
  outsideRingPath
} from '@/editor/editorViewport'

describe('editor viewport for content outside the label', () => {
  it('keeps the canvas exactly on the paper when the option is off', () => {
    expect(computeEditorViewport({
      paperWidthPx: 1000,
      paperHeightPx: 700,
      zoom: 1,
      marginMm: OUTSIDE_LABEL_MARGIN_MM,
      showOutside: false,
      viewportWidthPx: 1600,
      viewportHeightPx: 1200
    })).toEqual({
      canvasWidth: 1000,
      canvasHeight: 700,
      paperX: 0,
      paperY: 0,
      paperWidth: 1000,
      paperHeight: 700
    })
  })

  it('adds a symmetric zoomed margin when the option is on', () => {
    // 1000×700 是当前 zoom 下的纸张像素尺寸；15mm 在 150% 下 = 15×10×1.5 = 225px。
    expect(computeEditorViewport({
      paperWidthPx: 1000,
      paperHeightPx: 700,
      zoom: 1.5,
      marginMm: 15,
      showOutside: true
    })).toEqual({
      canvasWidth: 1450,
      canvasHeight: 1150,
      paperX: 225,
      paperY: 225,
      paperWidth: 1000,
      paperHeight: 700
    })
  })

  it('grows the margin until the canvas covers the visible workspace', () => {
    // 1600×1200 可见区：左右各需 (1600-1000)/2=300，上下各需 (1200-700)/2=250。
    expect(computeEditorViewport({
      paperWidthPx: 1000,
      paperHeightPx: 700,
      zoom: 1,
      marginMm: 15,
      showOutside: true,
      viewportWidthPx: 1600,
      viewportHeightPx: 1200
    })).toEqual({
      canvasWidth: 1600,
      canvasHeight: 1200,
      paperX: 300,
      paperY: 250,
      paperWidth: 1000,
      paperHeight: 700
    })
  })

  it('builds the outer ring so the paper keeps its shape while the margin shows content', () => {
    expect(outsideRingPath(100, 50, 10, 20))
      .toBe('M 0 0 H 120 V 90 H 0 Z M 10 20 H 110 V 70 H 10 Z')
  })
})
