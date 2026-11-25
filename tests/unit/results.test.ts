import { describe, expect, it } from 'vitest'
import { wave } from '../../src/game/engine.ts'
import { objectsFor } from '../../src/game/objects.ts'
import type { Spec } from '../../src/game/engine.ts'
import { decks } from '../../src/game/levels/index.ts'
import { CERTAIN, rowOf } from '../../src/game/levels/observations.ts'
import { summarize } from '../../scripts/results.ts'
import { edition } from '../../src/game/eval/version.ts'

it('reads only results of the current deck edition and splits human and AI hits by rule and gap case', async () => {
  const d = decks.observations!
  const spec = d.levels[0]!.sequence.find((s, i) => !d.levels[0]!.anchors.includes(i) && wave(d, s).answers.length === 1)!
  const w = wave(d, spec)
  const right = w.answers[0]!
  const row = (pick: number, ai: number, first: number, ms: number) => [0, spec.step, spec.seed, pick, +(pick === right), 1, ai, 0, 0, 0, first, ms, 1, 1, ...w.symbols.map((_, k) => (k === right ? ms / 2 : ms / 10))]
  const waves = JSON.stringify([row(right, right, 1, 1000), row((right + 1) % w.symbols.length, -1, 1, 3000)])
  const out = await summarize([
    { version: await edition(d), level: 1, mode: 0, waves },
    { version: 'observations:000000000000', level: 1, mode: 0, waves },
  ])
  expect(out).toMatchObject({ edition: await edition(d), games: 1, otherEditions: 1 })
  expect(out.rules.odd_revision).toEqual({ shown: 2, human: 0.5, ai: 1 })
  expect(out.hardest).toEqual([{ id: w.ids![right], arity: 2, breaks: 1, pattern: 'differ', shown: 2, human: 0.5, ai: 1 }])
  expect(out.certain).toEqual({ shown: 2, human: 0.5, ai: 1 })
  expect(out).not.toHaveProperty('waves')
  expect(out.aim).toEqual({ hit: { n: 1, ms: 1000, gap: 500, others: 100, switches: 1 }, miss: { n: 1, ms: 3000, gap: 1500, others: 300, switches: 1 } })
  expect(out.peers).toEqual([{ wave: `1:odd_revision:${spec.step}:${spec.seed}`, n: 2, enough: false }])
})

it('scores a research wave by any of its gaps and keeps waves without exactly one gap out of the gap tables', async () => {
  const d = decks.observations!
  const specs = d.levels.flatMap((l) => l.sequence)
  const none = specs.find((s) => wave(d, s).answers.length === 0)!
  const many = specs.find((s) => wave(d, s).answers.length > 1)!
  const row = (s: Spec, pick: number) => {
    const w = wave(d, s)
    return [d.rules.findIndex((r) => r.id === s.rule), s.step, s.seed, pick, +w.answers.includes(pick), 1, -1, 0, 0, 0, 1, 1000, 0, 0, ...w.symbols.map(() => 0)]
  }
  const waves = JSON.stringify([row(none, 0), row(many, wave(d, many).answers[1]!)])
  const out = await summarize([{ version: await edition(d), level: 1, mode: 0, waves }])
  expect([out.rules, out.hardest, out.aim.hit.n + out.aim.miss.n, out.peers.length]).toEqual([{}, [], 0, 2])
  expect(out.research[d.rules[0]!.id].picks).toBe(2)
})

const round3 = (x: number) => Math.round(x * 1000) / 1000
const lifts = (r: { lift: { drawn: Record<string, Record<string, { lift: number | null }>>; data: Record<string, Record<string, { lift: number | null }>> } }) =>
  [r.lift.drawn, r.lift.data].flatMap((t) => Object.values(t).flatMap((f) => Object.values(f).map((v) => v.lift)))

describe('research summary', () => {
  const d = decks.observations!
  const l = d.levels[0]!
  const research = (n: number) => l.sequence.find((s, i) => !CERTAIN.includes(i) && wave(d, s).answers.length === n)!
  const row = (s: Spec, pick: number) => {
    const w = wave(d, s)
    return [d.rules.findIndex((r) => r.id === s.rule), s.step, s.seed, pick, +w.answers.includes(pick), 1, -1, 0, 0, 0, 1, 1000, 0, 0, ...w.symbols.map(() => 0)]
  }
  const play = async (waves: number[][]) => summarize([{ version: await edition(d), level: 1, mode: 0, waves: JSON.stringify(waves) }])

  it('counts every research pick and gives every lift 1 when each rock is picked once', async () => {
    const specs = [0, 1, 2].map(research)
    const out = await play(specs.flatMap((s) => wave(d, s).symbols.map((_, k) => row(s, k))))
    const r = out.research[l.start.rule]
    expect(r.picks).toBe(specs.reduce((t, s) => t + wave(d, s).symbols.length, 0))
    expect(r.waves).toEqual({ 0: 1, 1: 1, 2: 1 })
    expect(Object.keys(r.lift.drawn)).toEqual(Object.keys(objectsFor(d, wave(d, specs[0]!))[0]!.shape.facts))
    expect(Object.keys(r.lift.data)).toEqual(['gap', 'arity', 'breaks', 'locks', 'job', 'share', 'impacts', 'agent'])
    const all = lifts(r)
    expect(all.length).toBeGreaterThan(0)
    expect(all.every((x) => x === 1)).toBe(true)
  })

  it('lifts a gap pick by how rare gap rocks are, and counts no research row as a certain wave or a hit rate', async () => {
    const s = research(1)
    const w = wave(d, s)
    expect(rowOf(w.ids![w.answers[0]!]!).gap).toBe(true)
    const out = await play([row(s, w.answers[0]!)])
    expect(out.research[s.rule].lift.data.gap['true'].lift).toBe(round3(1 / (1 / w.symbols.length)))
    expect(JSON.stringify(out.research)).not.toContain('"human"')
    expect([out.rules, out.certain?.shown ?? 0]).toEqual([{}, 0])
  })
})
