import { MAX_MS, URL_AI, canonical, encounters, roomBody, rooms, rowMap, score as engineScore, validate } from '../engine.ts'
import type { AiPick } from '../engine.ts'
import { edition, sha256 } from '../eval/version.ts'
import { BINDINGS, place } from '../levels/observations.ts'
import { rows } from '../levels/rows.ts'
import { world } from '../levels/world.ts'

export type GameEnv = {
  DB: {
    prepare(sql: string): { bind(...v: unknown[]): { first<T = unknown>(): Promise<T | null>; run(): Promise<unknown>; all<T = unknown>(): Promise<{ results: T[] }> } }
  }
  LIMIT: { limit(o: { key: string }): Promise<{ success: boolean }> }
  KEY?: string
}

const DAILY_CAP = 1000
const MAX_BYTES = 8192
const RESULT_CAP = 5000
const TIMEOUT = 1500
const KEEP_DAYS = 365
const TOP = 10
const NAME = /^[\p{L}\p{N} ._-]{1,20}$/u
let pruned = ''

class Bad extends Error {}
const bad = (): never => {
  throw new Bad()
}
const int = (x: unknown, max: number): number => (Number.isInteger(x) && (x as number) >= 0 && (x as number) <= max ? (x as number) : bad())
const list = (x: unknown, n: number): unknown[] => (Array.isArray(x) && x.length === n ? x : bad())
const exact = (x: unknown, ks: string[]): Record<string, unknown> =>
  x && typeof x === 'object' && !Array.isArray(x) && Object.keys(x).sort().join() === [...ks].sort().join() ? (x as Record<string, unknown>) : bad()

const RS = rooms(world)
const ENC = encounters(world)
const ROWS = rowMap(rows)
const HIDDEN = world.doors.filter((d) => d.kind === 'hidden').length

const room = (b: Record<string, unknown>) => {
  if (b.v !== 0) bad()
  return RS[int(b.room, RS.length - 1)]!
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
    await env.DB.prepare('DELETE FROM game_board WHERE day < ?').bind(new Date(old).toISOString().slice(0, 10)).run()
    pruned = day
  } catch {}
}

const used = (env: GameEnv, col: 'step' | 'result', n = 1) =>
  env.DB.prepare(`INSERT INTO game_use (day, ${col}) VALUES (?, ?) ON CONFLICT(day) DO UPDATE SET ${col} = ${col} + ? RETURNING ${col} AS n`)
    .bind(new Date().toISOString().slice(0, 10), n, n)
    .first<{ n: number }>()
    .then((r) => r?.n ?? Infinity)

const step = async (b: Record<string, unknown>, env: GameEnv, ctx: { waitUntil(p: Promise<unknown>): void }) => {
  const r = room(exact(b, ['v', 'room']))
  if (!r.monsters.length) bad()
  ctx.waitUntil(prune(env))
  const body = roomBody(r, ROWS)
  const ks = r.monsters.map((_, i) => `r${i}`)
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
      return validate(ks, ((await res.json()) as { answers?: Record<string, AiPick> }).answers?.ai).choice
    } catch {
      return fail(signal.aborted ? 'timeout' : 'invalid answer')
    }
  }
  const pass = await Promise.all([ask(), ask()]).catch((e: Error) => e)
  if (pass instanceof Error) return fallback(pass.message)
  const out = { ai: pass[0] === pass[1] ? Number(pass[0].slice(1)) : null }
  ctx.waitUntil(
    env.DB.prepare('INSERT OR IGNORE INTO game_cache (key, body, created) VALUES (?, ?, ?)').bind(key, JSON.stringify(out), Date.now()).run().catch(() => {}),
  )
  return json({ ...out, cached: false })
}

const checked = async (b: Record<string, unknown>) => {
  if (b.v !== 0 || b.level !== 1) bad()
  const version = await edition(world, rows)
  if (b.edition !== version) bad()
  const given = Array.isArray(b.visits) && b.visits.length <= ENC.length ? b.visits : bad()
  const entered = new Set<number>()
  const visits = given.map((r, i) => {
    const a = list(r, 23)
    const at = int(a[0], RS.length - 1)
    const n = RS[at]!.monsters.length
    if (!n || a[1] !== i || entered.has(at)) bad()
    entered.add(at)
    const stations = a.slice(7, 19).map((x) => (x === -1 ? -1 : int(x, 4 * BINDINGS.length - 1)))
    stations.forEach((x, k) => {
      const m = Math.floor(x / BINDINGS.length)
      if (x !== -1 && (m >= n || !place(ROWS.get(RS[at]!.monsters[m]!)!).items.includes(BINDINGS[x % BINDINGS.length]!.field) || stations.indexOf(x) !== k)) bad()
      if (x === -1 && stations[k + 1] !== undefined && stations[k + 1] !== -1) bad()
    })
    const dwell = a.slice(19).map((x, k) => (k < n ? int(x, MAX_MS) : x === 0 ? 0 : bad()))
    const pick = a[2] === -1 ? -1 : int(a[2], n - 1)
    return [at, i, pick, int(a[3], MAX_MS), int(a[4], 99), int(a[5], 1), int(a[6], HIDDEN), ...stations, ...dwell] as number[]
  })
  return { version, visits }
}

const store = async (b: Record<string, unknown>, env: GameEnv, { version, visits }: Awaited<ReturnType<typeof checked>>) => {
  await env.DB.prepare('INSERT INTO game_results (day, version, level, mode, waves) VALUES (?, ?, ?, ?, ?)')
    .bind(new Date().toISOString().slice(0, 10), version, b.level, 0, JSON.stringify(visits))
    .run()
  await prune(env)
}

const result = async (b: Record<string, unknown>, env: GameEnv) => {
  const c = await checked(exact(b, ['v', 'level', 'visits', 'edition']))
  if ((await used(env, 'result')) <= RESULT_CAP) await store(b, env, c)
  return new Response(null, { status: 204 })
}

const standing = async (env: GameEnv, version: string, level: number, mode: number, score: number) => {
  const top = await env.DB.prepare('SELECT name, score FROM game_board WHERE version = ? AND level = ? AND mode = ? ORDER BY score DESC, id ASC LIMIT ?').bind(version, level, mode, TOP).all<{ name: string; score: number }>()
  const count = await env.DB.prepare('SELECT COUNT(*) AS n, SUM(score < ?) AS below FROM game_board WHERE version = ? AND level = ? AND mode = ?').bind(score, version, level, mode).first<{ n: number; below: number | null }>()
  return json({ top: top.results.map((x) => [x.name, x.score]), n: count?.n ?? 0, below: count?.below ?? 0, score })
}

const board = async (b: Record<string, unknown>, env: GameEnv) => {
  const c = await checked(exact(b, ['v', 'level', 'visits', 'edition', 'name', 'sent']))
  const name = typeof b.name === 'string' && NAME.test(b.name.trim()) ? b.name.trim() : bad()
  const sent = int(b.sent, 1)
  if ((await used(env, 'result')) > RESULT_CAP) return new Response(null, { status: 204 })
  const picked = c.visits.filter((a) => a[2]! >= 0)
  if (picked.length < world.key || ENC.some((r) => r.certain && !picked.some((a) => RS[a[0]!] === r))) bad()
  const score = engineScore(world, ROWS, c.visits.map((a) => ({ room: a[0]!, pick: a[2]!, ms: a[3]! })))
  await env.DB.prepare('INSERT INTO game_board (day, version, level, mode, name, score) VALUES (?, ?, ?, ?, ?, ?)')
    .bind(new Date().toISOString().slice(0, 10), c.version, b.level, 0, name, score)
    .run()
  if (!sent) await store(b, env, c)
  return standing(env, c.version, b.level as number, 0, score)
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
  const handler = url.pathname === '/api/game/step' ? step : url.pathname === '/api/game/result' ? result : url.pathname === '/api/game/board' ? board : null
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
