import { rng } from './engine.ts'
import { colors } from './gen.ts'
import type { Pt } from './gen.ts'
import { LAYERS, effect, finish, pos, rad } from './field.ts'
import type { State } from './field.ts'

const turn = (a: number, b: number, k: number) => a + Math.atan2(Math.sin(b - a), Math.cos(b - a)) * k

// The rock breaks along its own outline into wedges and dust. Seeded by the slot, never by the answer: every pick shatters alike.
const shatter = (s: State, to: number) => {
  const t = s.ts[to]!
  const { x, y } = pos(s, t)
  const R = rad(s)
  const r = rng(to + 7)
  const out = t.shape.outline
  const step = Math.max(2, Math.round(out.length / 9))
  const tone = (i: number) => colors[`${t.shape.family}${1 + (i % 3)}`] ?? colors.armor!
  const wedges = []
  for (let i = 0; i < out.length; i += step) {
    const ring: Pt[] = [[0, 0], ...out.slice(i, i + step + 1)]
    const cx = ring.reduce((a, p) => a + p[0], 0) / ring.length
    const cy = ring.reduce((a, p) => a + p[1], 0) / ring.length
    const v = 1.2 + 2.2 * r()
    const d = Math.hypot(cx, cy) || 1
    wedges.push({
      x: x + cx * R, y: y + cy * R, vx: (cx / d) * v, vy: (cy / d) * v - 0.6, life: 32, c: tone(i),
      pts: ring.map((p): Pt => [(p[0] - cx) * R, (p[1] - cy) * R]), a: 0, va: (r() - 0.5) * 0.16,
    })
  }
  const dust = Array.from({ length: 26 }, (_, i) => {
    const a = r() * 6.283
    const v = 0.6 + 3 * r()
    return { x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: 20 + Math.floor(12 * r()), c: i % 4 ? tone(i) : colors.light! }
  })
  s.shards = [...s.shards, ...wedges, ...dust]
}

export const update = (s: State) => {
  s.tick++
  if (!s.calm) s.off = s.off.map((o, i) => (o + LAYERS[i]!.v) % s.h)
  const k = s.calm ? 0.08 : 0.16
  s.sx += (s.tx - s.sx) * k
  s.sy += (s.ty - s.sy) * k
  // the nose follows the locked rock, else the pointer target
  const goal = s.shot ? pos(s, s.ts[s.shot.to]!) : s.aim >= 0 && s.ts[s.aim] ? pos(s, s.ts[s.aim]!) : null
  const heading = goal ? Math.atan2(goal.x - s.sx, s.sy - goal.y) : Math.max(-0.5, Math.min(0.5, (s.tx - s.sx) * 0.02))
  s.angle = s.calm ? heading : turn(s.angle, heading, 0.25)
  if (s.aim >= 0) s.aimT++
  for (const p of s.shards) {
    p.x += p.vx
    p.y += p.vy
    p.vx *= 0.985
    p.vy = p.vy * 0.985 + 0.04
    if (p.a !== undefined) p.a += p.va!
    p.life--
  }
  s.shards = s.shards.filter((p) => p.life > 0)
  const shot = s.shot
  if (!shot) return
  shot.t++
  if (shot.phase === 0) {
    if (shot.t >= (s.calm ? 1 : 6)) {
      s.angle = heading
      shot.phase = 1
      shot.t = 0
    }
  } else if (shot.phase === 1) {
    if (shot.t >= (s.calm ? 6 : 12)) {
      shot.phase = 2
      shot.t = 0
      if (!s.calm) shatter(s, shot.to)
    }
  } else if (shot.t >= effect(s)) finish(s)
}
