import { rng } from './engine.ts'
import { colors, paintObject } from './gen.ts'
import type { Shape } from './gen.ts'

export type Target = { x: number; y: number; vx: number; vy: number; angle: number; rate: number; n: number; key: string; shape: Shape }
export type Shot = { to: number; outcome: boolean | null; phase: 0 | 1 | 2; t: number }
export type Shard = { x: number; y: number; vx: number; vy: number; life: number; c: string }
export type Colors = { field: string; paper: string; paper2: string; paper3: string; ink2: string; ink3: string; brick: string }

export type State = {
  ctx: CanvasRenderingContext2D
  calm: boolean
  w: number
  h: number
  dpr: number
  ts: Target[]
  inspected: boolean
  open: number
  answers: readonly number[]
  shot: Shot | null
  done: (() => void) | null
  shards: Shard[]
  ghost: { t: Target; x: number; y: number; angle: number; life: number } | null
  focused: number
  acc: number
  tick: number
  sx: number
  tx: number
  off: number[]
  sprites: Map<string, HTMLCanvasElement>
  col: Colors
}

export const STEP = 1000 / 60
export const BAND = 64
export const EDGE = 24
export const PS = 1.4
export const LAYERS = [
  { n: 60, size: 1, v: 0.15, c: 'ink2' },
  { n: 35, size: 1.5, v: 0.35, c: 'ink3' },
  { n: 15, size: 2, v: 0.7, c: 'paper3' },
] as const
export const stars = LAYERS.map((L, i) => {
  const r = rng(101 + i)
  return Array.from({ length: L.n }, () => [r(), r()] as const)
})

export const clamp = (x: number, a: number, b: number) => Math.min(b, Math.max(a, x))
export const rad = (s: State) => Math.max(28, Math.min(s.w, s.h) * 0.14)
export const k = (s: State) => (s.calm ? 0.35 : 1)
export const effect = (s: State) => (s.calm ? 8 : s.shot!.outcome === null ? 21 : s.shot!.outcome ? 40 : 30)

export const pos = (s: State, t: Target) => {
  const a = s.shot ? 0 : (s.acc / STEP) * k(s)
  const e = t.n <= 0 ? 0 : 1 - (1 - Math.min(1, (t.n * k(s)) / 30)) ** 3
  const y = t.y + t.vy * a
  const o = t.angle + t.rate * a
  return { x: t.x + t.vx * a, y: y - (1 - e) * (y + 2 * rad(s)) + 0.04 * rad(s) * Math.cos(o), angle: (1 - s.open) * 0.35 * Math.sin(o) }
}

export const sprite = (s: State, t: Target, split = false) => {
  const key = t.key + Number(split)
  const cached = s.sprites.get(key)
  if (cached) return cached
  const R = rad(s)
  const c = document.createElement('canvas')
  c.width = c.height = Math.ceil(2 * R * s.dpr)
  const g = c.getContext('2d')!
  g.scale(s.dpr, s.dpr)
  g.translate(R, R)
  g.lineJoin = 'round'
  g.lineCap = 'round'
  paintObject(t.shape, ({ points, fill, stroke, width }) => {
    g.beginPath()
    points.forEach(([x, y], i) => (i ? g.lineTo(x * R, y * R) : g.moveTo(x * R, y * R)))
    if (fill) {
      g.closePath()
      g.fillStyle = colors[fill]!
      g.fill()
    }
    if (stroke) {
      g.lineWidth = Math.max(0.85, width * R)
      g.strokeStyle = colors[stroke]!
      g.stroke()
    }
  }, split)
  s.sprites.set(key, c)
  return c
}

export const finish = (s: State) => {
  const f = s.done
  s.done = null
  s.shot = null
  f?.()
}
