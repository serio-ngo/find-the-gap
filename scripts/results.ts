import { readFileSync } from 'node:fs'
import { pathToFileURL } from 'node:url'
import { canonical, content, wave } from '../src/game/engine.ts'
import type { Deck } from '../src/game/engine.ts'
import { wilson } from '../src/game/stats.ts'
import { digest } from '../src/game/eval/version.ts'
import { decks } from '../src/game/levels/index.ts'
import { ATYPICAL, gapRow, pattern, rowOf, typicality } from '../src/game/levels/observations.ts'
import type { Row } from '../src/game/levels/observations.ts'

// Parameters a run gives from its own values: how many items, how many break the rule, and its pattern.
const params = (r: Row) => {
  const breaks = r.rule === 'odd_revision' ? +(r.values[0] !== r.values[1])
    : r.rule === 'missing_link' ? r.values.filter((v) => v === 'missing').length
    : r.values.filter((v) => r.values.indexOf(v) !== r.values.lastIndexOf(v)).length
  return { arity: r.values.length, breaks, pattern: pattern(r) }
}

// Input: the host's `wrangler d1 execute <db> --json --command "SELECT version, level, mode, waves FROM game_results"` on stdin.

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

// The same id the Worker writes into `version`.
export const edition = (d: Deck) => `${d.id}:${digest(canonical(content(d))).slice(0, 12)}`
const ENOUGH = 20

export const summarize = (rows: { version: string; level: number; mode: number; waves: string }[]) => {
  const d = decks.observations
  const current = edition(d)
  const mine = rows.filter((r) => r.version === current)
  const byRule = new Map<string, Stat>()
  const byPattern = new Map<string, Stat>()
  const byGap = new Map<string, Stat>()
  const peers = new Map<string, number[]>()
  const kind = new Map<string, Stat>()
  const aim: Record<'hit' | 'miss', number[][]> = { hit: [], miss: [] }
  for (const row of mine) {
    const anchors = d.levels.find((l) => l.id === row.level)?.anchors ?? []
    for (const [i, [r, step, seed, pick, , , ai, , , , first, ms, dwell, switches]] of (JSON.parse(row.waves) as number[][]).entries()) {
      const rule = d.rules[r!]?.id
      if (!rule) continue
      const w = wave(d, { rule, step: step!, seed: seed! })
      const right = w.answers[0]!
      const gap = gapRow(w)
      const aiHit = ai === -1 ? null : ai === right
      add(byRule, rule, pick === right, aiHit)
      add(byPattern, `${rule} ${typicality(gap) >= ATYPICAL ? 'typical' : 'atypical'}`, pick === right, aiHit)
      add(byGap, gap.id, pick === right, aiHit)
      add(kind, anchors.includes(i) ? 'certain' : 'research', pick === right, aiHit)
      if (ms !== undefined) aim[pick === right ? 'hit' : 'miss'].push([ms, dwell!, switches!])
      // other players' choices only where everyone saw the same wave for the first time
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
    // certain waves showed a verdict; research waves never did, so their accuracy is the unprompted one
    waves: Object.fromEntries([...kind].map(([k, s]) => [k, rate(s)])),
    aim: Object.fromEntries(Object.entries(aim).map(([k, xs]) => [k, { n: xs.length, ms: median(xs.map((x) => x[0]!)), dwell: median(xs.map((x) => x[1]!)), switches: median(xs.map((x) => x[2]!)) }])),
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
  console.log(JSON.stringify(summarize(out.flatMap((o) => o.results)), null, 2))
}
