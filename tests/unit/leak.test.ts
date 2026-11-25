import { describe, expect, it } from 'vitest'
import { pool, rng, wave } from '../../src/game/engine.ts'
import type { Wave } from '../../src/game/engine.ts'
import { FULL, LOCKS, level as levelOf, observations, signs } from '../../src/game/levels/observations.ts'
import type { Row } from '../../src/game/levels/observations.ts'
import { rows } from '../../src/game/levels/rows.ts'

const CEILING = 0.65
const byId = new Map(rows.map((r) => [r.id, r]))
const scored = rows.filter((r) => !r.research)
const H = (xs: string[]) => {
  const m = new Map<string, number>()
  for (const x of xs) m.set(x, (m.get(x) ?? 0) + 1)
  return -[...m.values()].reduce((s, k) => s + (k / xs.length) * Math.log2(k / xs.length), 0)
}
const nmi = (a: string[], g: string[]) => (H(a) + H(g) - H(a.map((x, i) => `${x}|${g[i]}`))) / H(g)

const l = observations.levels[0]!
const rule = l.start.rule
const steps = [1, 2, 3, 4, 5]
const certain = [...l.anchors.map((i) => wave(observations, l.sequence[i]!)), ...steps.flatMap((s) => pool(observations, rule, s, true).map((x) => wave(observations, x)))]
const all = [...certain, ...l.sequence.map((s) => wave(observations, s)), ...steps.flatMap((s) => pool(observations, rule, s).map((x) => wave(observations, x)))]

const reader = (key: (r: Row) => string) => {
  const tally = new Map<string, [number, number]>()
  for (const r of scored) {
    const t = tally.get(key(r)) ?? [0, 0]
    t[r.gap ? 0 : 1]++
    tally.set(key(r), t)
  }
  const p = (r: Row) => { const [g, c] = tally.get(key(r)) ?? [0, 0]; return (g + 0.5) / (g + c + 1) }
  const pure = (r: Row) => { const t = tally.get(key(r)); return !!t && (t[0] === 0 || t[1] === 0) }
  const hits = (ws: Wave[]) => ws.reduce((s, w) => {
    const ps = w.ids!.map((id) => p(byId.get(id)!))
    const top = ps.flatMap((x, i) => (x === Math.max(...ps) ? [i] : []))
    return s + top.filter((i) => w.answers.includes(i)).length / top.length
  }, 0) / ws.length
  return { certain: hits(certain), decided: all.filter((w) => w.ids!.every((id) => pure(byId.get(id)!))).length, nmi: nmi(scored.map(key), scored.map((r) => String(r.gap))) }
}
const odd = (key: (r: Row) => string) => {
  const ws = certain.map((w) => ({ s: w.ids!.map((id) => key(byId.get(id)!)), g: w.answers[0]! }))
  const score = (w: { s: string[] }, g: number) => {
    const once = w.s.filter((x) => w.s.filter((y) => y === x).length === 1)
    return once.length === 0 ? 1 / w.s.length : once.includes(w.s[g]!) ? 1 / once.length : 0
  }
  const seen = ws.reduce((t, w) => t + score(w, w.g), 0)
  const r = rng(7)
  const above = Array.from({ length: 2000 }, () => ws.reduce((t, w) => t + score(w, Math.floor(r() * w.s.length)), 0)).filter((x) => x >= seen).length
  return (above + 1) / 2001
}
const encode = (full: number, field: 'locks' | 'tests' | 'share' | 'agent', t: number) => (r: Row) => ({ ...signs(r)!, full: +((r.context?.criteria ?? 0) >= full), relocked: +((r.context?.[field] ?? 0) > t) })
const tuple = (e: (r: Row) => object) => (r: Row) => JSON.stringify(e(r))
const channels = (e: (r: Row) => Record<string, number>) => [tuple(e), ...Object.keys(levelOf).map((k) => (r: Row) => String(e(r)[k]))]
const mixed = (e: (r: Row) => Record<string, number>) => Object.keys(levelOf).every((k) => [...new Set(scored.map((r) => e(r)[k]))].every((v) => scored.some((r) => r.gap && e(r)[k] === v) && scored.some((r) => !r.gap && e(r)[k] === v)))
const admissible = (x: ReturnType<typeof reader>) => x.certain <= CEILING && x.decided === 0

describe('drawn signs correlate with the gap but never make an answer obvious', () => {
  it('a reader who knows every drawn sign by heart stays at or under 65% on the certain waves, and no wave is decided by signs alone', () => {
    const x = reader((r) => JSON.stringify(signs(r)))
    console.table(Object.fromEntries([...Object.keys(levelOf).map((k) => [k, nmi(scored.map((r) => String(levelOf[k as keyof typeof levelOf](r.context))), scored.map((r) => String(r.gap))).toFixed(3)]), ['all signs', x.nmi.toFixed(3)], ['reader on certain waves', x.certain.toFixed(3)]]))
    expect(x.certain, `reader ${x.certain.toFixed(3)}`).toBeLessThanOrEqual(CEILING)
    expect(x.decided).toBe(0)
  })

  it('no single sign or set of signs makes the gap the odd one out on the certain waves', () => {
    const ps = channels((r) => signs(r)!).map(odd)
    console.table(ps.map((p) => p.toFixed(3)))
    for (const p of ps) expect(p).toBeGreaterThanOrEqual(0.05)
  }, 120_000)

  it('every drawn value appears on a gap and on a control, so no single sign says yes or no', () => {
    expect(mixed((r) => signs(r)!)).toBe(true)
  })

  it('the halo thresholds are the most correlating choice that passes every rule', () => {
    const chosen = reader(tuple(encode(FULL, 'locks', LOCKS)))
    const fields = ['locks', 'tests', 'share', 'agent'] as const
    const options = [...new Set(scored.map((r) => r.context!.criteria!))].flatMap((f) => fields.flatMap((field) => [...new Set(scored.map((r) => r.context![field]!))].map((t) => ({ f, field, t, e: encode(f, field, t) }))))
    const better = options.map((o) => ({ ...o, ...reader(tuple(o.e)) })).filter((o) => o.nmi > chosen.nmi + 1e-9 && admissible(o) && mixed(o.e))
    for (const o of better) expect(channels(o.e).some((k) => odd(k) < 0.05), `criteria ${o.f}, ${o.field} ${o.t}`).toBe(true)
    expect(chosen.nmi).toBeGreaterThan(reader((r) => JSON.stringify({ ...signs(r), relocked: 0, full: 0 })).nmi)
  }, 300_000)
})
