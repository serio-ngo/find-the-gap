import { rng } from './engine.ts'
import type { Wave } from './engine.ts'
import { hash } from './gen.ts'
import type { TargetObject } from './objects.ts'
import { BAND, EDGE, LAYERS, STEP, clamp, finish, pos, rad, sprite } from './field.ts'
import type { State } from './field.ts'
import { update } from './motion.ts'
import { draw } from './paint.ts'

export const createField = (canvas: HTMLCanvasElement, opts: { calm: boolean }) => {
  const s: State = {
    ctx: canvas.getContext('2d')!, calm: opts.calm, w: 1, h: 1, dpr: 1, ts: [], inspected: false, open: 0, answers: [], shot: null,
    done: null, shards: [], ghost: null, focused: -1, acc: 0, tick: 0, sx: -1, tx: -1, off: LAYERS.map(() => 0), sprites: new Map(),
    col: { field: '', paper: '', paper2: '', paper3: '', ink2: '', ink3: '', brick: '' },
  }
  let paused = false
  let hidden = document.hidden
  let raf = 0
  let last = 0

  const readColors = () => {
    const st = getComputedStyle(canvas)
    const v = (n: string, f: string) => st.getPropertyValue(n).trim() || f
    s.col = {
      field: v('--ftg-field', '#16130f'), paper: v('--ftg-paper', '#fdfbf7'), paper2: v('--ftg-paper2', '#f2ece3'), paper3: v('--ftg-paper3', '#e8dfd2'),
      ink2: v('--ftg-ink2', '#4a423a'), ink3: v('--ftg-ink3', '#8a7f72'), brick: v('--ftg-brick', '#a84b32'),
    }
  }

  const fit = () => {
    s.dpr = window.devicePixelRatio || 1
    s.w = canvas.clientWidth || 1
    s.h = canvas.clientHeight || 1
    canvas.width = Math.round(s.w * s.dpr)
    canvas.height = Math.round(s.h * s.dpr)
    s.sprites = new Map()
    readColors()
    if (canvas.clientWidth) {
      if (s.sx < 0) s.sx = s.tx = s.w / 2
      s.sx = clamp(s.sx, EDGE, s.w - EDGE)
      s.tx = clamp(s.tx, EDGE, s.w - EDGE)
    }
    draw(s)
  }

  const frame = (now: number) => {
    s.acc += Math.min(250, now - last)
    last = now
    while (s.acc >= STEP) {
      update(s)
      s.acc -= STEP
    }
    draw(s)
    raf = requestAnimationFrame(frame)
  }

  const sync = () => {
    cancelAnimationFrame(raf)
    raf = 0
    if (paused || hidden) return
    last = performance.now()
    s.acc = 0
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
    show(wave: Wave, objects: TargetObject[], names: string[]) {
      if (s.shot && s.shot.phase === 2) {
        const t = s.ts[s.shot.to]!
        const q = pos(s, t)
        s.ghost = { t, x: q.x, y: q.y, angle: q.angle, life: 0 }
      }
      finish(s)
      if (canvas.clientWidth !== s.w || canvas.clientHeight !== s.h) fit()
      s.answers = []
      s.inspected = false
      s.open = 0
      s.sprites = new Map()
      s.focused = -1
      const rand = rng(hash(objects[0]!.id))
      const R = rad(s)
      const speed = 0.9 + 0.3 * wave.step
      const count = objects.length
      const height = Math.max(2 * R, s.h - BAND - 8)
      const columns = Math.min(count, Math.ceil(Math.sqrt(count * s.w / height)))
      const rows = Math.ceil(count / columns)
      const slots = objects.map((_, i) => ({ i, rank: rand() })).sort((a, b) => a.rank - b.rank)
      s.ts = objects.map(({ id, shape }, i) => {
        const slot = slots[i]!.i
        const row = Math.floor(slot / columns)
        const rowLength = Math.min(columns, count - row * columns)
        const a = rand() * 2 * Math.PI
        return {
          x: s.w * (slot % columns + 0.5) / rowLength, y: 8 + height * (row + 0.5) / rows, vx: Math.cos(a) * speed, vy: Math.sin(a) * speed,
          angle: shape.spin.phase, rate: shape.spin.rate, n: -slot * 4, key: id, shape,
        }
      })
      s.ts.forEach((t) => sprite(s, t))
      canvas.setAttribute('aria-label', names.join(', '))
      draw(s)
    },
    aim(x: number) {
      if (!s.shot) s.tx = clamp(x, EDGE, s.w - EDGE)
    },
    focus(i: number) {
      s.focused = i
    },
    inspect(enabled: boolean) {
      s.inspected = enabled
      if (s.calm || !enabled) s.open = Number(enabled && s.calm)
      draw(s)
    },
    shoot(index: number, outcome: boolean | null, answerIndices: readonly number[] = []) {
      finish(s)
      s.answers = answerIndices
      s.tx = s.ts[index]!.x
      s.shot = { to: index, outcome, phase: 0, t: 0 }
      return new Promise<void>((resolve) => {
        s.done = resolve
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
      s.calm = b
    },
    rockAt(x: number, y: number): number {
      let best = -1
      let d = (rad(s) * 1.3) ** 2
      s.ts.forEach((t, i) => {
        const p = pos(s, t)
        const e = (p.x - x) ** 2 + (p.y - y) ** 2
        if (e <= d) {
          d = e
          best = i
        }
      })
      return best
    },
    destroy() {
      finish(s)
      cancelAnimationFrame(raf)
      observer.disconnect()
      document.removeEventListener('visibilitychange', onVisibility)
    },
  }
}

export type Field = ReturnType<typeof createField>
