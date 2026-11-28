import { readFileSync } from 'node:fs'
import { pathToFileURL } from 'node:url'
import { hit, rooms, rowMap, typicalOf } from '../src/game/engine.ts'
import { wilson } from '../src/game/stats.ts'
import { edition } from '../src/game/eval/version.ts'
import ai from '../src/game/eval/ai-run.json'
import { BINDINGS, clueOf, place } from '../src/game/levels/observations.ts'
import { rows } from '../src/game/levels/rows.ts'
import { world } from '../src/game/levels/world.ts'

const RS = rooms(world)
const ROWS = rowMap(rows)
const typical = typicalOf(ROWS)
const index = (field: string) => BINDINGS.findIndex((b) => b.field === field)
const station = (field: string) => BINDINGS.find((b) => b.field === field)!.station

type Stat = { shown: number; human: number; ai: number; aiShown: number }
const add = (m: Map<string, Stat>, k: string, human: boolean, ai: boolean | null) => {
  const s = m.get(k) ?? { shown: 0, human: 0, ai: 0, aiShown: 0 }
  s.shown++
  s.human += +human
  if (ai !== null) {
    s.aiShown++
    s.ai += +ai
  }
  m.set(k, s)
}
const rate = (s: Stat) => ({ shown: s.shown, human: s.human / s.shown, ai: s.aiShown ? s.ai / s.aiShown : null })

const median = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b)
  return s.length ? (s[(s.length - 1) >> 1]! + s[s.length >> 1]!) / 2 : null
}

const mean = (xs: number[]) => (xs.length ? xs.reduce((t, x) => t + x, 0) / xs.length : 0)
const ENOUGH = 20
const round3 = (x: number) => Math.round(x * 1000) / 1000
const ratio = (a: number, b: number) => (b ? round3(a / b) : null)

type Tally = Record<string, Record<string, { picks: number; expected: number }>>
const tally = (t: Tally, values: object, rocks: number, picked: boolean) => {
  for (const [f, v] of Object.entries(values)) {
    const s = ((t[f] ??= {})[String(v ?? 'null')] ??= { picks: 0, expected: 0 })
    s.expected += 1 / rocks
    s.picks += +picked
  }
}
const lift = (t: Tally) => Object.fromEntries(Object.entries(t).map(([f, vs]) => [f, Object.fromEntries(Object.entries(vs).map(([v, s]) => [v, { picks: s.picks, expected: round3(s.expected), lift: ratio(s.picks, s.expected) }]))]))

export const summarize = async (stored: { version: string; level: number; mode: number; waves: string }[], picks: Record<string, number | null> = ai.picks) => {
  const current = await edition(world, rows)
  const mine = stored.filter((r) => r.version === current)
  const byPattern = new Map<string, Stat>()
  const byGap = new Map<string, Stat>()
  const byStation = new Map<string, Stat>()
  const peers = new Map<string, number[]>()
  const certain = new Map<string, Stat>()
  const research: Record<string, { picks: number; aim: { visits: number; dwell: number; expected: number }; evidence: Tally; gap: Tally; clues: Tally; read: Tally }> = {}
  const aim: Record<'hit' | 'miss', number[][]> = { hit: [], miss: [] }
  for (const row of mine) {
    for (const [at, , pick, ms, switches, first, , ...rest] of JSON.parse(row.waves) as number[][]) {
      const room = RS[at!]
      if (!room || pick! < 0) continue
      const stations = rest.slice(0, 12).filter((x) => x >= 0)
      const dwell = rest.slice(12)
      const recs = room.monsters.map((id) => ROWS.get(id)!)
      const ok = hit(ROWS, room, pick!)
      const a = picks[room.id]
      const aiHit = typeof a === 'number' ? hit(ROWS, room, a) : null
      const n = recs.length
      const right = recs.findIndex((r) => r.gap)
      if (room.certain) {
        add(certain, 'certain', ok, aiHit)
        const gap = recs[right]!
        add(byPattern, typical(gap) ? 'typical' : 'atypical', ok, aiHit)
        add(byGap, gap.id, ok, aiHit)
        recs.forEach((rec) => place(rec).items.forEach((f) => add(byStation, `${station(f)} ${recs.some((_, o) => stations.includes(o * BINDINGS.length + index(f))) ? 'read' : 'unread'}`, ok, aiHit)))
        aim[ok ? 'hit' : 'miss'].push([ms!, dwell[right]!, mean(dwell.slice(0, n).filter((_, k) => k !== right)), switches!])
      } else {
        const res = (research[room.relation!] ??= { picks: 0, aim: { visits: 0, dwell: 0, expected: 0 }, evidence: {}, gap: {}, clues: {}, read: {} })
        res.picks++
        recs.forEach((rec, k) => {
          const clue = (fields: string[], name: (f: string) => string) => Object.fromEntries(fields.filter(() => rec.context).map((f) => [name(f), clueOf(f as never, rec.context!)]))
          tally(res.evidence, Object.fromEntries(rec.roles.map((r, i) => [r, rec.values[i]])), n, k === pick)
          tally(res.gap, { gap: rec.gap, typical: typical(rec) }, n, k === pick)
          tally(res.clues, clue(place(rec).items, (f) => f), n, k === pick)
          tally(res.read, clue(place(rec).items.filter((f) => recs.some((_, o) => stations.includes(o * BINDINGS.length + index(f)))), station), n, k === pick)
        })
        const gaps = recs.flatMap((r, k) => (r.gap ? [k] : []))
        if (gaps.length) {
          res.aim.visits++
          res.aim.dwell += gaps.reduce((t, g) => t + dwell[g]!, 0)
          res.aim.expected += (dwell.reduce((t, x) => t + x, 0) * gaps.length) / n
        }
      }
      if (first === 1) {
        const c = peers.get(room.id) ?? Array(n).fill(0)
        c[pick!]++
        peers.set(room.id, c)
      }
    }
  }
  return {
    edition: current,
    games: mine.length,
    otherEditions: stored.length - mine.length,
    certain: [...certain.values()].map(rate)[0] ?? null,
    research: Object.fromEntries(Object.entries(research).map(([k, r]) => [k, {
      picks: r.picks,
      aim: { visits: r.aim.visits, dwell: r.aim.dwell, expected: round3(r.aim.expected), lift: ratio(r.aim.dwell, r.aim.expected) },
      lift: { evidence: lift(r.evidence), gap: lift(r.gap), fields: lift(r.clues), stations: lift(r.read) },
    }])),
    aim: Object.fromEntries(Object.entries(aim).map(([k, xs]) => [k, { n: xs.length, ms: median(xs.map((x) => x[0]!)), gap: median(xs.map((x) => x[1]!)), others: median(xs.map((x) => x[2]!)), switches: median(xs.map((x) => x[3]!)) }])),
    read: Object.fromEntries([...byStation].map(([k, s]) => [k, rate(s)])),
    patterns: Object.fromEntries([...byPattern].map(([k, s]) => [k, rate(s)])),
    hardest: [...byGap].map(([id, s]) => ({ id, typical: typical(ROWS.get(id)!), ...rate(s) })).sort((a, b) => a.human - b.human).slice(0, 10),
    peers: [...peers].map(([k, c]) => {
      const n = c.reduce((t, x) => t + x, 0)
      return n < ENOUGH ? { room: k, n, enough: false } : { room: k, n, enough: true, options: c.map((x) => ({ picked: x, share: x / n, ci: wilson(x, n) })) }
    }),
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const out = JSON.parse(readFileSync(0, 'utf8')) as { results: { version: string; level: number; mode: number; waves: string }[] }[]
  console.log(JSON.stringify(await summarize(out.flatMap((o) => o.results)), null, 2))
}
