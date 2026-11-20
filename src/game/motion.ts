import { rng } from './engine.ts'
import { colors } from './gen.ts'
import { BAND, LAYERS, clamp, effect, finish, k, rad } from './field.ts'
import type { State } from './field.ts'

const bounce = (s: State, m: number) => {
  const R = rad(s)
  for (const t of s.ts) {
    t.x += t.vx * m
    t.y += t.vy * m
    t.angle += t.rate * m
    if (t.x < R || t.x > s.w - R) t.vx = -t.vx
    if (t.y < R + 8 || t.y > s.h - BAND - R) t.vy = -t.vy
    t.x = clamp(t.x, R, s.w - R)
    t.y = clamp(t.y, R + 8, Math.max(R + 8, s.h - BAND - R))
  }
  for (let i = 0; i < s.ts.length; i++)
    for (let j = i + 1; j < s.ts.length; j++) {
      const a = s.ts[i]!
      const b = s.ts[j]!
      const dx = b.x - a.x
      const dy = b.y - a.y
      if (dx * dx + dy * dy < 4 * R * R && (b.vx - a.vx) * dx + (b.vy - a.vy) * dy < 0) {
        ;[a.vx, b.vx] = [b.vx, a.vx]
        ;[a.vy, b.vy] = [b.vy, a.vy]
      }
    }
}

const burst = (s: State, to: number) => {
  const t = s.ts[to]!
  const r = rng(to + 7)
  s.shards = Array.from({ length: 18 }, (_, i) => {
    const a = r() * 6.283
    const v = 1 + 2 * r()
    return { x: t.x, y: t.y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: 30, c: i % 3 ? colors[t.shape.family + (2 + (i % 3))]! : colors.signal! }
  })
}

export const update = (s: State) => {
  const m = k(s) * (1 - 0.65 * s.open)
  s.tick++
  if (!s.calm) s.off = s.off.map((o, i) => (o + LAYERS[i]!.v) % s.h)
  s.sx += (s.tx - s.sx) * 0.2 * m
  s.open = s.calm ? Number(s.inspected) : clamp(s.open + (s.inspected ? 0.08 : -0.12), 0, 1)
  for (const t of s.ts) t.n++
  if (!s.shot) bounce(s, m)
  for (const p of s.shards) {
    p.x += p.vx
    p.y += p.vy
    p.vy += 0.05
    p.life--
  }
  s.shards = s.shards.filter((p) => p.life > 0)
  if (s.ghost && ++s.ghost.life > (s.calm ? 8 : 30)) s.ghost = null
  const shot = s.shot
  if (!shot) return
  shot.t++
  if (shot.phase === 0) {
    if (Math.abs(s.sx - s.tx) < 1.5 || shot.t > 60) {
      s.sx = s.tx
      shot.phase = 1
      shot.t = 0
    }
  } else if (shot.phase === 1) {
    if (shot.t >= (s.calm ? 6 : 15)) {
      shot.phase = 2
      shot.t = 0
      if (shot.outcome === null) {
        const f = s.done
        s.done = null
        f?.()
      }
      if (shot.outcome && !s.calm) burst(s, shot.to)
    }
  } else if (shot.t >= effect(s)) finish(s)
}
