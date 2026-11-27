import { describe, expect, it } from 'vitest'
import { chance, encounters, hit, report, roomBody, rooms, rowMap, score, scoreOf, typicalOf } from '../../src/game/engine.ts'
import { rows } from '../../src/game/levels/rows.ts'
import { world } from '../../src/game/levels/world.ts'

const map = rowMap(rows)
const certain = encounters(world).filter((r) => r.certain)
type R = (typeof certain)[number]
const at = (id: string) => rooms(world).findIndex((r) => r.id === id)
const gapSlot = (room: R) => room.monsters.findIndex((id) => map.get(id)!.gap)
const wrong = (room: R) => (gapSlot(room) + 1) % room.monsters.length
const visit = (room: R, pick: number, ms = 0) => ({ room: at(room.id), pick, ms })

describe('engine', () => {
  it('looks a room up by flat index and hits the one gap of a certain room', () => {
    for (const room of certain) {
      expect(rooms(world)[at(room.id)]).toBe(room)
      expect(gapSlot(room)).toBeGreaterThanOrEqual(0)
      room.monsters.forEach((_, i) => expect(hit(map, room, i)).toBe(i === gapSlot(room)))
      expect(hit(map, room, -1)).toBe(false)
      expect(chance(room)).toBe(1 / room.monsters.length)
    }
  })

  it('scores a hit 100 plus up to 100 for speed, and a miss nothing', () => {
    expect(scoreOf(true, 0)).toBe(200)
    expect(scoreOf(true, 5000)).toBe(150)
    expect(scoreOf(true, 99_000)).toBe(100)
    expect(scoreOf(false, 0)).toBe(0)
    const [a, b] = certain as [R, R]
    expect(score(world, map, [visit(a, gapSlot(a)), visit(b, wrong(b))])).toBe(200)
  })

  it('scores only certain rooms', () => {
    const other = encounters(world).find((r) => !r.certain)!
    expect(score(world, map, [{ room: at(other.id), pick: 0, ms: 0 }])).toBe(0)
  })

  it('report compares you, the stored AI and chance on the certain rooms played', () => {
    const [a, b, c] = certain as [R, R, R]
    const ai = { [a.id]: wrong(a), [b.id]: gapSlot(b), [c.id]: gapSlot(c) }
    const out = report(world, map, [visit(a, gapSlot(a)), visit(b, wrong(b)), visit(c, -1)], ai)
    expect(out.all).toEqual({ you: 1, ai: 1, aiN: 2, chance: chance(a) + chance(b), n: 2 })
    const isTypical = typicalOf(map)
    const gapOf = (r: R) => map.get(r.monsters[gapSlot(r)]!)!
    const side = (want: boolean) => [a, b].filter((r) => isTypical(gapOf(r)) === want).length
    expect(out.typical?.n ?? 0).toBe(side(true))
    expect(out.atypical?.n ?? 0).toBe(side(false))
    expect((out.typical?.n ?? 0) + (out.atypical?.n ?? 0)).toBe(2)
    expect(report(world, map, [], ai)).toEqual({ all: { you: 0, ai: 0, aiN: 0, chance: 0, n: 0 }, typical: null, atypical: null })
  })

  it('the AI body carries evidence and clues, never the gap', () => {
    for (const room of encounters(world)) {
      const body = roomBody(room, map) as { questions: { ai: { criteria: object } } }
      const text = JSON.stringify(body)
      for (const k of ['"gap"', '"if_hit"', '"if_miss"']) expect(text).not.toContain(k)
      expect(Object.keys(body.questions.ai.criteria)).toHaveLength(room.monsters.length)
    }
  })
})
