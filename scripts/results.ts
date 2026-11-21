import { readFileSync } from 'node:fs'
import { pathToFileURL } from 'node:url'
import { canonical, content, wave } from '../src/game/engine.ts'
import type { Deck } from '../src/game/engine.ts'
import { digest } from '../src/game/eval/version.ts'
import { decks } from '../src/game/levels/index.ts'
import { ATYPICAL, gapRow, params, rowOf, typicality } from '../src/game/levels/observations.ts'

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

// 95% Wilson interval for k of n
export const wilson = (k: number, n: number): [number, number] => {
  const z = 1.96
  const p = k / n
  const d = 1 + (z * z) / n
  const c = (p + (z * z) / (2 * n)) / d
  const h = (z * Math.sqrt((p * (1 - p)) / n + (z * z) / (4 * n * n))) / d
  return [Math.max(0, c - h), Math.min(1, c + h)]
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
  for (const row of mine) {
    for (const [r, step, seed, pick, , , ai, , , , first] of JSON.parse(row.waves) as number[][]) {
      const rule = d.rules[r!]?.id
      if (!rule) continue
      const w = wave(d, { rule, step: step!, seed: seed! })
      const right = w.answers[0]!
      const gap = gapRow(w)
      const aiHit = ai === -1 ? null : ai === right
      add(byRule, rule, pick === right, aiHit)
      add(byPattern, `${rule} ${typicality(gap) >= ATYPICAL ? 'typical' : 'atypical'}`, pick === right, aiHit)
      add(byGap, gap.id, pick === right, aiHit)
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
