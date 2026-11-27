import { afterEach, expect, it, vi } from 'vitest'
import { CERTAIN, fakeEnv, resultBody, send, stepReq, stubFetch, visits } from './route-env.ts'

const DAY = 86_400_000
const KEEP = 365 * DAY
const result = resultBody(visits(CERTAIN))
const on = (n: number) => vi.useFakeTimers({ toFake: ['Date'], now: Date.UTC(2031, 0, n) })
afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

it('a result drops cache, result and leaderboard rows older than a year, once a day', async () => {
  on(1)
  const { env, deleted } = fakeEnv()
  expect((await send('/api/game/result', result, env)).status).toBe(204)
  const day = new Date(Date.now() - KEEP).toISOString().slice(0, 10)
  expect(deleted).toEqual([Date.now() - KEEP, day, day])
  await send('/api/game/result', result, env)
  expect(deleted).toHaveLength(3)
})

it('a failed prune still stores the result and is retried by the next request', async () => {
  on(2)
  const { env, results, deleted, fail } = fakeEnv()
  fail.delete = true
  expect((await send('/api/game/result', result, env)).status).toBe(204)
  expect(results).toHaveLength(1)
  fail.delete = false
  await send('/api/game/result', result, env)
  expect(deleted).toHaveLength(3)
})

it('a step prunes the cache without any result upload', async () => {
  on(3)
  const { env, deleted } = fakeEnv()
  stubFetch()
  await send('/api/game/step', stepReq, env)
  expect(deleted).toHaveLength(3)
})
