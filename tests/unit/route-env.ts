import { vi } from 'vitest'
import { route } from '../../src/game/worker/route.ts'
import type { GameEnv } from '../../src/game/worker/route.ts'

export const FIXTURE = 1
export const ORIGIN = 'https://example.org'

export const fakeEnv = (over: Partial<GameEnv> = {}) => {
  const cache = new Map<string, { body: string; created: number }>()
  const use = { step: 0, result: 0 }
  const results: unknown[][] = []
  const deleted: string[] = []
  const fail = { delete: false }
  const env: GameEnv = {
    DB: {
      prepare: (sql: string) => ({
        bind: (...v: unknown[]) => ({
          first: async () =>
            (sql.includes('game_use')
              ? { n: (use[sql.includes('(day, step)') ? 'step' : 'result'] += v[1] as number) }
              : cache.get(v[0] as string) ?? null) as any,
          run: async () => {
            if (sql.startsWith('DELETE')) {
              if (fail.delete) throw new Error('d1')
              deleted.push(v[0] as string)
            }
            else if (sql.includes('game_cache')) cache.set(v[0] as string, { body: v[1] as string, created: v[2] as number })
            else results.push(v)
          },
        }),
      }),
    },
    LIMIT: { limit: async () => ({ success: true }) },
    KEY: 'k',
    ...over,
  }
  return { env, cache, results, use, deleted, fail }
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

export const stepReq = { v: FIXTURE, level: 1, mode: 0, wave: [0, 2, 1], past: [[0, 1, 0, 0, 1]] }
export const liquid = {
  answers: {
    ai: { choice: 'r1', probabilities: { r0: 0.1, r1: 0.62, r2: 0.18, r3: 0.05, r4: 0.05 } },
    if_hit: { choice: 'hit', probabilities: { hit: 0.83, miss: 0.17 } },
    if_miss: { choice: 'miss', probabilities: { hit: 0.41, miss: 0.59 } },
  },
}
export const stubFetch = (impl?: (...a: any[]) => any) => {
  const f = vi.fn(impl ?? (async () => new Response(JSON.stringify(liquid))))
  vi.stubGlobal('fetch', f)
  return f
}
