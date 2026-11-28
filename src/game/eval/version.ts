import { canonical } from '../engine.ts'
import type { Row, World } from '../levels/observations.ts'

export const sha256 = async (s: string) =>
  [...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s)))].map((x) => x.toString(16).padStart(2, '0')).join('')

export const LAYOUT = 4
const editions = new Map<World, [Row[], Promise<string>]>()
export const edition = (w: World, rows: Row[]) => {
  if (editions.get(w)?.[0] !== rows) editions.set(w, [rows, sha256(canonical([LAYOUT, w, rows])).then((h) => `world:${h.slice(0, 12)}`)])
  return editions.get(w)![1]
}
