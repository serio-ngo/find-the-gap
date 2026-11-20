import { rng } from './engine.ts'
import type { Wave } from './engine.ts'
import { shape, waveLook } from './gen.ts'
import type { Family, Shape } from './gen.ts'

type Pt = [number, number]
type Target = { x: number; y: number; vx: number; vy: number; angle: number; rate: number; n: number; key: string; bad: boolean; shape: Shape }
type Shot = { to: number; outcome: boolean | null; phase: 0 | 1 | 2; t: number }
type Shard = { x: number; y: number; vx: number; vy: number; life: number; c: string }

const STEP = 1000 / 60
const BAND = 64
const EDGE = 24
const PS = 1.4 // player ship scale
const LAYERS = [
  { n: 60, size: 1, v: 0.15, c: 'ink2' },
  { n: 35, size: 1.5, v: 0.35, c: 'ink3' },
  { n: 15, size: 2, v: 0.7, c: 'paper3' },
]
const stars = LAYERS.map((L, i) => {
  const r = rng(101 + i)
  return Array.from({ length: L.n }, () => [r(), r()])
})
const clamp = (x: number, a: number, b: number) => Math.min(b, Math.max(a, x))

export const createField = (canvas: HTMLCanvasElement, opts: { calm: boolean }) => {
  const ctx = canvas.getContext('2d')!
  let calm = opts.calm
  let w = 1
  let h = 1
  let dpr = 1
  let ts: Target[] = []
  let fam: Family = 'rock'
  let size = 1
  let answers: number[] = []
  let shot: Shot | null = null
  let done: (() => void) | null = null
  let shards: Shard[] = []
  let focused = -1
  let paused = false
  let hidden = document.hidden
  let raf = 0
  let last = 0
  let acc = 0
  let tick = 0
  let sx = -1
  let tx = -1
  let off = LAYERS.map(() => 0)
  let sprites = new Map<string, HTMLCanvasElement>()
  let col = { field: '', paper: '', paper2: '', paper3: '', ink2: '', ink3: '', brick: '' }

  const readColors = () => {
    const s = getComputedStyle(canvas)
    const v = (n: string, f: string) => s.getPropertyValue(n).trim() || f
    col = {
      field: v('--ftg-field', '#16130f'),
      paper: v('--ftg-paper', '#fdfbf7'),
      paper2: v('--ftg-paper2', '#f2ece3'),
      paper3: v('--ftg-paper3', '#e8dfd2'),
      ink2: v('--ftg-ink2', '#4a423a'),
      ink3: v('--ftg-ink3', '#8a7f72'),
      brick: v('--ftg-brick', '#a84b32'),
    }
  }

  const rad = () => Math.max(18, Math.min(w, h) * 0.09) * size
  const sy = () => h - BAND / 2
  const k = () => (calm ? 0.35 : 1)
  // Drawn position: fly-in offset plus sub-step extrapolation so high-refresh screens stay smooth.
  const pos = (t: Target) => {
    const a = shot ? 0 : (acc / STEP) * k()
    const e = t.n <= 0 ? 0 : 1 - (1 - Math.min(1, (t.n * k()) / 30)) ** 3
    const y = t.y + t.vy * a
    const o = t.angle + t.rate * a
    // Ships and probes bob and tilt on the spin phase; only rocks spin.
    const rock = fam === 'rock'
    return { x: t.x + t.vx * a, y: y - (1 - e) * (y + 2 * rad()) + (rock ? 0 : 0.04 * rad() * Math.cos(o)), angle: rock ? o : 0.1745 * Math.sin(o) }
  }

  const sprite = (t: Target) => {
    let c = sprites.get(t.key)
    if (c) return c
    const R = rad()
    const s = R * 0.94
    c = document.createElement('canvas')
    c.width = c.height = Math.ceil(2 * R * dpr)
    const g = c.getContext('2d')!
    g.scale(dpr, dpr)
    g.translate(R, R)
    g.lineWidth = 1.5
    g.lineJoin = 'round'
    const path = (p: Pt[], close = true) => {
      g.beginPath()
      p.forEach(([x, y], i) => (i ? g.lineTo(x * s, y * s) : g.moveTo(x * s, y * s)))
      if (close) g.closePath()
    }
    const { outline, details, dots, lum, crack } = t.shape
    const tone = (c: string, al: number) => {
      g.globalAlpha = al
      g.fillStyle = c
      g.fill()
      g.globalAlpha = 1
    }
    outline.forEach((o, i) => {
      path(o)
      g.fillStyle = fam === 'rock' ? col.ink2 : fam === 'ship' || i === 0 ? col.paper2 : col.ink2
      g.fill()
      if (fam === 'rock') {
        tone(lum > 0 ? '#fff' : '#000', Math.abs(lum) * 3)
        // flat facets: triangles from the centre, light on the upper-left half, dark on the lower-right
        g.save()
        g.clip()
        o.forEach(([x, y], j) => {
          const [x2, y2] = o[(j + 1) % o.length]
          path([[0, 0], [x, y], [x2, y2]])
          if (x + x2 + y + y2 < 0) tone(col.paper3, 0.18)
          else tone(col.field, 0.4)
        })
        g.restore()
      }
      path(o)
      if (t.bad) tone(col.brick, 0.3)
      g.strokeStyle = t.bad ? col.brick : col.paper3
      g.lineWidth = fam === 'rock' ? 1.5 : 1
      g.stroke()
    })
    g.lineWidth = 1.5
    if (fam === 'ship') {
      path(details[1])
      tone(col.ink2, 0.6)
      path(details[0])
      g.fillStyle = col.ink3
      g.fill()
      g.strokeStyle = col.paper3
      g.stroke()
    } else {
      g.globalAlpha = fam === 'rock' ? 0.45 : 1
      g.strokeStyle = col.field
      for (const d of details) {
        path(d, false)
        g.stroke()
      }
    }
    g.globalAlpha = 1
    for (const [x, y, r] of dots) {
      g.beginPath()
      g.arc(x * s, y * s, r * s, 0, 7)
      if (fam === 'rock') {
        g.fillStyle = col.field
        g.globalAlpha = 0.4
        g.fill()
        g.globalAlpha = 1
        g.strokeStyle = col.paper3
        g.stroke()
      } else {
        g.fillStyle = col.brick
        g.fill()
      }
    }
    if (crack) {
      path(crack, false)
      g.strokeStyle = col.paper
      g.stroke()
    }
    sprites.set(t.key, c)
    return c
  }

  const fit = () => {
    dpr = window.devicePixelRatio || 1
    w = canvas.clientWidth || 1
    h = canvas.clientHeight || 1
    canvas.width = Math.round(w * dpr)
    canvas.height = Math.round(h * dpr)
    sprites = new Map()
    readColors()
    if (canvas.clientWidth) {
      if (sx < 0) sx = tx = w / 2
      sx = clamp(sx, EDGE, w - EDGE)
      tx = clamp(tx, EDGE, w - EDGE)
    }
    draw()
  }

  const finish = () => {
    const f = done
    done = null
    shot = null
    f?.()
  }

  const update = () => {
    const m = k()
    tick++
    if (!calm) off = off.map((o, i) => (o + LAYERS[i].v) % h)
    sx += (tx - sx) * 0.2 * m
    for (const t of ts) t.n++
    if (!shot) {
      const R = rad()
      for (const t of ts) {
        t.x += t.vx * m
        t.y += t.vy * m
        t.angle += t.rate * m
        if (t.x < R || t.x > w - R) t.vx = -t.vx
        if (t.y < R + 8 || t.y > h - BAND - R) t.vy = -t.vy
        t.x = clamp(t.x, R, w - R)
        t.y = clamp(t.y, R + 8, Math.max(R + 8, h - BAND - R))
      }
      for (let i = 0; i < ts.length; i++)
        for (let j = i + 1; j < ts.length; j++) {
          const a = ts[i]
          const b = ts[j]
          const dx = b.x - a.x
          const dy = b.y - a.y
          if (dx * dx + dy * dy < 4 * R * R && (b.vx - a.vx) * dx + (b.vy - a.vy) * dy < 0) {
            ;[a.vx, b.vx] = [b.vx, a.vx]
            ;[a.vy, b.vy] = [b.vy, a.vy]
          }
        }
    }
    for (const s of shards) {
      s.x += s.vx
      s.y += s.vy
      s.vy += 0.05
      s.life--
    }
    shards = shards.filter((s) => s.life > 0)
    if (!shot) return
    shot.t++
    if (shot.phase === 0) {
      if (Math.abs(sx - tx) < 1.5 || shot.t > 60) {
        sx = tx
        shot.phase = 1
        shot.t = 0
      }
    } else if (shot.phase === 1) {
      if (shot.t >= (calm ? 6 : 15)) {
        shot.phase = 2
        shot.t = 0
        if (shot.outcome && !calm) {
          const t = ts[shot.to]
          const r = rng(shot.to + 7)
          shards = Array.from({ length: 18 }, (_, i) => {
            const a = r() * 6.283
            const v = 1 + 2 * r()
            return { x: t.x, y: t.y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: 30, c: i % 2 ? col.paper3 : col.brick }
          })
        }
      }
    } else if (shot.t >= effect()) finish()
  }

  const effect = () => (calm ? 8 : shot!.outcome === null ? 21 : shot!.outcome ? 40 : 30)

  const draw = () => {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.fillStyle = col.field
    ctx.fillRect(0, 0, w, h)
    LAYERS.forEach((L, i) => {
      ctx.fillStyle = col[L.c as 'ink2']
      for (const [x, y] of stars[i]) ctx.fillRect(x * w, (y * h + off[i]) % h, L.size, L.size)
    })
    const p = shot && shot.phase === 2 ? shot.t / effect() : 0
    const shake = shot && shot.outcome === false && shot.phase === 2 && !calm ? Math.sin(shot.t * 1.8) * 4 * (1 - p) : 0
    const R = rad()
    const put = (t: Target, x: number, y: number, angle: number, scale = 1, alpha = 1) => {
      const c = Math.cos(angle) * scale * dpr
      const s = Math.sin(angle) * scale * dpr
      ctx.globalAlpha = alpha
      ctx.setTransform(c, s, -s, c, (x + shake) * dpr, y * dpr)
      ctx.drawImage(sprite(t), -R, -R, 2 * R, 2 * R)
      ctx.globalAlpha = 1
      ctx.setTransform(dpr, 0, 0, dpr, shake * dpr, 0)
    }
    ctx.setTransform(dpr, 0, 0, dpr, shake * dpr, 0)
    ctx.lineWidth = 2
    ts.forEach((t, i) => {
      const q = pos(t)
      if (shot && shot.to === i && shot.phase === 2) {
        if (shot.outcome === null) put(t, q.x, q.y, q.angle, 1 + 0.6 * p, 1 - p)
        else if (!shot.outcome) put(t, q.x, q.y, q.angle)
        return
      }
      put(t, q.x, q.y, q.angle)
      if (i === focused) {
        ctx.strokeStyle = col.brick
        ctx.beginPath()
        ctx.arc(q.x, q.y, R + 4, 0, 7)
        ctx.stroke()
      }
    })
    if (shot && shot.phase === 2 && shot.outcome !== null) {
      const t = ts[shot.to]
      const q = pos(t)
      ctx.lineCap = 'round'
      ctx.lineWidth = 3
      if (shot.outcome) {
        ctx.strokeStyle = col.brick
        ctx.globalAlpha = 1 - p
        ctx.beginPath()
        ctx.arc(q.x, q.y, R * (0.8 + 1.2 * p), 0, 7)
        ctx.stroke()
        ctx.globalAlpha = 1
        const cx = q.x + R * 0.8
        const cy = q.y - R * 0.8
        ctx.strokeStyle = col.paper
        ctx.beginPath()
        ctx.moveTo(cx - R * 0.25, cy)
        ctx.lineTo(cx - R * 0.05, cy + R * 0.2)
        ctx.lineTo(cx + R * 0.3, cy - R * 0.25)
        ctx.stroke()
      } else {
        ctx.strokeStyle = col.brick
        const cx = q.x + R * 0.8
        const cy = q.y - R * 0.8
        const d = R * 0.25
        ctx.beginPath()
        ctx.moveTo(cx - d, cy - d)
        ctx.lineTo(cx + d, cy + d)
        ctx.moveTo(cx + d, cy - d)
        ctx.lineTo(cx - d, cy + d)
        ctx.stroke()
        ctx.lineWidth = 2
        ctx.setLineDash([6, 6])
        for (const a of answers) {
          const z = pos(ts[a])
          ctx.beginPath()
          ctx.arc(z.x, z.y, R + 6, 0, 7)
          ctx.stroke()
        }
        ctx.setLineDash([])
      }
      ctx.lineCap = 'butt'
    }
    for (const s of shards) {
      ctx.globalAlpha = s.life / 30
      ctx.fillStyle = s.c
      ctx.fillRect(s.x - 2, s.y - 2, 4, 4)
    }
    ctx.globalAlpha = 1
    const y = sy()
    if (shot && shot.phase === 1) {
      const q = pos(ts[shot.to])
      const f = shot.t / (calm ? 6 : 15)
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
    ctx.save()
    ctx.translate(sx, y)
    ctx.scale(PS, PS)
    ctx.fillStyle = col.paper
    ctx.beginPath()
    ctx.moveTo(-4, 9)
    ctx.lineTo(4, 9)
    ctx.lineTo(0, 14 + (tick % 6 < 3 ? 7 : 3))
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

  const frame = (now: number) => {
    acc += Math.min(250, now - last)
    last = now
    while (acc >= STEP) {
      update()
      acc -= STEP
    }
    draw()
    raf = requestAnimationFrame(frame)
  }

  const sync = () => {
    cancelAnimationFrame(raf)
    raf = 0
    if (paused || hidden) return
    last = performance.now()
    acc = 0
    raf = requestAnimationFrame(frame)
  }

  const onVisibility = () => {
    hidden = document.hidden
    sync()
  }

  const observer = new ResizeObserver(fit)
  observer.observe(canvas)
  document.addEventListener('visibilitychange', onVisibility)
  fit()
  sync()

  return {
    show(wave: Wave, names: string[], anchor: boolean) {
      finish()
      if (canvas.clientWidth !== w || canvas.clientHeight !== h) fit()
      const look = waveLook(wave.symbols, wave.seed)
      fam = look.family
      size = look.size
      answers = wave.answers
      sprites = new Map()
      shards = []
      focused = -1
      const rand = rng(wave.seed * 31 + wave.step)
      const R = rad()
      const speed = 0.9 + 0.3 * wave.step
      ts = wave.symbols.map((token, i) => {
        const bad = anchor && wave.answers.includes(i)
        const sh = shape(token, look, { bad })
        const a = rand() * 6.283
        const t: Target = {
          x: R + rand() * Math.max(0, w - 2 * R),
          y: R + 8 + rand() * Math.max(0, h - BAND - 2 * R - 8),
          vx: Math.cos(a) * speed,
          vy: Math.sin(a) * speed,
          angle: sh.spin.phase,
          rate: sh.spin.rate,
          n: -i * 6,
          key: `${token}|${bad}`,
          bad,
          shape: sh,
        }
        sprite(t)
        return t
      })
      canvas.setAttribute('aria-label', names.join(', '))
      draw()
    },
    aim(x: number) {
      if (!shot) tx = clamp(x, EDGE, w - EDGE)
    },
    focus(i: number) {
      focused = i
    },
    shoot(index: number, outcome: boolean | null) {
      finish()
      tx = ts[index].x
      shot = { to: index, outcome, phase: 0, t: 0 }
      return new Promise<void>((resolve) => {
        done = resolve
      })
    },
    pause() {
      paused = true
      sync()
    },
    resume() {
      paused = false
      sync()
    },
    setCalm(b: boolean) {
      calm = b
    },
    rockAt(x: number, y: number): number {
      let best = -1
      let d = (rad() * 1.3) ** 2
      ts.forEach((t, i) => {
        const p = pos(t)
        const e = (p.x - x) ** 2 + (p.y - y) ** 2
        if (e <= d) {
          d = e
          best = i
        }
      })
      return best
    },
    destroy() {
      finish()
      cancelAnimationFrame(raf)
      observer.disconnect()
      document.removeEventListener('visibilitychange', onVisibility)
    },
  }
}

export type Field = ReturnType<typeof createField>
