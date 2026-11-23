import { MAX_MS, URL_AI, canonical, keys, round05, stepBody, validate, wave } from '../engine.ts'
import type { AiPick, Deck, Past, Spec } from '../engine.ts'
import { edition, sha256 } from '../eval/version.ts'
import { decks } from '../levels/index.ts'

export type GameEnv = {
  DB: {
    prepare(sql: string): { bind(...v: unknown[]): { first<T = unknown>(): Promise<T | null>; run(): Promise<unknown> } }
  }
  LIMIT: { limit(o: { key: string }): Promise<{ success: boolean }> }
  KEY?: string
}

const DAILY_CAP = 1000
const MAX_BYTES = 2048
const RESULT_CAP = 5000
const POOL_FROM = 1000
const TIMEOUT = 1500
const KEEP_DAYS = 365
let pruned = ''

class Bad extends Error {}
const bad = (): never => {
  throw new Bad()
}
const int = (x: unknown, max: number): number => (Number.isInteger(x) && (x as number) >= 0 && (x as number) <= max ? (x as number) : bad())
const list = (x: unknown, n: number): unknown[] => (Array.isArray(x) && x.length === n ? x : bad())
const exact = (x: unknown, ks: string[]): Record<string, unknown> =>
  x && typeof x === 'object' && !Array.isArray(x) && Object.keys(x).sort().join() === [...ks].sort().join() ? (x as Record<string, unknown>) : bad()

const spec = (d: Deck, standard: boolean, seq: Spec[], pos: number, a: unknown[]): Spec => {
  const [r, step, seed] = [int(a[0], d.rules.length - 1), int(a[1], 1e6), int(a[2], 1e9)]
  const s = { rule: d.rules[r]!.id, step, seed }
  const same = (q: Spec) => q.rule === s.rule && q.step === s.step && q.seed === s.seed
  const inPool = step >= 1 && step <= d.steps && seed >= POOL_FROM && seed < POOL_FROM + d.poolSize
  return (standard ? seq[pos] && same(seq[pos]) : inPool || seq.some(same)) ? s : bad()
}

const context = (b: Record<string, unknown>) => {
  const d = Object.values(decks)[int(b.v, 1e3)] ?? bad()
  const level = d.levels.find((l) => l.id === b.level) ?? bad()
  const standard = int(b.mode, 1) === 0
  return { d, level, standard, seq: level.sequence }
}

const hitOf = (d: Deck, s: Spec, pick: number) => {
  const w = wave(d, s)
  return { w, hit: w.answers.includes(int(pick, w.symbols.length - 1)) }
}

const json = (o: unknown) => new Response(JSON.stringify(o), { headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } })
const fallback = (why: string) => {
  console.error('step fallback: ' + why)
  return json({ fallback: true })
}

const fail = (why: string): never => {
  throw new Error(why)
}

const prune = async (env: GameEnv) => {
  const day = new Date().toISOString().slice(0, 10)
  if (pruned === day) return
  const old = Date.now() - KEEP_DAYS * 86_400_000
  try {
    await env.DB.prepare('DELETE FROM game_cache WHERE created < ?').bind(old).run()
    await env.DB.prepare('DELETE FROM game_results WHERE day < ?').bind(new Date(old).toISOString().slice(0, 10)).run()
    pruned = day
  } catch {}
}

const used = (env: GameEnv, col: 'step' | 'result', n = 1) =>
  env.DB.prepare(`INSERT INTO game_use (day, ${col}) VALUES (?, ?) ON CONFLICT(day) DO UPDATE SET ${col} = ${col} + ? RETURNING ${col} AS n`)
    .bind(new Date().toISOString().slice(0, 10), n, n)
    .first<{ n: number }>()
    .then((r) => r?.n ?? Infinity)

const step = async (b: Record<string, unknown>, env: GameEnv, ctx: { waitUntil(p: Promise<unknown>): void }) => {
  const { d, standard, seq } = context(exact(b, ['v', 'level', 'mode', 'wave', 'past']))
  ctx.waitUntil(prune(env))
  const rows = Array.isArray(b.past) && b.past.length < seq.length ? b.past : bad()
  const past: Past[] = rows.map((p, i) => {
    const a = list(p, 5)
    const { w, hit } = hitOf(d, spec(d, standard, seq, i, a), a[3] as number)
    return { w, hit, tempo: int(a[4], 2) as 0 | 1 | 2 }
  })
  const w = wave(d, spec(d, standard, seq, past.length, list(b.wave, 3)))
  const body = stepBody(d, w, past)
  const key = await sha256(canonical(body))
  const hit = await env.DB.prepare('SELECT body FROM game_cache WHERE key = ?').bind(key).first<{ body: string }>()
  if (hit) return json({ ...JSON.parse(hit.body), cached: true })
  if (!env.KEY) return fallback('no key')
  if ((await used(env, 'step', 2)) > DAILY_CAP) return fallback('cap spent')
  const ask = async () => {
    const signal = AbortSignal.timeout(TIMEOUT)
    const res = await fetch(URL_AI, {
      method: 'POST',
      headers: { authorization: `Bearer ${env.KEY}`, 'content-type': 'application/json' },
      body: JSON.stringify(body),
      signal,
    }).catch(() => fail(signal.aborted ? 'timeout' : 'unreachable'))
    if (!res.ok) fail('liquid ' + res.status)
    try {
      const a = ((await res.json()) as { answers?: Record<string, AiPick> }).answers ?? {}
      return { ai: validate(keys(w), a.ai).choice, hit: validate(['hit', 'miss'], a.if_hit).probabilities.hit!, miss: validate(['hit', 'miss'], a.if_miss).probabilities.hit! }
    } catch {
      return fail(signal.aborted ? 'timeout' : 'invalid answer')
    }
  }
  const pass = await Promise.all([ask(), ask()]).catch((e: Error) => e)
  if (pass instanceof Error) return fallback(pass.message)
  const [x, y] = pass
  const out = {
    ai: x.ai === y.ai ? Number(x.ai.slice(1)) : null,
    hit: round05((x.hit + y.hit) / 2),
    miss: round05((x.miss + y.miss) / 2),
  }
  ctx.waitUntil(
    env.DB.prepare('INSERT OR IGNORE INTO game_cache (key, body, created) VALUES (?, ?, ?)').bind(key, JSON.stringify(out), Date.now()).run().catch(() => {}),
  )
  return json({ ...out, cached: false })
}

const result = async (b: Record<string, unknown>, env: GameEnv) => {
  const { d, level, standard, seq } = context(exact(b, ['v', 'level', 'mode', 'waves']))
  const rows = Array.isArray(b.waves) && b.waves.length <= seq.length ? b.waves : bad()
  const waves = rows.map((r, i) => {
    const a = Array.isArray(r) ? r : bad()
    const s = spec(d, standard, seq, i, a)
    const { w, hit } = hitOf(d, s, a[3] as number)
    list(a, 14 + w.symbols.length)
    if (a[4] !== +hit || a[13] !== +level.anchors.includes(i)) bad()
    const n = w.symbols.length - 1
    return [...a.slice(0, 4), a[4], int(a[5], 2), a[6] === -1 ? -1 : int(a[6], n), int(a[7], 20), int(a[8], 1), int(a[9], 1), int(a[10], 1), int(a[11], MAX_MS), int(a[12], 99), a[13], ...a.slice(14).map((x) => int(x, MAX_MS))]
  })
  if ((await used(env, 'result')) > RESULT_CAP) return new Response(null, { status: 204 })
  await env.DB.prepare('INSERT INTO game_results (day, version, level, mode, waves) VALUES (?, ?, ?, ?, ?)')
    .bind(new Date().toISOString().slice(0, 10), await edition(d), b.level, standard ? 0 : 1, JSON.stringify(waves))
    .run()
  await prune(env)
  return new Response(null, { status: 204 })
}

const read = async (req: Request) => {
  const r = req.body?.getReader()
  const dec = new TextDecoder()
  let text = ''
  let n = 0
  while (r) {
    const { done, value } = await r.read()
    if (done) break
    if ((n += value.length) > MAX_BYTES) {
      await r.cancel()
      return ''
    }
    text += dec.decode(value, { stream: true })
  }
  return text
}

export const route = async (req: Request, env: GameEnv, ctx: { waitUntil(p: Promise<unknown>): void }): Promise<Response> => {
  const url = new URL(req.url)
  const site = req.headers.get('sec-fetch-site')
  if (req.headers.get('origin') !== url.origin || site === 'cross-site') return new Response(null, { status: 403 })
  if (req.method !== 'POST') return new Response(null, { status: 405 })
  const handler = url.pathname === '/api/game/step' ? step : url.pathname === '/api/game/result' ? result : null
  if (!handler) return new Response(null, { status: 404 })
  const text = await read(req)
  if (!text) return new Response(null, { status: 400 })
  let body: unknown
  try {
    body = JSON.parse(text)
  } catch {
    return new Response(null, { status: 400 })
  }
  if (!body || typeof body !== 'object') return new Response(null, { status: 400 })
  try {
    if (!(await env.LIMIT.limit({ key: req.headers.get('cf-connecting-ip') ?? '' })).success) return new Response(null, { status: 429 })
    return await handler(body as Record<string, unknown>, env, ctx)
  } catch (e) {
    if (e instanceof Bad) return new Response(null, { status: 400 })
    return handler === step ? fallback('error') : new Response(null, { status: 503 })
  }
}
