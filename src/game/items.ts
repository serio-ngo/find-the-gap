import { Copy, Key, Lock, Unlink } from 'lucide'
import type { Row } from './levels/observations.ts'

export const ICONS = { odd_revision: Key, missing_link: Unlink, pair: Copy, lock_only: Lock }
export type Item = keyof typeof ICONS

export const itemOf = ({ rule }: Pick<Row, 'rule'>): Item => rule as Item

export const icon = (item: Item) =>
  `<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[item].map(([tag, attrs]) => `<${tag} ${Object.entries(attrs).map(([k, v]) => `${k}="${v}"`).join(' ')}/>`).join('')}</svg>`

export const collection = (bag: Map<Item, number>, l: Record<Item, string>) =>
  [...bag].map(([item, n]) => `<span class="ftg-item" role="img" aria-label="${l[item]}: ${n}">${icon(item)}<span class="ftg-count" aria-hidden="true">${n}</span></span>`).join('')
