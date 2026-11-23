import { canonical, content } from '../engine.ts'
import type { Deck } from '../engine.ts'

export const sha256 = async (s: string) =>
  [...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s)))].map((x) => x.toString(16).padStart(2, '0')).join('')

export const LAYOUT = 1
const editions = new Map<Deck, Promise<string>>()
export const edition = (d: Deck) => {
  if (!editions.has(d)) editions.set(d, sha256(canonical([LAYOUT, content(d)])).then((h) => `${d.id}:${h.slice(0, 12)}`))
  return editions.get(d)!
}
