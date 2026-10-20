import type { WeighUnit } from './types'

/** Exact conversion factors in grams. */
export const UNIT_TO_GRAMS: Record<WeighUnit, number> = {
  g: 1,
  kg: 1000,
  lb: 453.59237,
  oz: 28.349523125,
  jin: 500
}

const UNIT_ALIASES: Record<string, WeighUnit> = {
  g: 'g',
  kg: 'kg',
  lb: 'lb',
  lbs: 'lb',
  oz: 'oz',
  jin: 'jin',
  '斤': 'jin'
}

export function normalizeUnitToken(token: string | undefined): WeighUnit | undefined {
  if (!token) return undefined
  return UNIT_ALIASES[token.trim().toLowerCase()]
}

export function convertWeight(value: number, from: WeighUnit, to: WeighUnit): number {
  if (from === to) return value
  return (value * UNIT_TO_GRAMS[from]) / UNIT_TO_GRAMS[to]
}

/** Format with fixed decimals; the unit is supplied by the caller. */
export function formatWeight(value: number, _unit: WeighUnit, decimals: number): string {
  const places = Math.max(0, Math.min(4, Math.trunc(decimals)))
  return value.toFixed(places)
}
