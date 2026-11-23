import { afterEach, expect, it, vi } from 'vitest'
import { decks } from '../../src/game/levels/index.ts'
import { wave } from '../../src/game/engine.ts'
import { edition } from '../../src/game/eval/version.ts'
import { FIXTURE, fakeEnv, send, stepReq, stubFetch } from './route-env.ts'

const DAY = 86_400_000
const KEEP = 365 * DAY
const d = decks.fixture!
const pick = wave(d, { rule: d.rules[0]!.id, step: 1, seed: 0 }).answers[0]!
const result = { v: FIXTURE, level: 1, mode: 0, edition: await edition(d), waves: [[0, 1, 0, pick, 1, 1, 0, 12, 0, 0, 1, 2345, 3, 0, ...wave(d, { rule: d.rules[0]!.id, step: 1, seed: 0 }).symbols.map(() => 812)]] }
const on = (n: number) => vi.useFakeTimers({ toFake: ['Date'], now: Date.UTC(2031, 0, n) })
afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

it('a result drops cache and result rows older than a year, once a day', async () => {
  on(1)
  const { env, deleted } = fakeEnv()
  expect((await send('/api/game/result', result, env)).status).toBe(204)
  expect(deleted).toEqual([Date.now() - KEEP, new Date(Date.now() - KEEP).toISOString().slice(0, 10)])
  await send('/api/game/result', result, env)
  expect(deleted).toHaveLength(2)
})

it('a failed prune still stores the result and is retried by the next request', async () => {
  on(2)
  const { env, results, deleted, fail } = fakeEnv()
  fail.delete = true
  expect((await send('/api/game/result', result, env)).status).toBe(204)
  expect(results).toHaveLength(1)
  fail.delete = false
  await send('/api/game/result', result, env)
  expect(deleted).toHaveLength(2)
})

it('a step prunes the cache without any result upload', async () => {
  on(3)
  const { env, deleted } = fakeEnv()
  stubFetch()
  await send('/api/game/step', stepReq, env)
  expect(deleted).toHaveLength(2)
})

it('a failing prune never fails a step', async () => {
  on(4)
  const { env, fail } = fakeEnv()
  fail.delete = true
  stubFetch()
  expect((await send('/api/game/step', stepReq, env)).status).toBe(200)
})
