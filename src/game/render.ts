import type { TargetObject } from './objects.ts'
import { BAND, EDGE, LAYERS, STEP, TOP, clamp, finish, pos, rad, sprite } from './field.ts'
import type { State } from './field.ts'
import { update } from './motion.ts'
import { draw } from './paint.ts'

// onAim reports every change of the locked rock (-1: none), so the page can measure aim dwell and switches.
export const createField = (canvas: HTMLCanvasElement, opts: { calm: boolean; onAim?: (i: number) => void }) => {
  const s: State = {
    ctx: canvas.getContext('2d')!, calm: opts.calm, w: 1, h: 1, dpr: 1, cols: 1, rows: 1, ts: [], answers: [], shot: null,
    done: null, shards: [], focused: -1, aim: -1, aimT: 0, acc: 0, tick: 0, sx: -1, sy: -1, tx: -1, ty: -1, angle: 0,
    off: LAYERS.map(() => 0), sprites: new Map(),
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
      s.sy = s.ty = clamp(s.ty < 0 ? s.h - BAND / 2 : s.ty, s.h - BAND + 18, s.h - 22)
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

  const lock = (i: number) => {
    if (i === s.aim) return
    s.aim = i
    s.aimT = 0
    opts.onAim?.(i)
  }

  return {
    // Every rock and its marks are in place in the first frame; the display order (already neutral) fills the cells row by row.
    show(objects: TargetObject[], names: string[]) {
      finish(s)
      if (canvas.clientWidth !== s.w || canvas.clientHeight !== s.h) fit()
      s.answers = []
      s.sprites = new Map()
      s.focused = -1
      s.aim = -1
      const count = objects.length
      // the grid with the largest cells wins; on a tie, fewer columns
      const cell = (c: number) => Math.min(s.w / c, (s.h - BAND - TOP) / Math.ceil(count / c))
      s.cols = Array.from({ length: count }, (_, i) => i + 1).reduce((best, c) => (cell(c) > cell(best) ? c : best))
      s.rows = Math.ceil(count / s.cols)
      s.ts = objects.map(({ id, shape }, slot) => {
        const row = Math.floor(slot / s.cols)
        const rowLength = Math.min(s.cols, count - row * s.cols)
        return { cx: (slot % s.cols + 0.5) / rowLength, cy: (row + 0.5) / s.rows, phase: slot * 1.7, key: id, shape }
      })
      s.ts.forEach((t) => sprite(s, t))
      canvas.setAttribute('aria-label', names.join(', '))
      draw(s)
    },
    // The ship follows the pointer: along x anywhere, along y inside the bottom band. A rock under the pointer gets the lock.
    aim(x: number, y: number) {
      s.tx = clamp(x, EDGE, s.w - EDGE)
      s.ty = clamp(s.h - BAND + 18 + ((y / s.h) * (BAND - 40)), s.h - BAND + 18, s.h - 22)
      if (!s.shot) lock(this.rockAt(x, y))
    },
    lock(i: number) {
      if (!s.shot) lock(i)
    },
    focus(i: number) {
      if (!s.shot && (i >= 0 || s.focused === s.aim)) lock(i)
      s.focused = i
    },
    shoot(index: number, outcome: boolean | null, answerIndices: readonly number[] = []) {
      finish(s)
      s.answers = answerIndices
      lock(index)
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
      let d = (rad(s) * 0.9) ** 2
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
