type Handlers = { pause(): void; move(dx: number, dy: number): void; walk(kind: string, i: number): void; stamp(i: number): void; travel(id: string): void }

const KEYS: Record<string, [number, number]> = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }

export const bindInput = (root: HTMLElement, h: Handlers) => {
  const playing = () => root.dataset.phase === 'play'

  const onKey = (e: KeyboardEvent) => {
    if (e.key === 'p' || e.key === 'P' || e.key === 'Escape') {
      if (['play', 'paused'].includes(root.dataset.phase!)) {
        h.pause()
        e.preventDefault()
      }
      return
    }
    const d = KEYS[e.key]
    if (!playing()) return
    if (d) h.move(d[0], d[1])
    else if ((e.key === 'Enter' || e.key === ' ') && !(e.target as HTMLElement).closest('button, a, input')) h.stamp(-1)
    else return
    e.preventDefault()
  }

  const onClick = (e: MouseEvent) => {
    const map = (e.target as Element).closest('.ftg-map')
    const pin = map && [...map.querySelectorAll<HTMLElement>('[data-go]')].map((a) => { const b = a.getBoundingClientRect(); return { a, d: Math.hypot(b.x + b.width / 2 - e.clientX, b.y + b.height / 2 - e.clientY) } }).sort((x, y) => x.d - y.d)[0]
    const el = (e.target as HTMLElement).closest<HTMLElement>('[data-act], [data-move], [data-walk], [data-go]') ?? (pin && pin.d < 24 ? pin.a : null)
    if (!el) return
    if (el.dataset.go) e.preventDefault()
    if (el.dataset.act) h.pause()
    else if (!playing()) return
    else if (el.dataset.move) h.move(...(el.dataset.move.split(',').map(Number) as [number, number]))
    else if (el.dataset.go) h.travel(el.dataset.go)
    else if (el.dataset.walk) h.walk(el.dataset.walk[0]!, Number(el.dataset.walk.slice(1)))
  }

  root.addEventListener('keydown', onKey)
  root.addEventListener('click', onClick)
  return () => {
    root.removeEventListener('keydown', onKey)
    root.removeEventListener('click', onClick)
  }
}
