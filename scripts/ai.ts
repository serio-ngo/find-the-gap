import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { MODEL, canonical, content, encounters, rooms } from '../src/game/engine.ts'
import type { AiRun } from '../src/game/engine.ts'
import { sha256 } from '../src/game/eval/version.ts'
import { rows } from '../src/game/levels/rows.ts'
import type { Row, World } from '../src/game/levels/observations.ts'
import { world } from '../src/game/levels/world.ts'

export const RUN = fileURLToPath(new URL('../src/game/eval/ai-run.json', import.meta.url))

export const hashContent = (w: World, rs: Row[]): Promise<string> => sha256(canonical(content(w, rs)))

export const loadRun = (path: string): AiRun | undefined => {
  try {
    return JSON.parse(readFileSync(path, 'utf8'))
  } catch {
    return undefined
  }
}

export const checkRun = (run: AiRun | undefined, hash: string, w: World): string | null => {
  if (!run) return 'ai run missing: run npm run ai'
  if (run.hash !== hash || run.model !== MODEL) return 'ai run stale: run npm run ai'
  for (const r of encounters(w)) {
    const p = run.picks?.[r.id]
    if (p === undefined) return `ai run incomplete: room ${r.id}`
    if (p !== null && !(Number.isInteger(p) && p >= 0 && p < r.monsters.length)) return `ai run invalid: room ${r.id}`
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
  const picks: AiRun['picks'] = {}
  for (const { id } of encounters(world)) picks[id] = await ask(api, { v: 0, room: rooms(world).findIndex((r) => r.id === id) })
  const run: AiRun = { hash: await hashContent(world, rows), model: MODEL, date: new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Warsaw' }), picks }
  writeFileSync(RUN, JSON.stringify(run, null, 2) + '\n')
  console.log(`rooms ${Object.keys(picks).length}, stable ${Object.values(picks).filter((p) => p !== null).length}`)
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((e) => {
    console.error(e instanceof Error ? e.message : 'failed')
    process.exit(1)
  })
}
