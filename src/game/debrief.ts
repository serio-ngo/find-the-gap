import { chart } from './chart.ts'
import { report } from './engine.ts'
import type { Deck, Game } from './engine.ts'
import type { Facts } from './gen.ts'
import type { presentObjects } from './objects.ts'

type Strings = typeof import('./strings.json')
export type Text = { v: Strings['visible']['en']; l: Strings['labels']['en'] & Record<string, string | undefined> }
export type Rounds = ReturnType<typeof presentObjects>[]

export const describe = (f: Facts, l: Record<string, string | undefined>) => {
  const n = (key: string, v: number) => l[key]!.replace('{n}', String(v))
  return [
    n('crystals', f.crystals), n('sockets', f.sockets), f.symmetric ? l.symmetric : l.lopsided,
    ...(f.segments ? [n('halo', f.segments).replace('{q}', String(f.lit)), n('craters', f.craters), n('alien', f.eyes), f.bright ? l.bright! : l.dim!] : []),
  ].join(', ')
}

export const showResult = (root: HTMLElement, deck: Deck, g: Game, { v, l }: Text) => {
  root.querySelector('.ftg-chart')!.innerHTML = chart(report(deck, g), { ...v, chart: l.chart })
  const nextEl = root.querySelector<HTMLAnchorElement>('.ftg-next')!
  nextEl.hidden = !deck.levels.some((x) => x.id === g.level + 1)
  nextEl.href = `${root.dataset.next}${location.search}`
}
