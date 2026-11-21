import { rng } from './engine.ts'
import { colors } from './gen.ts'
import { LAYERS, effect, finish, pos } from './field.ts'
import type { State } from './field.ts'

const burst = (s: State, to: number) => {
  const t = s.ts[to]!
  const { x, y } = pos(s, t)
  const r = rng(to + 7)
  s.shards = Array.from({ length: 18 }, (_, i) => {
    const a = r() * 6.283
    const v = 1 + 2 * r()
    return { x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: 30, c: i % 3 ? colors[t.shape.family + (2 + (i % 3))]! : colors.signal! }
  })
}

export const update = (s: State) => {
  s.tick++
  if (!s.calm) s.off = s.off.map((o, i) => (o + LAYERS[i]!.v) % s.h)
  s.sx += (s.tx - s.sx) * (s.calm ? 0.07 : 0.2)
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
