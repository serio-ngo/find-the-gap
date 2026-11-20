import { describe, expect, it, vi } from 'vitest'
import { aiPick, begin, estimate, shoot, upcoming } from '../../src/game/engine.ts'
import type { AiRun, Mode } from '../../src/game/engine.ts'
import { resultRequest, resultRow, stepRequest } from '../../src/game/net.ts'
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
  for (let spec = upcoming(d, g); spec; spec = upcoming(d, g)) {
    let live = null
    if (mode === 'adaptive' && spec.rule !== 'research') {
      const res = await send('/api/game/step', stepRequest(d, v, 1, spec, g.decisions))
      expect(res.status).toBe(200)
      live = await res.json()
      expect(live).toMatchObject({ ai: 0, hit: 0.8, miss: 0.4 })
    }
    const rule = g.rule
    g = shoot(d, g, g.decisions.length % 2, 2, live ? { hit: live.hit, miss: live.miss } : undefined)
    const x = g.decisions.at(-1)!
    x.ai = live ? live.ai : ai && aiPick(ai, g, g.decisions.length - 1)
    const p = mode === 'adaptive' && x.hit !== null ? (live ? live[x.hit ? 'hit' : 'miss'] : estimate(d, { ...g, rule })) : 0
    waves.push(resultRow(d, x, p, live))
  }
  return { body: resultRequest(v, 1, mode, waves), waves, g }
}

describe('client bodies are accepted by the route', () => {
  it.each([['observations', 'standard'], ['observations', 'adaptive'], ['fixture', 'standard']] as const)('%s %s game', async (name, mode) => {
    const { body, waves, g } = await play(name, mode)
    expect(waves).toHaveLength(g.decisions.length)
    expect(JSON.stringify(body)).toMatch(/^[\d,.[\]{}":a-z-]*$/)
    expect((await send('/api/game/result', body)).status).toBe(204)
    const lie = waves.map((r, i) => (i ? r : [...r.slice(0, 4), g.decisions[0].hit ? 0 : 1, ...r.slice(5)]))
    expect((await send('/api/game/result', { ...body, waves: lie })).status).toBe(400)
  })

  it('wave bodies are integers and the fixture sends no AI pick as -1', async () => {
    const { waves } = await play('fixture', 'standard')
    expect(waves.flat().every(Number.isInteger)).toBe(true)
    expect(waves.every((r) => r[6] === -1 && r[7] === 0)).toBe(true)
  })
})
