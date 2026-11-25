import { describe, expect, it } from 'vitest'
import { pool, wave } from '../../src/game/engine.ts'
import type { Wave } from '../../src/game/engine.ts'
import { MANY, level as levelOf, observations, signs } from '../../src/game/levels/observations.ts'
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
const withMany = (t: number) => (r: Row) => JSON.stringify({ ...signs(r), many: +((r.context?.tests ?? 0) > t) })
const admissible = (x: ReturnType<typeof reader>) => x.certain <= CEILING && x.decided === 0

describe('drawn signs correlate with the gap but never make an answer obvious', () => {
  it('a reader who knows every drawn sign by heart stays at or under 65% on the certain waves, and no wave is decided by signs alone', () => {
    const x = reader((r) => JSON.stringify(signs(r)))
    console.table(Object.fromEntries([...Object.keys(levelOf).map((k) => [k, nmi(scored.map((r) => String(levelOf[k as keyof typeof levelOf](r.context))), scored.map((r) => String(r.gap))).toFixed(3)]), ['all signs', x.nmi.toFixed(3)], ['reader on certain waves', x.certain.toFixed(3)]]))
    expect(x.certain, `reader ${x.certain.toFixed(3)}`).toBeLessThanOrEqual(CEILING)
    expect(x.decided).toBe(0)
  })

  it('the tests-run threshold is the most correlating one that stays admissible', () => {
    const chosen = reader(withMany(MANY))
    const options = [...new Set(scored.map((r) => r.context!.tests!))].sort((a, b) => a - b).map((t) => ({ t, ...reader(withMany(t)) }))
    console.table(options.map((o) => ({ t: o.t, certain: o.certain.toFixed(3), decided: o.decided, nmi: o.nmi.toFixed(3) })))
    expect(admissible(chosen)).toBe(true)
    for (const o of options.filter(admissible)) expect(o.nmi, `threshold ${o.t}`).toBeLessThanOrEqual(chosen.nmi)
    expect(chosen.nmi).toBeGreaterThan(reader((r) => JSON.stringify({ ...signs(r), many: 0, criteria: 0 })).nmi)
  })
})
