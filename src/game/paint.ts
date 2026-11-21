import { colors } from './gen.ts'
import type { Pt } from './gen.ts'
import { BAND, LAYERS, PS, effect, pos, rad, sprite, stars } from './field.ts'
import type { State, Target } from './field.ts'

type Put = (t: Target, x: number, y: number, angle: number, scale?: number, alpha?: number, split?: number) => void

const placer = (s: State, shake: number): Put => (t, x, y, angle, scale = 1, alpha = 1, split = 0) => {
  const { ctx, dpr } = s
  const R = rad(s)
  const c = Math.cos(angle) * scale * dpr
  const n = Math.sin(angle) * scale * dpr
  ctx.globalAlpha = alpha
  ctx.setTransform(c, n, -n, c, (x + shake) * dpr, y * dpr)
  ctx.drawImage(sprite(s, t), -R, -R, 2 * R, 2 * R)
  const o = Math.max(s.open, split)
  if (o > 0) {
    const z = 1 + 0.35 * o
    const c2 = Math.cos(angle * (1 - o)) * scale * dpr
    const s2 = Math.sin(angle * (1 - o)) * scale * dpr
    ctx.setTransform(c2, s2, -s2, c2, (x + shake) * dpr, y * dpr)
    ctx.globalAlpha = alpha * o
    ctx.drawImage(sprite(s, t, true), -R * z, -R * z, 2 * R * z, 2 * R * z)
  }
  ctx.globalAlpha = 1
  ctx.setTransform(dpr, 0, 0, dpr, shake * dpr, 0)
}

const label = (s: State, i: number, x: number, y: number) => {
  const { ctx } = s
  ctx.fillStyle = colors.void!
  ctx.beginPath()
  ctx.arc(x, y, 7, 0, 2 * Math.PI)
  ctx.fill()
  ctx.fillStyle = colors.light!
  ctx.font = 'bold 10px system-ui, sans-serif'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(String(i + 1), x, y)
}

const verdict = (s: State, p: number) => {
  const { ctx, col, shot } = s
  const R = rad(s)
  const q = pos(s, s.ts[shot!.to]!)
  const cx = q.x + R * 0.8
  const cy = q.y - R * 0.8
  ctx.lineCap = 'round'
  ctx.lineWidth = 3
  ctx.strokeStyle = col.brick
  ctx.beginPath()
  if (shot!.outcome) {
    ctx.globalAlpha = 1 - p
    ctx.arc(q.x, q.y, R * (0.8 + 1.2 * p), 0, 7)
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
      ctx.arc(z.x, z.y, R + 6, 0, 7)
      ctx.stroke()
    }
    ctx.setLineDash([])
  }
  ctx.lineCap = 'butt'
}

const beam = (s: State, y: number) => {
  const { ctx, col, sx, shot } = s
  const q = pos(s, s.ts[shot!.to]!)
  const f = shot!.t / (s.calm ? 6 : 15)
  const at = (u: number): Pt => [sx + (q.x - sx) * u, y - 18 * PS + (q.y - y + 18 * PS) * u]
  const [x0, y0] = at(Math.max(0, f - 0.25))
  const [x1, y1] = at(f)
  ctx.lineCap = 'round'
  for (const [c, wd] of [[col.brick, 6], [col.paper, 2.5]] as const) {
    ctx.strokeStyle = c
    ctx.lineWidth = wd
    ctx.beginPath()
    ctx.moveTo(x0, y0)
    ctx.lineTo(x1, y1)
    ctx.stroke()
  }
  ctx.lineCap = 'butt'
}

const ship = (s: State, y: number) => {
  const { ctx, col } = s
  ctx.save()
  ctx.translate(s.sx, y)
  ctx.scale(PS, PS)
  ctx.fillStyle = col.paper
  ctx.beginPath()
  ctx.moveTo(-4, 9)
  ctx.lineTo(4, 9)
  ctx.lineTo(0, 14 + (s.tick % 6 < 3 ? 7 : 3))
  ctx.fill()
  ctx.fillStyle = col.brick
  ctx.beginPath()
  ctx.moveTo(0, -18)
  ctx.lineTo(16, 14)
  ctx.lineTo(0, 8)
  ctx.lineTo(-16, 14)
  ctx.fill()
  ctx.fillStyle = col.paper
  ctx.beginPath()
  ctx.ellipse(0, 0, 3.5, 6, 0, 0, 7)
  ctx.fill()
  ctx.restore()
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
  const shake = shot && shot.outcome === false && shot.phase === 2 && !s.calm ? Math.sin(shot.t * 1.8) * 4 * (1 - p) : 0
  const R = rad(s)
  const put = placer(s, shake)
  ctx.setTransform(dpr, 0, 0, dpr, shake * dpr, 0)
  ctx.lineWidth = 2
  s.ts.forEach((t, i) => {
    const q = pos(s, t)
    if (shot && shot.to === i && shot.phase === 2) {
      if (shot.outcome === false) put(t, q.x, q.y, q.angle, 1, 1, 1)
      else put(t, q.x, q.y, q.angle, 1 + 0.4 * p, 1 - p, 1)
      return
    }
    put(t, q.x, q.y, q.angle, 1, 1, shot?.phase === 2 && shot.outcome === false && s.answers.includes(i) ? 1 : 0)
    if (s.open > 0.5) label(s, i, q.x, q.y + R * 1.12)
    if (i === s.focused) {
      ctx.strokeStyle = col.brick
      ctx.beginPath()
      ctx.arc(q.x, q.y, R + 4, 0, 7)
      ctx.stroke()
    }
  })
  if (s.ghost) {
    const g = s.ghost.life / (s.calm ? 8 : 30)
    put(s.ghost.t, s.ghost.x, s.ghost.y, s.ghost.angle, 1 + 0.4 * g, 1 - g, 1)
  }
  if (shot && shot.phase === 2 && shot.outcome !== null) verdict(s, p)
  for (const d of s.shards) {
    ctx.globalAlpha = d.life / 30
    ctx.fillStyle = d.c
    ctx.fillRect(d.x - 2, d.y - 2, 4, 4)
  }
  ctx.globalAlpha = 1
  const y = h - BAND / 2
  if (shot && shot.phase === 1) beam(s, y)
  ship(s, y)
}
