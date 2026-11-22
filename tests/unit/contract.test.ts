import { describe, expect, it, vi } from 'vitest'
import { aiPick, begin, estimate, shoot, upcoming, wave } from '../../src/game/engine.ts'
import type { AiRun, Mode } from '../../src/game/engine.ts'
import { asks, resultRequest, resultRow, stepRequest } from '../../src/game/net.ts'
import { decks } from '../../src/game/levels/index.ts'
import run from '../../src/game/eval/ai-run.json'
import { route } from '../../src/game/worker/route.ts'
import type { GameEnv } from '../../src/game/worker/route.ts'

const ORIGIN = 'https://example.org'
const env: GameEnv = {
  DB: {
    prepare: (sql: string) => ({ bind: () => ({ first: async <T,>() => (sql.includes('game_use') ? { n: 1 } : null) as T | null, run: async () => {} }) }),
  },
  LIMIT: { limit: async () => ({ success: true }) },
  KEY: 'k',
}
// a valid Liquid answer for however many rocks the posted state has
vi.stubGlobal('fetch', async (_u: string, init: RequestInit) => {
  const ks = JSON.parse(init.body as string).state.rocks.map((_: unknown, i: number) => `r${i}`)
  const probabilities = Object.fromEntries(ks.map((k: string) => [k, 1 / ks.length]))
  return new Response(JSON.stringify({ answers: {
    ai: { choice: 'r0', probabilities },
    if_hit: { choice: 'hit', probabilities: { hit: 0.8, miss: 0.2 } },
    if_miss: { choice: 'miss', probabilities: { hit: 0.4, miss: 0.6 } },
  } }))
})

const send = (path: string, body: unknown) =>
  route(new Request(ORIGIN + path, { method: 'POST', body: JSON.stringify(body), headers: { origin: ORIGIN } }), env, { waitUntil() {} })

// plays one whole game the way Game.astro does, posting every body it would build
const play = async (name: 'observations' | 'fixture', mode: Mode) => {
  const d = decks[name]!
  const v = Object.values(decks).indexOf(d)
  const ai = d.question ? (run as AiRun) : undefined
  let g = begin(d, 1, mode)
  const waves: number[][] = []
  let asked = 0
  for (let spec = upcoming(d, g); spec; spec = upcoming(d, g)) {
    let live = null
    if (asks(d, g, g.decisions.length)) {
      asked++
      const res = await send('/api/game/step', stepRequest(d, v, 1, spec, g.decisions))
      expect(res.status).toBe(200)
      live = await res.json()
      expect(live).toMatchObject({ ai: 0, hit: 0.8, miss: 0.4 })
    }
    const rule = g.rule
    g = shoot(d, g, g.decisions.length % 2, 2, live ? { hit: live.hit, miss: live.miss } : undefined)
    const x = g.decisions.at(-1)!
    x.ai = live ? live.ai : ai && aiPick(ai, d, g, g.decisions.length - 1)
    const p = mode === 'adaptive' ? (live ? live[x.hit ? 'hit' : 'miss'] : estimate(d, { ...g, rule })) : 0
    waves.push(resultRow(d, x, p, live, true, { ms: 2345.6, dwell: wave(d, spec).symbols.map(() => 812), switches: 3 }))
  }
  return { body: resultRequest(v, 1, mode, waves), waves, g, asked }
}

describe('client bodies are accepted by the route', () => {
  it.each([['observations', 'standard'], ['observations', 'adaptive'], ['fixture', 'standard']] as const)('%s %s game', async (name, mode) => {
    const { body, waves, g, asked } = await play(name, mode)
    expect(asked).toBe(mode === 'adaptive' ? 4 : 0)
    expect(waves).toHaveLength(g.decisions.length)
    expect(JSON.stringify(body)).toMatch(/^[\d,.[\]{}":a-z-]*$/)
    expect((await send('/api/game/result', body)).status).toBe(204)
    const lie = waves.map((r, i) => (i ? r : [...r.slice(0, 4), g.decisions[0].hit ? 0 : 1, ...r.slice(5)]))
    expect((await send('/api/game/result', { ...body, waves: lie })).status).toBe(400)
  })

  it('a worst-case body stays under the byte limit', () => {
  const d = decks.observations!
  const x = { spec: d.levels[0]!.sequence[0]!, pick: 6, hit: true, anchor: true, secs: 9 }
  const row = resultRow(d, x, 1, { ai: 6, hit: 1, miss: 1, cached: true }, true, { ms: 99_999, dwell: Array(7).fill(99_999), switches: 99 })
  expect(JSON.stringify(resultRequest(0, 1, 'adaptive', Array(21).fill(row))).length).toBeLessThan(4096)
})

it('wave bodies are integers and the fixture sends no AI pick as -1', async () => {
    const { waves, g } = await play('fixture', 'standard')
    expect(waves.flat().every(Number.isInteger)).toBe(true)
    expect(waves.every((r, i) => r[6] === -1 && r[7] === 0 && r[10] === 1 && r[11] === 2346 && r[12] === 3 && r[13] === +g.decisions[i]!.anchor && r.slice(14).every((x) => x === 812))).toBe(true)
  })
})
