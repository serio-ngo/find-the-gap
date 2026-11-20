import { readFileSync } from 'node:fs'
import { pathToFileURL } from 'node:url'
import { wave } from '../src/game/engine.ts'
import { decks } from '../src/game/levels/index.ts'

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

export const summarize = (rows: { waves: string }[]) => {
  const d = decks.observations!
  const byRule = new Map<string, Stat>()
  const byGap = new Map<string, Stat>()
  for (const row of rows) {
    for (const [r, step, seed, pick, , , ai] of JSON.parse(row.waves) as number[][]) {
      const rule = d.rules[r!]?.id
      if (!rule) continue
      const w = wave(d, { rule, step: step!, seed: seed! })
      const right = w.answers[0]!
      add(byRule, rule, pick === right, ai === -1 ? null : ai === right)
      add(byGap, w.ids![right]!, pick === right, ai === -1 ? null : ai === right)
    }
  }
  const rate = (s: Stat) => ({ shown: s.shown, human: s.human / s.shown, ai: s.aiShown ? s.ai / s.aiShown : null })
  return {
    rules: Object.fromEntries([...byRule].map(([k, s]) => [k, rate(s)])),
    hardest: [...byGap].map(([id, s]) => ({ id, ...rate(s) })).sort((a, b) => a.human - b.human).slice(0, 10),
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const out = JSON.parse(readFileSync(0, 'utf8')) as { results: { waves: string }[] }[]
  console.log(JSON.stringify(summarize(out.flatMap((o) => o.results)), null, 2))
}
