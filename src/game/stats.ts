import type { Decision } from './engine.ts'

export type Save = { plays: number; best: number; top: number[]; last: { mode: string; picks: number[]; edition?: string; decisions?: (Omit<Decision, 'hit'> & { hit?: boolean })[] } }

const P = 'ftg:'
const ls = (): Storage | undefined => { try { return globalThis.localStorage } catch { return undefined } }
const ftg = (s: Storage) => Array.from({ length: s.length }, (_, i) => s.key(i)).filter((k): k is string => !!k?.startsWith(P))
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

export const exportSaves = (s = ls()): string => {
  const o: Record<string, string> = {}
  try { for (const k of ftg(s!)) o[k] = s!.getItem(k)! } catch {}
  return JSON.stringify(o)
}

export const clearSaves = (s = ls()) => {
  try { for (const k of ftg(s!)) s!.removeItem(k) } catch {}
}
