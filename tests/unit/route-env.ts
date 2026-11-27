import { vi } from 'vitest'
import { encounters, rooms, rowMap } from '../../src/game/engine.ts'
import { edition } from '../../src/game/eval/version.ts'
import { BINDINGS, place } from '../../src/game/levels/observations.ts'
import { rows } from '../../src/game/levels/rows.ts'
import { world } from '../../src/game/levels/world.ts'
import { route } from '../../src/game/worker/route.ts'
import type { GameEnv } from '../../src/game/worker/route.ts'

export const RS = rooms(world)
export const ENC = encounters(world)
export const CERTAIN = ENC.filter((r) => r.certain)
export const ROWS = rowMap(rows)
export const ED = await edition(world, rows)
export const gapSlot = (room: (typeof ENC)[number]) => room.monsters.findIndex((id) => ROWS.get(id)!.gap)
export const readCodes = (room: (typeof ENC)[number]) =>
  room.monsters.flatMap((id, m) => place(ROWS.get(id)!).items.map((f) => m * BINDINGS.length + BINDINGS.findIndex((b) => b.field === f)))
export const visitRow = (room: (typeof ENC)[number], i: number, pick = gapSlot(room), ms = 2345) => {
  const read = readCodes(room).slice(0, 12)
  return [RS.indexOf(room), i, pick, ms, 3, 1, 0, ...read, ...Array(12 - read.length).fill(-1), ...Array.from({ length: 4 }, (_, k) => (k < room.monsters.length ? 812 : 0))]
}
export const visits = (rooms = ENC, pick?: (r: (typeof ENC)[number]) => number) => rooms.map((r, i) => visitRow(r, i, pick?.(r)))
export const resultBody = (v: number[][], edition = ED) => ({ v: 0, level: 1, visits: v, edition })
export const allRooms = (pick?: (r: (typeof ENC)[number]) => number) => visits([...CERTAIN, ...ENC.filter((r) => !r.certain)], pick)
export const ORIGIN = 'https://example.org'

export const fakeEnv = (over: Partial<GameEnv> = {}) => {
  const cache = new Map<string, { body: string; created: number }>()
  const use = { step: 0, result: 0 }
  const results: unknown[][] = []
  const board: { version: string; level: number; mode: number; name: string; score: number }[] = []
  const mine = (v: unknown[]) => board.filter((x) => x.version === v.at(-3) && x.level === v.at(-2) && x.mode === v.at(-1))
  const deleted: string[] = []
  const fail = { delete: false }
  const env: GameEnv = {
    DB: {
      prepare: (sql: string) => ({
        bind: (...v: unknown[]) => ({
          all: async () => ({ results: board.filter((x) => x.version === v[0] && x.level === v[1] && x.mode === v[2]).sort((a, b) => b.score - a.score).slice(0, v[3] as number) as any[] }),
          first: async () =>
            (sql.includes('COUNT(*)')
              ? { n: mine(v).length, below: mine(v).filter((x) => x.score < (v[0] as number)).length }
              : sql.includes('game_use')
              ? { n: (use[sql.includes('(day, step)') ? 'step' : 'result'] += v[1] as number) }
              : cache.get(v[0] as string) ?? null) as any,
          run: async () => {
            if (sql.startsWith('DELETE')) {
              if (fail.delete) throw new Error('d1')
              deleted.push(v[0] as string)
            }
            else if (sql.includes('game_cache')) cache.set(v[0] as string, { body: v[1] as string, created: v[2] as number })
            else if (sql.includes('game_board')) board.push({ version: v[1] as string, level: v[2] as number, mode: v[3] as number, name: v[4] as string, score: v[5] as number })
            else results.push(v)
          },
        }),
      }),
    },
    LIMIT: { limit: async () => ({ success: true }) },
    KEY: 'k',
    ...over,
  }
  return { env, cache, results, use, deleted, fail, board }
}

export const send = async (path: string, body: unknown, env: GameEnv, headers: Record<string, string> = {}) => {
  const pending: Promise<unknown>[] = []
  const req = new Request(ORIGIN + path, {
    method: 'POST',
    body: typeof body === 'string' ? body : JSON.stringify(body),
    headers: { origin: ORIGIN, 'cf-connecting-ip': '1.2.3.4', ...headers },
  })
  const res = await route(req, env, { waitUntil: (p) => void pending.push(p) })
  await Promise.all(pending)
  return res
}

export const stepReq = { v: 0, room: RS.indexOf(ENC[0]!) }
export const odds = (n: number, choice: string) => ({ answers: { ai: { choice, probabilities: Object.fromEntries(Array.from({ length: n }, (_, i) => [`r${i}`, i === +choice.slice(1) ? 0.6 : 0.4 / (n - 1)])) } } })
export const liquid = odds(ENC[0]!.monsters.length, 'r1')
export const stubFetch = (impl?: (...a: any[]) => any) => {
  const f = vi.fn(impl ?? (async () => new Response(JSON.stringify(liquid))))
  vi.stubGlobal('fetch', f)
  return f
}
