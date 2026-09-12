import { round2 } from './units'

export interface Affine2D {
  a: number
  b: number
  c: number
  d: number
  e: number
  f: number
}

export interface Point2D { x: number; y: number }

export const identityAffine: Affine2D = Object.freeze({ a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 })

export function multiplyAffine(left: Affine2D, right: Affine2D): Affine2D {
  return {
    a: left.a * right.a + left.c * right.b,
    b: left.b * right.a + left.d * right.b,
    c: left.a * right.c + left.c * right.d,
    d: left.b * right.c + left.d * right.d,
    e: left.a * right.e + left.c * right.f + left.e,
    f: left.b * right.e + left.d * right.f + left.f
  }
}

export function applyAffine(matrix: Affine2D, point: Point2D): Point2D {
  return {
    x: matrix.a * point.x + matrix.c * point.y + matrix.e,
    y: matrix.b * point.x + matrix.d * point.y + matrix.f
  }
}

export function invertAffine(matrix: Affine2D): Affine2D {
  const determinant = matrix.a * matrix.d - matrix.b * matrix.c
  if (Math.abs(determinant) < 1e-12) throw new Error('不可逆的二维变换矩阵')
  const a = matrix.d / determinant
  const b = -matrix.b / determinant
  const c = -matrix.c / determinant
  const d = matrix.a / determinant
  return {
    a,
    b,
    c,
    d,
    e: -(a * matrix.e + c * matrix.f),
    f: -(b * matrix.e + d * matrix.f)
  }
}

export function rotationAround(cx: number, cy: number, degrees: number): Affine2D {
  const radians = degrees * Math.PI / 180
  const cos = Math.cos(radians)
  const sin = Math.sin(radians)
  return {
    a: cos,
    b: sin,
    c: -sin,
    d: cos,
    e: cx - cos * cx + sin * cy,
    f: cy - sin * cx - cos * cy
  }
}

export function affineRotationDegrees(matrix: Affine2D): number {
  return Math.atan2(matrix.b, matrix.a) * 180 / Math.PI
}

export function roundPoint(point: Point2D): Point2D {
  return { x: round2(point.x), y: round2(point.y) }
}
