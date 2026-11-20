import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { MODEL, canonical, content, wave } from '../src/game/engine.ts'
import type { AiRun, Deck, Decision } from '../src/game/engine.ts'
import { digest } from '../src/game/eval/version.ts'
import { decks } from '../src/game/levels/index.ts'
import { stepRequest } from '../src/game/net.ts'

export const RUN = fileURLToPath(new URL('../src/game/eval/ai-run.json', import.meta.url))

export const hashContent = (d: Deck): string => digest(canonical(content(d)))

export type Job = { level: number; index: number; past: Decision[] }

export const jobsFor = (d: Deck): Job[] =>
  d.levels.flatMap(({ id, sequence, anchors }) => {
    const played = sequence.map((spec, i): Decision => {
      const w = wave(d, spec)
      return { spec, pick: w.answers[0] ?? 0, hit: spec.rule === 'research' ? null : true, anchor: anchors.includes(i), secs: 5 }
    })
    return sequence.map((_, index) => ({ level: id, index, past: played.slice(0, index) }))
  })

export const loadRun = (path: string): AiRun | undefined => {
  try {
    return JSON.parse(readFileSync(path, 'utf8'))
  } catch {
    return undefined
  }
}

export const checkRun = (run: AiRun | undefined, hash: string, d: Deck): string | null => {
  if (!run) return 'ai run missing: run npm run ai'
  if (run.hash !== hash || run.model !== MODEL) return 'ai run stale: run npm run ai'
  for (const l of d.levels) {
    const picks = run.standard?.[l.id]
    if (!Array.isArray(picks) || picks.length !== l.sequence.length) return `ai run incomplete: level ${l.id}`
    for (const [i, p] of picks.entries()) {
      if (p !== null && !(Number.isInteger(p) && p >= 0 && p < wave(d, l.sequence[i]!).symbols.length)) return `ai run invalid: level ${l.id}, wave ${i + 1}`
    }
  }
  return null
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

export const ask = async (api: string, body: unknown, wait = sleep): Promise<number | null> => {
  for (let i = 0; i < 12; i++) {
    const r = await fetch(`${api}/step`, {
      method: 'POST',
      headers: { origin: new URL(api).origin, 'content-type': 'application/json' },
      body: JSON.stringify(body),
    }).catch(() => null)
    if (!r) throw new Error(`no Worker at ${api}: start the host with npm run dev`)
    if (r.ok) {
      const a = (await r.json()) as { ai?: number | null; fallback?: boolean }
      if (!a.fallback) return a.ai ?? null
    } else if (r.status !== 429) throw new Error(`HTTP ${r.status}`)
    await wait(r.status === 429 ? 10000 : 2000)
  }
  throw new Error('the Worker answers only with a fallback: check its model key')
}

const main = async () => {
  const api = process.env.GAME_API ?? 'http://localhost:4321/api/game'
  const d = decks.observations
  const v = Object.values(decks).indexOf(d)
  const standard: AiRun['standard'] = {}
  for (const { level, index, past } of jobsFor(d)) {
    const spec = d.levels.find((l) => l.id === level)!.sequence[index]!
    ;(standard[level] ??= [])[index] = await ask(api, stepRequest(d, v, level, spec, past))
  }
  const run: AiRun = { hash: hashContent(d), model: MODEL, date: new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Warsaw' }), standard }
  writeFileSync(RUN, JSON.stringify(run, null, 2) + '\n')
  const picks = Object.values(standard).flat()
  console.log(`waves ${picks.length}, stable ${picks.filter((p) => p !== null).length}`)
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((e) => {
    console.error(e instanceof Error ? e.message : 'failed')
    process.exit(1)
  })
}
