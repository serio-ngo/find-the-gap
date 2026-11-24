import type { Pt } from './gen.ts'
import { LAYERS, effect, pos, rad, sprite, stars } from './field.ts'
import { nose, reticle, ship } from './ship.ts'
import type { State, Target } from './field.ts'

type Put = (t: Target, x: number, y: number, scale?: number, alpha?: number) => void

const placer = (s: State): Put => (t, x, y, scale = 1, alpha = 1) => {
  const { ctx, dpr } = s
  const R = rad(s)
  ctx.globalAlpha = alpha
  ctx.setTransform(scale * dpr, 0, 0, scale * dpr, x * dpr, y * dpr)
  ctx.drawImage(sprite(s, t), -R, -R, 2 * R, 2 * R)
  ctx.globalAlpha = 1
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
}

const verdict = (s: State, p: number) => {
  const { ctx, col, shot } = s
  const R = rad(s)
  const q = pos(s, s.ts[shot!.to]!)
  const cx = q.x + R * 0.75
  const cy = q.y - R * 0.75
  ctx.lineCap = 'round'
  ctx.lineWidth = 3
  ctx.strokeStyle = col.brick
  ctx.beginPath()
  if (shot!.outcome) {
    ctx.globalAlpha = 1 - p
    ctx.arc(q.x, q.y, R * (0.6 + 0.6 * p), 0, 7)
    ctx.stroke()
    ctx.globalAlpha = 1
    ctx.strokeStyle = col.paper
    ctx.beginPath()
    ctx.moveTo(cx - R * 0.25, cy)
    ctx.lineTo(cx - R * 0.05, cy + R * 0.2)
    ctx.lineTo(cx + R * 0.3, cy - R * 0.25)
    ctx.stroke()
  } else {
    const d = R * 0.25
    ctx.moveTo(cx - d, cy - d)
    ctx.lineTo(cx + d, cy + d)
    ctx.moveTo(cx + d, cy - d)
    ctx.lineTo(cx - d, cy + d)
    ctx.stroke()
    ctx.lineWidth = 2
    ctx.setLineDash([6, 6])
    for (const a of s.answers) {
      const z = pos(s, s.ts[a]!)
      ctx.beginPath()
      ctx.arc(z.x, z.y, R * 0.97, 0, 7)
      ctx.stroke()
    }
    ctx.setLineDash([])
  }
  ctx.lineCap = 'butt'
}

const beam = (s: State) => {
  const { ctx, col, shot } = s
  const q = pos(s, s.ts[shot!.to]!)
  const [nx, ny] = nose(s)
  const f = shot!.t / (s.calm ? 6 : 12)
  const at = (u: number): Pt => [nx + (q.x - nx) * u, ny + (q.y - ny) * u]
  const [x0, y0] = at(Math.max(0, f - 0.35))
  const [x1, y1] = at(f)
  ctx.lineCap = 'round'
  for (const [c, wd] of [[col.brick, 7], [col.paper, 2.5]] as const) {
    ctx.strokeStyle = c
    ctx.lineWidth = wd
    ctx.beginPath()
    ctx.moveTo(x0, y0)
    ctx.lineTo(x1, y1)
    ctx.stroke()
  }
  ctx.lineCap = 'butt'
}

export const draw = (s: State) => {
  const { ctx, dpr, w, h, col, shot } = s
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  ctx.fillStyle = col.field
  ctx.fillRect(0, 0, w, h)
  LAYERS.forEach((L, i) => {
    ctx.fillStyle = col[L.c]
    for (const [x, y] of stars[i]!) ctx.fillRect(x * w, (y * h + s.off[i]!) % h, L.size, L.size)
  })
  const p = shot && shot.phase === 2 ? shot.t / effect(s) : 0
  const R = rad(s)
  const put = placer(s)
  ctx.lineWidth = 2
  s.ts.forEach((t, i) => {
    const q = pos(s, t)
    if (shot && shot.to === i && shot.phase === 2) {
      if (s.calm) put(t, q.x, q.y, 1, Math.max(0, 1 - 2 * p))
      return
    }
    put(t, q.x, q.y)
    if (i === s.focused && i !== s.aim) {
      ctx.strokeStyle = col.brick
      ctx.beginPath()
      ctx.arc(q.x, q.y, R * 0.97, 0, 7)
      ctx.stroke()
    }
  })
  for (const d of s.shards) {
    ctx.globalAlpha = Math.min(1, d.life / 14)
    ctx.fillStyle = d.c
    if (d.pts) {
      ctx.save()
      ctx.translate(d.x, d.y)
      ctx.rotate(d.a!)
      ctx.beginPath()
      d.pts.forEach(([x, y], k) => (k ? ctx.lineTo(x, y) : ctx.moveTo(x, y)))
      ctx.closePath()
      ctx.fill()
      ctx.restore()
    } else ctx.fillRect(d.x - 1.5, d.y - 1.5, 3, 3)
  }
  ctx.globalAlpha = 1
  if (shot && shot.phase === 2 && !s.calm) {
    const q = pos(s, s.ts[shot.to]!)
    ctx.strokeStyle = col.paper
    ctx.globalAlpha = Math.max(0, 1 - 3 * p)
    ctx.lineWidth = 3
    ctx.beginPath()
    ctx.arc(q.x, q.y, R * (0.3 + 1.2 * p), 0, 7)
    ctx.stroke()
    ctx.globalAlpha = 1
  }
  if (shot && shot.phase === 2 && shot.outcome !== null) verdict(s, p)
  if (!shot && s.aim >= 0 && s.ts[s.aim]) reticle(s, s.aim)
  if (shot && shot.phase < 2) reticle(s, shot.to)
  if (shot && shot.phase === 1) beam(s)
  ship(s)
}
