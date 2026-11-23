import { describe, expect, it } from 'vitest'
import { pool, rng, wave } from '../../src/game/engine.ts'
import { CHANNELS, level as levelOf, observations } from '../../src/game/levels/observations.ts'
import { rows } from '../../src/game/levels/rows.ts'

const H = (xs: string[]) => {
  const m = new Map<string, number>()
  for (const x of xs) m.set(x, (m.get(x) ?? 0) + 1)
  return -[...m.values()].reduce((s, k) => s + (k / xs.length) * Math.log2(k / xs.length), 0)
}
const MI = (a: string[], b: string[]) => H(a) + H(b) - H(a.map((x, i) => `${x}|${b[i]}`))
const shuffle = (r: () => number, xs: string[]) => xs.map((x) => [r(), x] as const).sort((p, q) => p[0] - q[0]).map((p) => p[1])
// Adjusted mutual information between a drawn channel and the gap flag, with a permutation p-value.
const leak = (a: string[], g: string[], perms = 1000) => {
  const mi = MI(a, g)
  const r = rng(7)
  const base = Array.from({ length: perms }, () => MI(a, shuffle(r, g)))
  const mean = base.reduce((s, x) => s + x, 0) / perms
  return { ami: (mi - mean) / (H(g) - mean), p: (base.filter((x) => x >= mi).length + 1) / (perms + 1) }
}

describe('context channels do not give the gap away', () => {
  it('every channel a level draws stays under AMI 0.10 or is not significant on its scored runs', () => {
    const table: Record<string, string>[] = []
    for (const rule of Object.keys(CHANNELS)) {
      const scored = rows.filter((r) => r.rule === rule && !r.research)
      const gaps = scored.map((r) => String(r.gap))
      for (const [name, read] of Object.entries(levelOf)) {
        const { ami, p } = leak(scored.map((r) => String(read(r.context))), gaps)
        const drawn = CHANNELS[rule]!.includes(name as keyof typeof levelOf)
        table.push({ rule, name, ami: ami.toFixed(3), p: p.toFixed(3), drawn: String(drawn) })
        if (drawn) expect(ami <= 0.1 || p >= 0.05, `${rule} ${name} AMI ${ami.toFixed(3)} p ${p.toFixed(3)}`).toBe(true)
      }
    }
    console.table(table)
  }, 60_000)

  it('no level lets an observer find the gap by the one rock whose signs are unique', () => {
    const table: Record<string, string>[] = []
    observations.levels.forEach((l, k) => {
      const waves = [
        ...l.sequence.slice(0, 20).map((s) => wave(observations, s)),
        ...[1, 2, 3, 4, 5].flatMap((step) => pool(observations, l.start.rule, step).map((s) => wave(observations, s))),
      ].map((w) => ({ sigs: observations.choiceRecords!(w).map((c) => JSON.stringify(c.signs)), gap: w.answers[0]! }))
      const score = (w: { sigs: string[] }, gap: number) => {
        const once = w.sigs.filter((x) => w.sigs.filter((y) => y === x).length === 1)
        return once.length === 0 ? 1 / w.sigs.length : once.includes(w.sigs[gap]!) ? 1 / once.length : 0
      }
      const seen = waves.reduce((s, w) => s + score(w, w.gap), 0)
      const r = rng(7)
      const draws = 2000
      const above = Array.from({ length: draws }, () => waves.reduce((s, w) => s + score(w, Math.floor(r() * w.sigs.length)), 0)).filter((x) => x >= seen).length
      const p = (above + 1) / (draws + 1)
      table.push({ level: String(k + 1), waves: String(waves.length), share: (seen / waves.length).toFixed(3), p: p.toFixed(3) })
      expect(p >= 0.05, `level ${k + 1} hit share ${(seen / waves.length).toFixed(3)} p ${p.toFixed(3)}`).toBe(true)
    })
    console.table(table)
  }, 120_000)
})
