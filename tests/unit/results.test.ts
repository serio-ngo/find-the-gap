import { describe, expect, it } from 'vitest'
import { encounters, rooms, rowMap, typicalOf } from '../../src/game/engine.ts'
import { summarize } from '../../scripts/results.ts'
import { edition } from '../../src/game/eval/version.ts'
import { BINDINGS } from '../../src/game/levels/observations.ts'
import { rows } from '../../src/game/levels/rows.ts'
import { world } from '../../src/game/levels/world.ts'

const RS = rooms(world)
const ENC = encounters(world)
const ROWS = rowMap(rows)
const certain = ENC.filter((r) => r.certain)
const research = ENC.filter((r) => !r.certain)
const gap = (r: (typeof ENC)[number]) => r.monsters.findIndex((id) => ROWS.get(id)!.gap)
const read = (r: (typeof ENC)[number]) => BINDINGS.flatMap((b, k) => (r.clues.includes(b.field) ? [k] : [])).slice(0, 5)
const row = (r: (typeof ENC)[number], pick: number, o: { first?: number; ms?: number; stations?: number[]; dwell?: (k: number) => number } = {}) => {
  const st = o.stations ?? read(r)
  return [RS.indexOf(r), 0, pick, o.ms ?? 1000, 1, o.first ?? 1, 0, ...st, ...Array(5 - st.length).fill(-1), ...Array.from({ length: 5 }, (_, k) => (k < r.monsters.length ? (o.dwell ?? (() => 100))(k) : 0))]
}
const play = async (waves: number[][], ai = {} as Record<string, number | null>) =>
  summarize([{ version: await edition(world, rows), level: 1, mode: 0, waves: JSON.stringify(waves) }], ai)

it('reads only results of the current edition and splits human and AI hits by gap case', async () => {
  const r = certain[0]!
  const right = gap(r)
  const waves = JSON.stringify([row(r, right, { dwell: (k) => (k === right ? 500 : 100) }), row(r, (right + 1) % r.monsters.length, { ms: 3000, dwell: (k) => (k === right ? 1500 : 300) })])
  const ai = { [r.id]: right }
  const out = await summarize([
    { version: await edition(world, rows), level: 1, mode: 0, waves },
    { version: 'world:000000000000', level: 1, mode: 0, waves },
  ], ai)
  const typical = typicalOf(ROWS)(ROWS.get(r.monsters[right]!)!)
  expect(out).toMatchObject({ edition: await edition(world, rows), games: 1, otherEditions: 1 })
  expect(out.certain).toEqual({ shown: 2, human: 0.5, ai: 1 })
  expect(out.hardest).toEqual([{ id: r.monsters[right], typical, shown: 2, human: 0.5, ai: 1 }])
  expect(out.patterns).toEqual({ [typical ? 'typical' : 'atypical']: { shown: 2, human: 0.5, ai: 1 } })
  expect(out).not.toHaveProperty('waves')
  expect(out.aim.hit).toMatchObject({ n: 1, ms: 1000, gap: 500, others: 100 })
  expect(out.aim.miss).toMatchObject({ n: 1, ms: 3000, gap: 1500, others: 300 })
  expect(out.peers).toEqual([{ room: r.id, n: 2, enough: false }])
})

it('compares read against unread stations on certain rooms', async () => {
  const r = certain[0]!
  const right = gap(r)
  const wrong = (right + 1) % r.monsters.length
  const [k0, ...rest] = read(r)
  const out = await play([row(r, right, { stations: [k0!] }), row(r, wrong, { stations: [] })])
  const s0 = BINDINGS[k0!]!.station
  expect(out.read[`${s0} read`]).toMatchObject({ shown: 1, human: 1 })
  expect(out.read[`${s0} unread`]).toMatchObject({ shown: 1, human: 0 })
  for (const k of rest) expect(out.read[`${BINDINGS[k]!.station} unread`]).toMatchObject({ shown: 2, human: 0.5 })
})

describe('research summary', () => {
  const lifts = (r: { lift: Record<string, Record<string, Record<string, { lift: number | null }>>> }) =>
    Object.values(r.lift).flatMap((t) => Object.values(t).flatMap((f) => Object.values(f).map((v) => v.lift)))
  const round3 = (x: number) => Math.round(x * 1000) / 1000

  it('counts every research pick and gives every lift 1 when each monster is picked once', async () => {
    const rs = research.slice(0, 3)
    const out = await play(rs.flatMap((r) => r.monsters.map((_, k) => row(r, k))))
    const rel = Object.values(out.research)
    expect(rel.reduce((t, x) => t + x.picks, 0)).toBe(rs.reduce((t, r) => t + r.monsters.length, 0))
    expect(Object.keys(rel[0]!.lift)).toEqual(['evidence', 'gap', 'fields', 'stations'])
    const all = rel.flatMap(lifts)
    expect(all.length).toBeGreaterThan(0)
    expect(all.every((x) => x === 1)).toBe(true)
  })

  it('lifts a gap pick by how rare gap monsters are, reads stations only when read, and counts no research room as a certain room', async () => {
    const r = research.find((x) => x.monsters.some((id) => ROWS.get(id)!.gap) && read(x).length)!
    const pick = gap(r)
    const k = read(r)[0]!
    const out = await play([row(r, pick, { stations: [k] })])
    const res = out.research[r.relation!]!
    expect(res.lift.gap.gap!['true']!.lift).toBe(round3(r.monsters.length / r.monsters.filter((id) => ROWS.get(id)!.gap).length))
    expect(Object.keys(res.lift.stations)).toEqual([BINDINGS[k]!.station])
    expect(JSON.stringify(out.research)).not.toContain('"human"')
    expect([out.certain, out.patterns, out.hardest]).toEqual([null, {}, []])
  })
})
