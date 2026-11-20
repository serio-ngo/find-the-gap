export type Save = { plays: number; best: number; last: { mode: string; picks: number[] } }

const P = 'ftg:'
const ls = (): Storage | undefined => { try { return globalThis.localStorage } catch { return undefined } }
const ftg = (s: Storage) => Array.from({ length: s.length }, (_, i) => s.key(i)).filter((k): k is string => !!k?.startsWith(P))

export const load = (deck: string, level: number, s = ls()): Save | null => {
  try { return JSON.parse(s!.getItem(`${P}${deck}:${level}`)!) } catch { return null }
}

export const save = (deck: string, level: number, score: number, last: Save['last'], s = ls()) => {
  try {
    const old = load(deck, level, s)
    s!.setItem(`${P}${deck}:${level}`, JSON.stringify({ plays: (old?.plays ?? 0) + 1, best: Math.max(old?.best ?? 0, score), last }))
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
