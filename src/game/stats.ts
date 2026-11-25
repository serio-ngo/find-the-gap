import type { Decision } from './engine.ts'

export type Save = { plays: number; best: number; top: number[]; last: { mode: string; picks: number[]; edition?: string; decisions?: (Omit<Decision, 'hit'> & { hit?: boolean })[] } }

const P = 'ftg:'
const ls = (): Storage | undefined => { try { return globalThis.localStorage } catch { return undefined } }
const key = (deck: string, level: number, edition?: string) => `${P}${deck}:${level}${edition ? `:${edition}` : ''}`

export const load = (deck: string, level: number, s = ls(), edition?: string): Save | null => {
  try { return JSON.parse(s!.getItem(key(deck, level, edition))!) } catch { return null }
}

export const save = (deck: string, level: number, score: number, last: Save['last'], s = ls()) => {
  try {
    const old = load(deck, level, s, last.edition)
    s!.setItem(key(deck, level, last.edition), JSON.stringify({ plays: (old?.plays ?? 0) + 1, best: Math.max(old?.best ?? 0, score), top: [...(Array.isArray(old?.top) ? old.top : []), score].sort((a, b) => b - a).slice(0, 5), last }))
  } catch {}
}

export const wilson = (k: number, n: number): [number, number] => {
  const z = 1.96
  const p = k / n
  const d = 1 + (z * z) / n
  const c = (p + (z * z) / (2 * n)) / d
  const h = (z * Math.sqrt((p * (1 - p)) / n + (z * z) / (4 * n * n))) / d
  return [Math.max(0, c - h), Math.min(1, c + h)]
}
