import type { Field } from './render.ts'

export const bindInput = (
  root: HTMLElement,
  field: Pick<Field, 'rockAt'>,
  handlers: { togglePause(): void; focus(i: number): void; aim(x: number, y: number): void; lock(i: number): void },
) => {
  const twins = () => [...root.querySelectorAll<HTMLButtonElement>('[data-rock]')]

  const onKey = (e: KeyboardEvent) => {
    if (e.key === 'p' || e.key === 'P' || e.key === 'Escape') {
      if (['play', 'paused'].includes(root.dataset.phase!)) {
        handlers.togglePause()
        e.preventDefault()
      }
      return
    }
    const dir = e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? -1 : 0
    const list = twins()
    if (!dir || !list.length) return
    const at = list.indexOf(document.activeElement as HTMLButtonElement)
    list[(at + dir + list.length) % list.length]!.focus()
    e.preventDefault()
  }

  // Hover or press aims; releasing on the rock that was pressed fires. Sliding off before release cancels the shot.
  const at = (e: PointerEvent) => {
    const box = (e.currentTarget as HTMLElement).getBoundingClientRect()
    return [e.clientX - box.left, e.clientY - box.top] as const
  }
  let pressed = -1
  const onDown = (e: PointerEvent) => {
    const [x, y] = at(e)
    handlers.aim(x, y)
    pressed = field.rockAt(x, y)
  }
  const onUp = (e: PointerEvent) => {
    const [x, y] = at(e)
    const i = field.rockAt(x, y)
    if (i >= 0 && i === pressed) twins()[i]?.click()
    pressed = -1
  }

  const onFocus = (e: FocusEvent) => {
    const el = (e.target as HTMLElement).closest<HTMLElement>('[data-rock]')
    if (el) handlers.focus(e.type === 'focusin' && el.matches(':focus-visible') ? twins().indexOf(el as HTMLButtonElement) : -1)
  }

  const onMove = (e: PointerEvent) => handlers.aim(...at(e))
  const onLeave = () => {
    pressed = -1
    handlers.lock(-1)
  }

  const canvas = root.querySelector('canvas')
  root.addEventListener('keydown', onKey)
  root.addEventListener('focusin', onFocus)
  root.addEventListener('focusout', onFocus)
  canvas?.addEventListener('pointerdown', onDown)
  canvas?.addEventListener('pointerup', onUp)
  canvas?.addEventListener('pointermove', onMove)
  canvas?.addEventListener('pointerleave', onLeave)
  return () => {
    root.removeEventListener('keydown', onKey)
    root.removeEventListener('focusin', onFocus)
    root.removeEventListener('focusout', onFocus)
    canvas?.removeEventListener('pointermove', onMove)
    canvas?.removeEventListener('pointerleave', onLeave)
    canvas?.removeEventListener('pointerdown', onDown)
    canvas?.removeEventListener('pointerup', onUp)
  }
}
