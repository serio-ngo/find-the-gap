import { clueOf } from '../src/game/levels/observations.ts'
import type { Binding, Room, Row } from '../src/game/levels/observations.ts'

export const CEILING = 0.65
export const P_FLOOR = 0.05

export const rng = (seed: number) => () => {
  seed = (seed + 0x6d2b79f5) | 0
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296
}

type Part = { wings: { suites: { rooms: Room[] }[] }[]; bindings: Binding[] }

export const gateReport = (world: Part, rows: Row[]) => {
  const byId = new Map(rows.map((r) => [r.id, r]))
  const certain = world.wings.flatMap((w) => w.suites.flatMap((s) => s.rooms)).filter((r) => r.certain)
  const fields = world.bindings.map((b) => b.field)
  const learn = rows.filter((r) => !r.research && r.context)
  const tallies = new Map<string, [number, number]>()
  const key = (f: string, r: Row) => `${r.rule}|${f}|${clueOf(f as Binding['field'], r.context!)}`
  for (const r of learn) for (const f of fields) { const t = tallies.get(key(f, r)) ?? [0, 0]; t[r.gap ? 0 : 1]++; tallies.set(key(f, r), t) }
  const odds = (f: string, r: Row) => { const [g, c] = tallies.get(key(f, r)) ?? [0, 0]; const p = (g + 0.5) / (g + c + 1); return Math.log(p / (1 - p)) }
  const monsters = (room: Room) => room.monsters.map((id) => byId.get(id)!)
  const hit = (room: Room, score: (r: Row) => number, sign: number) => {
    const ss = monsters(room).map((r) => sign * score(r))
    const top = ss.flatMap((s, i) => (s >= Math.max(...ss) - 1e-12 ? [i] : []))
    return top.filter((i) => monsters(room)[i]!.gap).length / top.length
  }
  const mean = (score: (r: Row) => number, sign = 1) => certain.reduce((t, room) => t + hit(room, score, sign), 0) / certain.length
  const sum = (fs: string[]) => (r: Row) => fs.reduce((t, f) => t + odds(f, r), 0)
  const odd = (channel: (r: Row) => string) => {
    const ws = certain.map((room) => ({ s: monsters(room).map(channel), g: monsters(room).findIndex((r) => r.gap) }))
    const score = (w: { s: string[] }, g: number) => {
      const once = w.s.flatMap((x, i) => (w.s.filter((y) => y === x).length === 1 ? [i] : []))
      return once.length === 0 ? 1 / w.s.length : once.includes(g) ? 1 / once.length : 0
    }
    const seen = ws.reduce((t, w) => t + score(w, w.g), 0)
    const r = rng(7)
    const draws = Array.from({ length: 2000 }, () => ws.reduce((t, w) => t + score(w, Math.floor(r() * w.s.length)), 0))
    return Math.min(1, (2 * Math.min(draws.filter((x) => x >= seen).length + 1, draws.filter((x) => x <= seen).length + 1)) / 2001)
  }
  const value = (f: string) => (r: Row) => String(clueOf(f as Binding['field'], r.context!))
  const sides = (f: string, gap: boolean) => new Set(certain.flatMap((room) => monsters(room).filter((r) => r.gap === gap).map(value(f))))
  const placed = world.wings.flatMap((w) => w.suites.flatMap((s) => s.rooms.flatMap((r) => r.monsters)))
  const all = sum(fields)
  const herringIn = (room: Room) => monsters(room).some((r) => !r.gap && all(r) >= all(monsters(room).find((x) => x.gap)!) - 1e-12)
  return {
    fields: Object.fromEntries(fields.map((f) => [f, mean(sum([f]))])),
    reader: mean(all),
    anti: mean(all, -1),
    chance: certain.reduce((t, room) => t + 1 / room.monsters.length, 0) / certain.length,
    herrings: certain.filter(herringIn).length,
    herringRooms: certain.filter(herringIn).map((r) => r.id),
    p: Math.min(odd((r) => fields.map((f) => value(f)(r)).join('|')), ...fields.map((f) => odd(value(f)))),
    mixed: certain.every((room) => monsters(room).every((r) => fields.every((f) => tallies.get(key(f, r))!.every((n) => n > 0)))),
    mirrored: fields.every((f) => { const [yes, no] = [sides(f, true), sides(f, false)]; return yes.size === no.size && [...yes].every((v) => no.has(v)) }),
    reused: placed.length - new Set(placed).size,
  }
}

export const failed = (g: ReturnType<typeof gateReport>) => [
  ...Object.entries(g.fields).filter(([, share]) => share > CEILING).map(([f]) => `field ${f}`),
  ...g.reader > CEILING ? ['reader'] : [],
  ...g.reader < g.chance - 1e-12 ? ['reader floor'] : [],
  ...g.anti > CEILING ? ['anti-reader'] : [],
  ...g.herrings < 2 ? ['herrings'] : [],
  ...g.p < P_FLOOR ? ['permutation'] : [],
  ...g.mixed ? [] : ['mixed'],
  ...g.mirrored ? [] : ['mirrored'],
  ...g.reused ? ['reuse'] : [],
]
