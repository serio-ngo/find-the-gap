import { Badge, BadgeCheck, BadgeX } from 'lucide'
import type { ChoiceRecord } from './engine.ts'

export const ICONS = { Badge, BadgeCheck, BadgeX }
export type Item = keyof typeof ICONS

export const ITEMS: Item[] = ['Badge', 'BadgeX', 'BadgeCheck']

export const itemOf = ({ signs }: ChoiceRecord): Item => (signs ? ITEMS[signs.job]! : 'Badge')

export const icon = (item: Item) =>
  `<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[item].map(([tag, attrs]) => `<${tag} ${Object.entries(attrs).map(([k, v]) => `${k}="${v}"`).join(' ')}/>`).join('')}</svg>`

export const collection = (bag: Map<Item, number>, l: Record<Item, string>) =>
  [...bag].map(([item, n]) => `<span class="ftg-item" role="img" aria-label="${l[item]}: ${n}">${icon(item)}<span class="ftg-count" aria-hidden="true">${n}</span></span>`).join('')
