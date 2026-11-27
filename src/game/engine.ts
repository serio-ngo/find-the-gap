import { BINDINGS, clueOf, gapOf } from './levels/observations.ts'
import type { Binding, Room, Row, World } from './levels/observations.ts'

export type AiPick = { choice: string; probabilities: Record<string, number> }
export type AiRun = { hash: string; model: string; date: string; picks: Record<string, number | null> }
export type Visit = { room: number; pick: number; ms: number }
export type Tally = { you: number; ai: number; aiN: number; chance: number; n: number }

export const rng = (seed: number) => () => {
  seed = (seed + 0x6d2b79f5) | 0
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296
}

export const MODEL = 'd1.1'
export const URL_AI = 'https://api.liquid.ai/decisions/v1/systemone'
export const MAX_MS = 600_000

const QUESTION = 'Each monster is one public gate run, described by its evidence and the clues read in the room. Which monster has the gap? Pick one.'

export const rooms = (w: World): Room[] => w.wings.flatMap((x) => x.suites.flatMap((s) => s.rooms))

export const encounters = (w: World): Room[] => rooms(w).filter((r) => r.monsters.length)

export const rowMap = (rows: Row[]) => new Map(rows.map((r) => [r.id, r]))

export const hit = (rows: Map<string, Row>, room: Room, pick: number) =>
  !!room.relation && pick >= 0 && pick < room.monsters.length && gapOf[room.relation]!(rows.get(room.monsters[pick]!)!.values)

export const chance = (room: Room) => 1 / room.monsters.length

export const scoreOf = (ok: boolean, ms: number) => (ok ? 100 + Math.max(0, Math.round(100 - ms / 100)) : 0)

export const score = (w: World, rows: Map<string, Row>, visits: Visit[]) =>
  visits.reduce((t, v) => {
    const room = rooms(w)[v.room]
    return room?.certain ? t + scoreOf(hit(rows, room, v.pick), v.ms) : t
  }, 0)

const looks = (r: Row) => JSON.stringify(r.context && BINDINGS.map((b) => clueOf(b.field, r.context!)))

export const typicalOf = (rows: Map<string, Row>) => {
  const scored = [...rows.values()].filter((r) => !r.research)
  const base = scored.filter((r) => r.gap).length / scored.length
  const gappy = new Map([...new Set(scored.map(looks))].map((k) => { const s = scored.filter((r) => looks(r) === k); return [k, s.filter((r) => r.gap).length / s.length > base] }))
  return (r: Row) => (gappy.get(looks(r)) ?? false) === r.gap
}

export const report = (w: World, rows: Map<string, Row>, visits: Visit[], ai: AiRun['picks']) => {
  const rs = rooms(w)
  const isTypical = typicalOf(rows)
  const played = visits.flatMap((v) => (rs[v.room]?.certain && v.pick >= 0 ? [{ room: rs[v.room]!, pick: v.pick }] : []))
  const tally = (ps: typeof played): Tally => {
    const asked = ps.filter(({ room }) => typeof ai[room.id] === 'number')
    return {
      you: ps.filter(({ room, pick }) => hit(rows, room, pick)).length,
      ai: asked.filter(({ room }) => hit(rows, room, ai[room.id]!)).length,
      aiN: asked.length,
      chance: ps.reduce((t, { room }) => t + chance(room), 0),
      n: ps.length,
    }
  }
  const split = (want: boolean) => {
    const ps = played.filter(({ room }) => isTypical(rows.get(room.monsters.find((id) => rows.get(id)!.gap)!)!) === want)
    return ps.length ? tally(ps) : null
  }
  return { all: tally(played), typical: split(true), atypical: split(false) }
}

const seen = (row: Row, clues: string[]) =>
  [...row.roles.map((role, i) => `${role} ${row.values[i]}`), ...(row.context ? clues.map((f) => `${f} ${clueOf(f as Binding['field'], row.context!)}`) : [])].join(', ')

export const roomBody = (room: Room, rows: Map<string, Row>): object => ({
  model: MODEL,
  state: { rocks: room.monsters.map((id) => seen(rows.get(id)!, room.clues)) },
  questions: {
    ai: {
      type: 'choice',
      instructions: QUESTION,
      criteria: Object.fromEntries(room.monsters.map((id, i) => [`r${i}`, seen(rows.get(id)!, room.clues)])),
    },
  },
})

export const validate = (ks: string[], answer: AiPick | undefined): AiPick => {
  const p = answer?.probabilities
  if (!answer || !ks.includes(answer.choice)) throw new Error(`bad choice: ${String(answer?.choice)}`)
  if (!p || typeof p !== 'object') throw new Error('missing probabilities')
  const got = Object.keys(p)
  if (got.length !== ks.length || !ks.every((k) => got.includes(k))) throw new Error('probability keys differ from criteria')
  for (const k of ks) if (typeof p[k] !== 'number' || !(p[k] >= 0 && p[k] <= 1)) throw new Error(`probability out of range: ${k}`)
  return { choice: answer.choice, probabilities: Object.fromEntries(ks.map((k) => [k, Math.round(p[k]! * 1000) / 1000])) }
}

export const content = (w: World, rows: Row[]): unknown => {
  const m = rowMap(rows)
  return [MODEL, w, rows, encounters(w).map((r) => roomBody(r, m))]
}

export const canonical = (v: unknown): string =>
  JSON.stringify(v, (_, x) =>
    x && typeof x === 'object' && !Array.isArray(x)
      ? Object.fromEntries(Object.entries(x).sort(([a], [b]) => (a < b ? -1 : 1)))
      : x,
  )
