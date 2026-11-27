import { describe, expect, it, vi } from 'vitest'
import { MAX_MS, encounters, rooms } from '../../src/game/engine.ts'
import { boardRequest, resultRequest, visitRow } from '../../src/game/net.ts'
import type { VisitRecord } from '../../src/game/net.ts'
import { rows } from '../../src/game/levels/rows.ts'
import { world } from '../../src/game/levels/world.ts'
import { readCodes } from './route-env.ts'
import { edition } from '../../src/game/eval/version.ts'
import { route } from '../../src/game/worker/route.ts'
import type { GameEnv } from '../../src/game/worker/route.ts'

const ORIGIN = 'https://example.org'
const env: GameEnv = {
  DB: {
    prepare: (sql: string) => ({ bind: () => ({ first: async <T,>() => (sql.includes('game_use') ? { n: 1 } : null) as T | null, run: async () => {}, all: async <T,>() => ({ results: [] as T[] }) }) }),
  },
  LIMIT: { limit: async () => ({ success: true }) },
  KEY: 'k',
}
vi.stubGlobal('fetch', async (_u: string, init: RequestInit) => {
  const ks = Object.keys(JSON.parse(init.body as string).questions.ai.criteria)
  return new Response(JSON.stringify({ answers: { ai: { choice: 'r0', probabilities: Object.fromEntries(ks.map((k) => [k, 1 / ks.length])) } } }))
})

const send = (path: string, body: unknown) =>
  route(new Request(ORIGIN + path, { method: 'POST', body: JSON.stringify(body), headers: { origin: ORIGIN } }), env, { waitUntil() {} })

const RS = rooms(world)
const ENC = encounters(world)
const record = (room: (typeof ENC)[number], route: number): VisitRecord => ({
  room: RS.indexOf(room), route, pick: room.monsters.length - 1, ms: 2345.6, switches: 3, first: true, doors: 0,
  stations: readCodes(room), dwell: room.monsters.map(() => 812.4),
})
const played = ENC.map((r, i) => visitRow(record(r, i)))

describe('client bodies are accepted by the route', () => {
  it('a full run is accepted as a result and a board entry, and asks the model for every room', async () => {
    const body = resultRequest(played, await edition(world, rows))
    expect(JSON.stringify(body)).toMatch(/^[\d,[\]{}":a-z-]*$/)
    expect((await send('/api/game/result', body)).status).toBe(204)
    expect((await send('/api/game/board', boardRequest(played, body.edition, 'Ada', false))).status).toBe(200)
    for (const r of ENC) expect(await (await send('/api/game/step', { v: 0, room: RS.indexOf(r) })).json()).toMatchObject({ ai: 0 })
  })

  it('a worst-case body stays under the byte limit', async () => {
    const x = visitRow({ ...record(ENC[0]!, 99), ms: MAX_MS * 2, switches: 999, stations: [4, 3, 2, 1, 0], dwell: Array(4).fill(MAX_MS * 2) })
    const body = boardRequest(ENC.map(() => x), await edition(world, rows), 'x'.repeat(20), true)
    expect(JSON.stringify(body).length).toBeLessThan(8192)
  })

  it('visit rows are 17 integers, padded, clamped and match what the route reads', () => {
    expect(played.every((r) => r.length === 23 && r.every(Number.isInteger))).toBe(true)
    const r = visitRow({ room: 3, route: 0, pick: -1, ms: 1e9, switches: 500, first: false, doors: 2, stations: [1], dwell: [5.4, 6] })
    expect(r).toEqual([3, 0, -1, MAX_MS, 99, 0, 2, 1, ...Array(11).fill(-1), 5, 6, 0, 0])
  })
})
