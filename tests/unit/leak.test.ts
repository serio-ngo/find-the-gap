import { describe, expect, it } from 'vitest'
import { rng } from '../../src/game/engine.ts'
import { CHANNELS, level as levelOf } from '../../src/game/levels/observations.ts'
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
})
