import type { Field } from './render.ts'

export const bindInput = (
  root: HTMLElement,
  field: Pick<Field, 'rockAt'>,
  handlers: { pick(i: number): void; togglePause(): void },
) => {
  const twins = () => [...root.querySelectorAll<HTMLButtonElement>('[data-rock]')]

  const onKey = (e: KeyboardEvent) => {
    if (e.key === 'p' || e.key === 'P' || e.key === 'Escape') {
      handlers.togglePause()
      e.preventDefault()
      return
    }
    const dir = e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? -1 : 0
    const list = twins()
    if (!dir || !list.length) return
    const at = list.indexOf(document.activeElement as HTMLButtonElement)
    list[(at + dir + list.length) % list.length].focus()
    e.preventDefault()
  }

  const onPointer = (e: PointerEvent) => {
    const box = (e.currentTarget as HTMLElement).getBoundingClientRect()
    const i = field.rockAt(e.clientX - box.left, e.clientY - box.top)
    if (i >= 0) twins()[i]?.click()
  }

  const canvas = root.querySelector('canvas')
  root.addEventListener('keydown', onKey)
  canvas?.addEventListener('pointerdown', onPointer)
  return () => {
    root.removeEventListener('keydown', onKey)
    canvas?.removeEventListener('pointerdown', onPointer)
  }
}
