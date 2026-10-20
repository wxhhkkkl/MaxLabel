import { describe, expect, it } from 'vitest'
import { clientToCanvasPoint, eventClientPoint } from '@/editor/canvasCoordinates'

describe('canvas coordinates', () => {
  it('normalises client, page and touch input', () => {
    expect(eventClientPoint({ clientX: 150, clientY: 100 })).toEqual({ x: 150, y: 100 })
    expect(eventClientPoint({ clientX: 0, clientY: 0, pageX: 200, pageY: 120 })).toEqual({ x: 200, y: 120 })
    expect(eventClientPoint({ clientX: 0, clientY: 0, pageX: 0, pageY: 0 })).toEqual({ x: 0, y: 0 })
    expect(eventClientPoint({ touches: [{ clientX: 10, clientY: 20 }] })).toEqual({ x: 10, y: 20 })
    expect(eventClientPoint({})).toEqual({ x: 0, y: 0 })
  })

  it('maps the viewport centre to the scene centre', () => {
    expect(clientToCanvasPoint({ x: 100, y: 100 }, { left: 0, top: 0, width: 200, height: 200 }, 100, 100, 1, 0))
      .toEqual({ x: 50, y: 50 })
    expect(clientToCanvasPoint({ x: 100, y: 100 }, { left: 0, top: 0, width: 200, height: 200 }, 100, 100, 2, 0))
      .toEqual({ x: 50, y: 50 })
  })

  it('applies the inverse layout rotation', () => {
    const bounds = { left: 0, top: 0, width: 200, height: 200 }
    const close = (point: { x: number; y: number }, x: number, y: number) => {
      expect(point.x).toBeCloseTo(x, 6)
      expect(point.y).toBeCloseTo(y, 6)
    }
    close(clientToCanvasPoint({ x: 100, y: 0 }, bounds, 100, 100, 1, 90), -50, 50)
    close(clientToCanvasPoint({ x: 200, y: 100 }, bounds, 100, 100, 1, 180), -50, 50)
    close(clientToCanvasPoint({ x: 100, y: 0 }, bounds, 100, 100, 1, 270), 150, 50)
  })

  it('clamps zoom to a positive minimum', () => {
    expect(clientToCanvasPoint({ x: 1, y: 1 }, { left: 0, top: 0, width: 2, height: 2 }, 100, 100, 0, 0))
      .toEqual({ x: 50, y: 50 })
  })
})
