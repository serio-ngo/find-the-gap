import { describe, expect, it } from 'vitest'
import { failed, gateReport } from '../../scripts/gates.ts'
import { BINDINGS, place } from '../../src/game/levels/observations.ts'
import type { Room, Row } from '../../src/game/levels/observations.ts'
import { rows as real } from '../../src/game/levels/rows.ts'
import { world } from '../../src/game/levels/world.ts'

const row = (id: string, gap: boolean, job: string): Row => ({
  id, rule: 'odd_revision', roles: [], values: [], gap, research: false, run: '',
  context: { locks: 0, impacts: 0, agent: 0, job, share: 1, tests: 1, criteria: 1 },
})
const room = (id: string, ...monsters: Row[]): Room => ({ id, cell: [0, 0], monsters: monsters.map((m) => m.id), certain: true, herring: false, stage: [], clues: [] })
const check = (rooms: Room[], rows: Row[]) => gateReport({ wings: [{ suites: [{ rooms }] }], bindings: BINDINGS }, rows)

describe('gates catch a context leak and a gap reuse', () => {
  const gaps = Array.from({ length: 4 }, (_, i) => row(`g${i}`, true, 'success'))
  const controls = Array.from({ length: 8 }, (_, i) => row(`c${i}`, false, 'failure'))
  const rows = [...gaps, ...controls]
  const rooms = gaps.map((g, i) => room(`t${i}`, g, controls[2 * i]!, controls[2 * i + 1]!))

  it('blocks a clue that points at the gap in every certain room', () => {
    const g = check(rooms, rows)
    expect(g.fields.job).toBe(1)
    expect(g.reader).toBe(1)
    expect(g.herrings).toBe(0)
    expect(g.mixed).toBe(false)
    expect(g.mirrored).toBe(false)
    expect(failed(g)).toEqual(expect.arrayContaining(['field job', 'reader', 'herrings', 'mixed', 'mirrored']))
  })

  it('blocks a clue that points away from the gap in every certain room', () => {
    const away = [
      ...gaps.map((g) => row(g.id, true, 'failure')), ...controls.map((c) => row(c.id, false, 'success')),
      ...Array.from({ length: 12 }, (_, i) => row(`x${i}`, true, 'success')), ...Array.from({ length: 20 }, (_, i) => row(`y${i}`, false, 'failure')),
    ]
    const g = check(rooms, away)
    expect([g.reader, g.anti, g.chance]).toEqual([0, 1, 1 / 3])
    expect(failed(g)).toEqual(expect.arrayContaining(['reader floor', 'anti-reader']))
  })

  it('counts a row placed twice', () => {
    expect(check([...rooms, room('again', gaps[0]!, controls[0]!, controls[1]!)], rows).reused).toBe(3)
  })

  it('catches a place that reads the gap and never reads it itself', () => {
    const leaky = rows.map((r) => r.gap ? { ...r, context: { ...r.context!, share: 1, locks: 0, impacts: 0 } } : { ...r, context: { ...r.context!, share: 0.5, locks: 3, impacts: 0 } })
    expect(failed(check(rooms, leaky))).toEqual(expect.arrayContaining(['field y']))
    const r = controls[0]!
    expect(place({ ...r, gap: true })).toEqual(place(r))
  })

  it('passes on the committed world, whose clues never make the gap obvious', () => {
    const g = gateReport(world, real)
    expect(failed(g)).toEqual([])
    expect(g.herrings).toBeGreaterThanOrEqual(2)
    expect(g.reader).toBeGreaterThanOrEqual(g.chance)
    expect(g.anti).toBeLessThanOrEqual(0.65)
  })
})
