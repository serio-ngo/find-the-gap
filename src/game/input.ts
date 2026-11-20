import type { Field } from './render.ts'

export const bindInput = (
  root: HTMLElement,
  field: Pick<Field, 'rockAt'>,
  handlers: { togglePause(): void; focus(i: number): void; aim(x: number): void },
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

  const onPointer = (e: PointerEvent) => {
    const box = (e.currentTarget as HTMLElement).getBoundingClientRect()
    const i = field.rockAt(e.clientX - box.left, e.clientY - box.top)
    if (i >= 0) twins()[i]?.click()
  }

  const onFocus = (e: FocusEvent) => {
    const el = (e.target as HTMLElement).closest<HTMLElement>('[data-rock]')
    if (el) handlers.focus(e.type === 'focusin' && el.matches(':focus-visible') ? twins().indexOf(el as HTMLButtonElement) : -1)
  }

  const onMove = (e: PointerEvent) => handlers.aim(e.clientX - (e.currentTarget as HTMLElement).getBoundingClientRect().left)

  const canvas = root.querySelector('canvas')
  root.addEventListener('keydown', onKey)
  root.addEventListener('focusin', onFocus)
  root.addEventListener('focusout', onFocus)
  canvas?.addEventListener('pointerdown', onPointer)
  canvas?.addEventListener('pointermove', onMove)
  return () => {
    root.removeEventListener('keydown', onKey)
    root.removeEventListener('focusin', onFocus)
    root.removeEventListener('focusout', onFocus)
    canvas?.removeEventListener('pointermove', onMove)
    canvas?.removeEventListener('pointerdown', onPointer)
  }
}
