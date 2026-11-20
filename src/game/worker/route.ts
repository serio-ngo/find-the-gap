import { URL_AI, canonical, keys, round05, stepBody, validate, wave } from '../engine.ts'
import type { Deck, Past, Spec } from '../engine.ts'
import { decks } from '../levels/index.ts'

export type GameEnv = {
  ASK_DB: {
    prepare(sql: string): { bind(...v: unknown[]): { first<T = any>(): Promise<T | null>; run(): Promise<unknown> } }
  }
  RL_GAME: { limit(o: { key: string }): Promise<{ success: boolean }> }
  LIQUID_AI_KEY?: string
}

const DAILY_CAP = 1000
const MAX_BYTES = 2048
const RESULT_CAP = 5000
const POOL_FROM = 1000

class Bad extends Error {}
const bad = (): never => {
  throw new Bad()
}
const int = (x: unknown, max: number): number => (Number.isInteger(x) && (x as number) >= 0 && (x as number) <= max ? (x as number) : bad())
const list = (x: unknown, n: number): unknown[] => (Array.isArray(x) && x.length === n ? x : bad())
const exact = (x: unknown, ks: string[]): Record<string, unknown> =>
  x && typeof x === 'object' && !Array.isArray(x) && Object.keys(x).sort().join() === [...ks].sort().join() ? (x as any) : bad()

// rule index = position in deck.rules; deck.rules.length stands for the research wave
const spec = (d: Deck, standard: boolean, seq: Spec[], pos: number, a: unknown[]): Spec => {
  const [r, step, seed] = [int(a[0], d.rules.length), int(a[1], 1e6), int(a[2], 1e9)]
  const s = { rule: r === d.rules.length ? 'research' : d.rules[r]!.id, step, seed }
  const same = (q: Spec) => q.rule === s.rule && q.step === s.step && q.seed === s.seed
  const inPool = s.rule !== 'research' && step >= 1 && step <= d.steps && seed >= POOL_FROM && seed < POOL_FROM + d.poolSize
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
  return { w, hit: s.rule === 'research' ? null : w.answers.includes(int(pick, w.symbols.length - 1)) }
}

const sha256 = async (s: string) =>
  [...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s)))].map((x) => x.toString(16).padStart(2, '0')).join('')

const json = (o: unknown) => new Response(JSON.stringify(o), { headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } })
const FALLBACK = { fallback: true }

// counts every attempt per UTC day, failed or not; the returned count includes this one
const used = (env: GameEnv, col: 'step' | 'result') =>
  env.ASK_DB.prepare(`INSERT INTO game_use (day, ${col}) VALUES (?, 1) ON CONFLICT(day) DO UPDATE SET ${col} = ${col} + 1 RETURNING ${col} AS n`)
    .bind(new Date().toISOString().slice(0, 10))
    .first<{ n: number }>()
    .then((r) => r?.n ?? Infinity)

const step = async (b: Record<string, unknown>, env: GameEnv, ctx: { waitUntil(p: Promise<unknown>): void }) => {
  const { d, standard, seq } = context(exact(b, ['v', 'level', 'mode', 'wave', 'past']))
  const rows = Array.isArray(b.past) && b.past.length < seq.length ? b.past : bad()
  const past: Past[] = rows.map((p, i) => {
    const a = list(p, 5)
    const { w, hit } = hitOf(d, spec(d, standard, seq, i, a), a[3] as number)
    return { w, hit, tempo: int(a[4], 2) as 0 | 1 | 2 }
  })
  const w = wave(d, spec(d, standard, seq, past.length, list(b.wave, 3)))
  const body = stepBody(d, w, past)
  const key = await sha256(canonical(body))
  const hit = await env.ASK_DB.prepare('SELECT body FROM game_cache WHERE key = ?').bind(key).first<{ body: string }>()
  if (hit) return json({ ...JSON.parse(hit.body), cached: true })
  if (!env.LIQUID_AI_KEY) return json(FALLBACK)
  if ((await used(env, 'step')) > DAILY_CAP) return json(FALLBACK)
  const res = await fetch(URL_AI, {
    method: 'POST',
    headers: { authorization: `Bearer ${env.LIQUID_AI_KEY}`, 'content-type': 'application/json' },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(1500),
  })
  if (!res.ok) return json(FALLBACK)
  const a = ((await res.json()) as any).answers
  const ai = validate(keys(w), a?.ai)
  const out = {
    ai: { pick: Number(ai.choice.slice(1)), p: round05(ai.probabilities[ai.choice]!) },
    hit: round05(validate(['hit', 'miss'], a.if_hit).probabilities.hit!),
    miss: round05(validate(['hit', 'miss'], a.if_miss).probabilities.hit!),
  }
  ctx.waitUntil(
    env.ASK_DB.prepare('INSERT OR IGNORE INTO game_cache (key, body, created) VALUES (?, ?, ?)').bind(key, JSON.stringify(out), Date.now()).run().catch(() => {}),
  )
  return json({ ...out, cached: false })
}

const result = async (b: Record<string, unknown>, env: GameEnv) => {
  const { d, standard, seq } = context(exact(b, ['v', 'level', 'mode', 'waves']))
  const rows = Array.isArray(b.waves) && b.waves.length <= seq.length ? b.waves : bad()
  const waves = rows.map((r, i) => {
    const a = list(r, 11)
    const s = spec(d, standard, seq, i, a)
    const { w, hit } = hitOf(d, s, a[3] as number)
    if (a[4] !== (hit === null ? 2 : hit ? 1 : 0)) bad()
    const n = w.symbols.length - 1 // a[6] = -1: the client had no AI pick
    return [...a.slice(0, 4), a[4], int(a[5], 2), a[6] === -1 ? -1 : int(a[6], n), int(a[7], 20), int(a[8], 20), int(a[9], 1), int(a[10], 1)]
  })
  if ((await used(env, 'result')) > RESULT_CAP) return new Response(null, { status: 204 })
  await env.ASK_DB.prepare('INSERT INTO game_results (day, version, level, mode, waves) VALUES (?, ?, ?, ?, ?)')
    .bind(new Date().toISOString().slice(0, 10), d.id, b.level, standard ? 0 : 1, JSON.stringify(waves))
    .run()
  return new Response(null, { status: 204 })
}

// hard byte limit even without content-length; '' when empty or over
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
    if (!(await env.RL_GAME.limit({ key: req.headers.get('cf-connecting-ip') ?? '' })).success) return new Response(null, { status: 429 })
    return await handler(body as Record<string, unknown>, env, ctx)
  } catch (e) {
    if (e instanceof Bad) return new Response(null, { status: 400 })
    return handler === step ? json(FALLBACK) : new Response(null, { status: 503 })
  }
}
