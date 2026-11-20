import { rng } from './engine.ts'
import type { Wave } from './engine.ts'

type Rock = { nx: number; ny: number; vx: number; vy: number; symbol: string; crack: number }
type Shot = { to: number; hit: boolean; answers: number[]; t: number; travel: number; hold: number }
type Spark = { x: number; y: number; vx: number; vy: number; life: number }

const STEP = 1000 / 60
const TOP = 0.7

export const createField = (canvas: HTMLCanvasElement, opts: { calm: boolean }) => {
  const ctx = canvas.getContext('2d')!
  let calm = opts.calm
  let w = 1
  let h = 1
  let dpr = 1
  let rocks: Rock[] = []
  let shot: Shot | null = null
  let done: (() => void) | null = null
  let sparks: Spark[] = []
  let paused = false
  let hidden = document.hidden
  let raf = 0
  let last = 0
  let acc = 0
  let sprites = new Map<string, HTMLCanvasElement>()
  let colors = { text: '', accent: '', ok: '', bad: '', field: '', shell: '', font: '' }

  const readColors = () => {
    const s = getComputedStyle(canvas)
    const v = (n: string, f: string) => s.getPropertyValue(n).trim() || f
    colors = {
      text: v('--brand-text', '#f2f4f8'),
      accent: v('--brand-accent', '#ffd166'),
      ok: v('--brand-ok', '#3ddc97'),
      bad: v('--brand-bad', '#ff6b6b'),
      field: v('--brand-field', '#121a33'),
      shell: v('--brand-surface', '#1c2646'),
      font: v('--brand-font', 'system-ui, sans-serif'),
    }
  }

  const radius = () => Math.max(18, Math.min(w, h) * 0.09)
  const px = (r: Rock) => {
    const m = radius()
    return { x: m + r.nx * (w - 2 * m), y: m + r.ny * (h - 2 * m) }
  }

  const sprite = (symbol: string) => {
    let c = sprites.get(symbol)
    if (c) return c
    const r = radius()
    c = document.createElement('canvas')
    c.width = c.height = Math.ceil(r * 2 * dpr)
    const g = c.getContext('2d')!
    g.scale(dpr, dpr)
    g.textAlign = 'center'
    g.textBaseline = 'middle'
    g.fillStyle = colors.text
    g.font = `${r}px ${colors.font}`
    const wide = g.measureText(symbol).width
    g.font = `${wide > r * 1.7 ? (r * r * 1.7) / wide : r}px ${colors.font}`
    g.fillText(symbol, r, r)
    sprites.set(symbol, c)
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
    draw()
  }

  const finish = () => {
    const f = done
    done = null
    shot = null
    f?.()
  }

  const update = () => {
    const k = calm ? 0.35 : 1
    for (const r of rocks) {
      if (r.crack < 1) r.crack = Math.min(1, r.crack + 1 / 30)
      if (shot) continue
      r.nx += r.vx * k
      r.ny += r.vy * k
      if (r.nx < 0 || r.nx > 1) {
        r.vx = -r.vx
        r.nx = Math.min(1, Math.max(0, r.nx))
      }
      if (r.ny < 0 || r.ny > TOP) {
        r.vy = -r.vy
        r.ny = Math.min(TOP, Math.max(0, r.ny))
      }
    }
    for (const s of sparks) {
      s.x += s.vx
      s.y += s.vy
      s.life--
    }
    sparks = sparks.filter((s) => s.life > 0)
    if (shot && ++shot.t >= shot.travel + shot.hold) finish()
  }

  const draw = () => {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.clearRect(0, 0, w, h)
    const r = radius()
    const sinceHit = shot ? shot.t - shot.travel : -1
    const shake = shot && !shot.hit && !calm && sinceHit >= 0 ? Math.sin(shot.t) * 4 * Math.max(0, 1 - sinceHit / 20) : 0
    ctx.translate(shake, 0)
    ctx.lineWidth = 3
    rocks.forEach((rock, i) => {
      const { x, y } = px(rock)
      ctx.fillStyle = colors.field
      ctx.beginPath()
      ctx.arc(x, y, r, 0, 7)
      ctx.fill()
      ctx.drawImage(sprite(rock.symbol), x - r, y - r, r * 2, r * 2)
      ctx.strokeStyle = colors.shell
      if (rock.crack < 1) {
        ctx.fillStyle = colors.shell
        ctx.strokeStyle = colors.accent
        for (const side of [-1, 1]) {
          ctx.save()
          ctx.beginPath()
          ctx.rect(side < 0 ? x - r - 2 : x, y - r - 2, r + 2, r * 2 + 4)
          ctx.clip()
          ctx.translate(side * rock.crack * r * 1.2, 0)
          ctx.beginPath()
          ctx.arc(x, y, r, 0, 7)
          ctx.fill()
          ctx.stroke()
          ctx.restore()
        }
      } else {
        ctx.beginPath()
        ctx.arc(x, y, r, 0, 7)
        ctx.stroke()
      }
      if (!shot || sinceHit < 0) return
      if (shot.answers.includes(i)) {
        ctx.strokeStyle = colors.ok
        ctx.beginPath()
        ctx.arc(x, y, r + 6, 0, 7)
        ctx.stroke()
      }
      if (i === shot.to) {
        ctx.fillStyle = shot.hit ? colors.ok : colors.bad
        ctx.font = `bold ${r}px ${colors.font}`
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.fillText(shot.hit ? '✓' : '✕', x + r * 0.8, y - r * 0.8)
        if (!shot.hit) {
          ctx.strokeStyle = colors.bad
          ctx.setLineDash([6, 6])
          ctx.beginPath()
          ctx.arc(x, y, r + 6, 0, 7)
          ctx.stroke()
          ctx.setLineDash([])
        }
      }
    })
    ctx.fillStyle = colors.text
    for (const s of sparks) ctx.fillRect(s.x, s.y, 3, 3)
    const sx = w / 2
    const sy = h - r * 0.7
    ctx.fillStyle = colors.accent
    ctx.beginPath()
    ctx.moveTo(sx, sy - r * 0.6)
    ctx.lineTo(sx + r * 0.5, sy + r * 0.4)
    ctx.lineTo(sx - r * 0.5, sy + r * 0.4)
    ctx.fill()
    if (shot && sinceHit < 0) {
      const p = px(rocks[shot.to])
      const f = shot.t / shot.travel
      ctx.beginPath()
      ctx.arc(sx + (p.x - sx) * f, sy + (p.y - sy) * f, 5, 0, 7)
      ctx.fill()
    }
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
    show(wave: Wave, labels: string[]) {
      finish()
      const rand = rng(wave.seed * 31 + wave.step)
      const speed = 0.0015 + 0.0005 * wave.step
      rocks = wave.symbols.map((symbol) => {
        const a = rand() * 6.283
        return { nx: rand(), ny: rand() * TOP, vx: Math.cos(a) * speed, vy: Math.sin(a) * speed, symbol, crack: 0 }
      })
      sparks = []
      canvas.setAttribute('aria-label', labels.join(', '))
      draw()
    },
    shoot(index: number, hit: boolean, answers: number[]) {
      finish()
      shot = { to: index, hit, answers, t: 0, travel: calm ? 6 : 20, hold: calm ? 3 : 50 }
      if (hit && !calm) {
        const rand = rng(index + 7)
        const p = px(rocks[index])
        sparks = Array.from({ length: 16 }, () => {
          const a = rand() * 6.283
          return { x: p.x, y: p.y, vx: Math.cos(a) * 2, vy: Math.sin(a) * 2, life: 30 }
        })
      }
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
      let d = (radius() * 1.3) ** 2
      rocks.forEach((rock, i) => {
        const p = px(rock)
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
