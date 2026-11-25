import { readFileSync } from 'node:fs'
import { pathToFileURL } from 'node:url'
import { wave } from '../src/game/engine.ts'
import { objectsFor } from '../src/game/objects.ts'
import { wilson } from '../src/game/stats.ts'
import { edition } from '../src/game/eval/version.ts'
import { decks } from '../src/game/levels/index.ts'
import { ATYPICAL, gapRow, pattern, rowOf, typicality } from '../src/game/levels/observations.ts'
import type { Row } from '../src/game/levels/observations.ts'

const params = (r: Row) => {
  const breaks = r.rule === 'odd_revision' ? +(r.values[0] !== r.values[1])
    : r.rule === 'missing_link' ? r.values.filter((v) => v === 'missing').length
    : r.values.filter((v) => r.values.indexOf(v) !== r.values.lastIndexOf(v)).length
  return { arity: r.values.length, breaks, pattern: pattern(r) }
}


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

export const summarize = async (rows: { version: string; level: number; mode: number; waves: string }[]) => {
  const d = decks.observations
  const current = await edition(d)
  const mine = rows.filter((r) => r.version === current)
  const byRule = new Map<string, Stat>()
  const byPattern = new Map<string, Stat>()
  const byGap = new Map<string, Stat>()
  const peers = new Map<string, number[]>()
  const seen = new Set<string>()
  const certain = new Map<string, Stat>()
  const research: Record<string, { picks: number; waves: Record<number, number>; aim: { waves: number; dwell: number; expected: number }; drawn: Tally; data: Tally }> = {}
  const aim: Record<'hit' | 'miss', number[][]> = { hit: [], miss: [] }
  for (const row of mine) {
    for (const [r, step, seed, pick, , , ai, , , , first, ms, switches, isCertain, ...dwell] of JSON.parse(row.waves) as number[][]) {
      const rule = d.rules[r!]?.id
      if (!rule) continue
      const w = wave(d, { rule, step: step!, seed: seed! })
      const hit = w.answers.includes(pick!)
      const aiHit = ai === -1 ? null : w.answers.includes(ai!)
      if (isCertain) {
        add(byRule, rule, hit, aiHit)
        add(certain, 'certain', hit, aiHit)
        if (w.answers.length === 1) {
          const right = w.answers[0]!
          const gap = gapRow(w)
          add(byPattern, `${rule} ${typicality(gap) >= ATYPICAL ? 'typical' : 'atypical'}`, hit, aiHit)
          add(byGap, gap.id, hit, aiHit)
          if (ms !== undefined) aim[hit ? 'hit' : 'miss'].push([ms, dwell[right]!, mean(dwell.filter((_, k) => k !== right)), switches!])
        }
      } else {
        const res = (research[rule] ??= { picks: 0, waves: {}, aim: { waves: 0, dwell: 0, expected: 0 }, drawn: {}, data: {} })
        const objects = objectsFor(d, w)
        res.picks++
        if (!seen.has(`${rule}:${step}:${seed}`)) res.waves[w.answers.length] = (res.waves[w.answers.length] ?? 0) + 1
        seen.add(`${rule}:${step}:${seed}`)
        objects.forEach((o, k) => {
          const rec = rowOf(w.ids![k]!)
          const { arity, breaks } = params(rec)
          tally(res.drawn, o.shape.facts, objects.length, k === pick)
          tally(res.data, { gap: rec.gap, arity, breaks, locks: rec.context?.locks, job: rec.context?.job, share: rec.context?.share, impacts: rec.context?.impacts, agent: rec.context?.agent }, objects.length, k === pick)
        })
        if (ms !== undefined && w.answers.length) {
          res.aim.waves++
          res.aim.dwell += w.answers.reduce((t, a) => t + dwell[a]!, 0)
          res.aim.expected += (dwell.reduce((t, x) => t + x, 0) * w.answers.length) / objects.length
        }
      }
      if (row.mode === 0 && first === 1) {
        const k = `${row.level}:${rule}:${step}:${seed}`
        const c = peers.get(k) ?? w.symbols.map(() => 0)
        c[pick!]!++
        peers.set(k, c)
      }
    }
  }
  return {
    edition: current,
    games: mine.length,
    otherEditions: rows.length - mine.length,
    rules: Object.fromEntries([...byRule].map(([k, s]) => [k, rate(s)])),
    certain: [...certain.values()].map(rate)[0] ?? null,
    research: Object.fromEntries(Object.entries(research).map(([k, r]) => [k, {
      picks: r.picks,
      waves: r.waves,
      aim: { waves: r.aim.waves, dwell: r.aim.dwell, expected: round3(r.aim.expected), lift: ratio(r.aim.dwell, r.aim.expected) },
      lift: { drawn: lift(r.drawn), data: lift(r.data) },
    }])),
    aim: Object.fromEntries(Object.entries(aim).map(([k, xs]) => [k, { n: xs.length, ms: median(xs.map((x) => x[0]!)), gap: median(xs.map((x) => x[1]!)), others: median(xs.map((x) => x[2]!)), switches: median(xs.map((x) => x[3]!)) }])),
    patterns: Object.fromEntries([...byPattern].map(([k, s]) => [k, rate(s)])),
    hardest: [...byGap].map(([id, s]) => ({ id, ...params(rowOf(id)), typicality: typicality(rowOf(id)), ...rate(s) }))
      .sort((a, b) => a.human - b.human).slice(0, 10),
    peers: [...peers].map(([k, c]) => {
      const n = c.reduce((t, x) => t + x, 0)
      return n < ENOUGH ? { wave: k, n, enough: false } : { wave: k, n, enough: true, options: c.map((x) => ({ picked: x, share: x / n, ci: wilson(x, n) })) }
    }),
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const out = JSON.parse(readFileSync(0, 'utf8')) as { results: { version: string; level: number; mode: number; waves: string }[] }[]
  console.log(JSON.stringify(await summarize(out.flatMap((o) => o.results)), null, 2))
}
