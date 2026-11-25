import type { Pt } from './gen.ts'
import { LOCK, PS, pos, rad } from './field.ts'
import type { State } from './field.ts'

export const nose = (s: State): Pt => [s.sx + Math.sin(s.angle) * 20 * PS, s.sy - Math.cos(s.angle) * 20 * PS]

export const reticle = (s: State, i: number) => {
  const { ctx, col } = s
  const q = pos(s, s.ts[i]!)
  const R = rad(s)
  const p = s.calm ? 1 : Math.min(1, s.aimT / LOCK)
  const e = 1 - (1 - p) ** 3
  const r = R * (1.25 - 0.3 * e)
  const spin = s.calm ? 0 : (1 - e) * (Math.PI / 2)
  ctx.save()
  ctx.translate(q.x, q.y)
  ctx.rotate(spin)
  ctx.strokeStyle = col.brick
  ctx.lineWidth = 3
  ctx.lineCap = 'round'
  for (let k = 0; k < 4; k++) {
    ctx.rotate(Math.PI / 2)
    ctx.beginPath()
    ctx.arc(0, 0, r, -0.32, 0.32)
    ctx.stroke()
    ctx.beginPath()
    ctx.moveTo(r - 8, 0)
    ctx.lineTo(r + 6, 0)
    ctx.stroke()
  }
  if (p >= 1) {
    ctx.fillStyle = col.paper
    ctx.globalAlpha = s.calm ? 1 : 0.6 + 0.4 * Math.sin(s.tick * 0.25)
    ctx.beginPath()
    ctx.arc(0, 0, 3, 0, 7)
    ctx.fill()
    ctx.globalAlpha = 1
  }
  ctx.restore()
  ctx.lineCap = 'butt'
}

export const ship = (s: State) => {
  const { ctx, col } = s
  ctx.save()
  ctx.translate(s.sx, s.sy)
  ctx.rotate(s.angle)
  ctx.scale(PS, PS)
  const flame = s.calm ? 6 : 6 + (s.tick % 6 < 3 ? 6 : 2)
  ctx.fillStyle = col.paper3
  ctx.globalAlpha = 0.9
  ctx.beginPath()
  ctx.moveTo(-5, 12)
  ctx.lineTo(5, 12)
  ctx.lineTo(0, 12 + flame)
  ctx.fill()
  ctx.fillStyle = col.brick
  ctx.beginPath()
  ctx.moveTo(-3, 12)
  ctx.lineTo(3, 12)
  ctx.lineTo(0, 12 + flame * 0.6)
  ctx.fill()
  ctx.globalAlpha = 1
  ctx.fillStyle = col.ink2
  ctx.beginPath()
  ctx.moveTo(-6, 0)
  ctx.lineTo(-19, 13)
  ctx.lineTo(-17, 16)
  ctx.lineTo(-5, 11)
  ctx.moveTo(6, 0)
  ctx.lineTo(19, 13)
  ctx.lineTo(17, 16)
  ctx.lineTo(5, 11)
  ctx.fill()
  ctx.fillStyle = col.brick
  ctx.beginPath()
  ctx.moveTo(0, -20)
  ctx.bezierCurveTo(7, -12, 8, 4, 6, 13)
  ctx.lineTo(-6, 13)
  ctx.bezierCurveTo(-8, 4, -7, -12, 0, -20)
  ctx.fill()
  ctx.strokeStyle = col.paper2
  ctx.lineWidth = 0.8
  ctx.stroke()
  ctx.fillStyle = col.paper
  ctx.beginPath()
  ctx.ellipse(0, -5, 2.8, 5.5, 0, 0, 7)
  ctx.fill()
  ctx.restore()
}
