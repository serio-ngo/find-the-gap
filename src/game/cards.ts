import { rooms } from './engine.ts'
import { hash, monster } from './gen.ts'
import { icon, itemOf } from './items.ts'
import { clueOf } from './levels/observations.ts'
import type { Binding } from './levels/observations.ts'
import type { Scene, Slim } from './view.ts'

export const ICON: Record<Binding['station'], string> = { lamp: 'lamp', padlock: 'lock', ring: 'ring10', drone: 'drone', crack: 'crack' }
const GEM = '<rect x="5" y="5" width="14" height="14" stroke="#2B2620" stroke-width="1.6" transform="rotate(45 12 12)"'
const TINT: Record<string, string> = { odd_revision: '#DDEFEC', missing_link: '#F3DCE7', pair: '#E5DFF5', lock_only: '#F5E6CF' }

export const f = (s: string | undefined, ...v: (string | number)[]) => v.reduce<string>((t, x) => t.replace(/\{\w+\}/, String(x)), s ?? '')

export const memo = (el: Element, key: string, html: () => string) => {
  const e = el as HTMLElement
  if (e.dataset.k !== key) {
    e.dataset.k = key
    e.innerHTML = html()
  }
}

const glyph = (v: string) => (/^pass/.test(v) ? '✓' : /^fail/.test(v) ? '✗' : v === '-' ? '·' : v === 'missing' ? '∅' : '◆●■▲▼◐◑★'[hash(v) % 8]!)

export const foot = ({ rule, values }: Slim) =>
  rule === 'odd_revision' ? `${values[0]} ${values[0] === values[1] ? '=' : '≠'} ${values[1]}` : values.map(glyph).join(' ')

export const describe = (m: Slim, l: Scene['l']) => {
  const c = m.context?.criteria ?? 0
  return `${m.values.join(', ')}; ${f(l.eyes, c <= 3 ? 1 : c === 4 ? 2 : 3)}`
}

const clue = (b: Binding, m: Slim, l: Scene['l']) => {
  const v = clueOf(b.field, m.context!)
  const on = b.field === 'job' ? v === 'success' : Number(v) > 0
  const n = b.field === 'locks' || b.field === 'share' ? v : ''
  const say = b.field === 'job' ? (on ? l.lit : l.smoking) : b.field === 'share' ? f(l.ringOf, v ?? 0) : b.field === 'locks' ? String(v) : on ? l.yes : l.no
  const name = l[b.station]!
  return { name, say, svg: (size: string) => `<svg class="${size}" viewBox="0 0 24 24" opacity="${on || b.field === 'share' ? 1 : 0.2}"><use href="#rg-i-${b.field === 'job' && !on ? 'smoke' : ICON[b.station]}"/>${n === '' ? '' : `<text x="23" y="23" text-anchor="end">${n}</text>`}</svg>` }
}

export const panel = (s: Scene, k: number) => {
  const st = s.lay.items[k]
  if (!st) return `<div class="ftg-idle" role="img" aria-label="${s.l.idle}"><svg viewBox="0 0 24 24"><use href="#rg-i-unknown"/></svg><svg viewBox="0 0 24 24"><use href="#rg-i-unknown"/></svg></div>`
  const c = clue(st, s.monsters[st.m]!, s.l)
  return `<div class="ftg-sheet" role="group" aria-label="${f(s.l.reading, c.name, `${f(s.l.pick, st.m + 1)} ${c.say}`)}"><div class="ftg-base"><svg viewBox="0 0 24 24"><use href="#rg-i-${ICON[st.station]}"/></svg><svg viewBox="0 0 48 30"><use href="#rg-i-plinth"/></svg></div><div class="ftg-col">${monster(s.monsters[st.m]!)}${c.svg('ftg-clue')}</div></div>`
}

export const result = (s: Scene) => {
  const m = s.monsters[s.pick]!
  const mark = s.room.certain ? `<svg viewBox="0 0 24 24" role="img" aria-label="${s.hit ? s.l.hit : s.l.miss}">${GEM} fill="${s.hit ? '#E8C26A' : '#CFC6AF'}"/><path d="${s.hit ? 'M8,12 L11,15 L16,9' : 'M9,9 L15,15 M15,9 L9,15'}" stroke="#2B2620" stroke-width="2" fill="none"/></svg><b>+${s.gain}</b>` : ''
  return `<div class="ftg-done">${mark}<span class="ftg-sha">${foot(m)}</span><span role="img" aria-label="${s.l[itemOf(m)]}">${icon(itemOf(m))}</span></div>`
}

export const branch = (s: Scene) => {
  const end = 30 + 24 * s.world.key
  return `<svg viewBox="0 0 ${end + 24} 44" role="img" aria-label="${f(s.l.branch, s.accused.size, s.world.key)}"><path d="M30,26 H${end}" stroke="#2B2620" stroke-width="2"/>${Array.from({ length: s.world.key }, (_, k) => `<circle cx="${30 + 24 * k}" cy="26" r="6" fill="${k < s.accused.size ? '#2B2620' : '#F6EFDD'}" stroke="#2B2620" stroke-width="2"${k < s.accused.size ? '' : ' stroke-dasharray="2 2"'}/>`).join('')}<rect x="${end - 6}" y="20" width="12" height="12" fill="#E8C26A" stroke="#2B2620" stroke-width="2" transform="rotate(45 ${end} 26)"/></svg>`
}

const U = 10

export const map = (s: Scene) => {
  const all = new Map(rooms(s.world).map((r) => [r.id, r]))
  const seen = (id: string) => s.visited.has(id)
  const ok = (d: Scene['world']['doors'][number]) => d.kind === 'open' || s.found.has(`${d.a}>${d.b}`)
  const links = s.world.doors.filter((d) => ok(d) && (seen(d.a) || seen(d.b)))
  const known = new Set([...s.visited, ...links.flatMap((d) => [d.a, d.b])])
  const cells = [...known].map((id) => all.get(id)!)
  const xs = cells.map((r) => r.cell[0])
  const ys = cells.map((r) => r.cell[1])
  const c = (r: { cell: number[] }) => [r.cell[0]! * U + U / 2, r.cell[1]! * U + U / 2] as const
  const box = [Math.min(...xs) * U - U, Math.min(...ys) * U - U, (Math.max(...xs) - Math.min(...xs) + 2) * U + U, (Math.max(...ys) - Math.min(...ys) + 2) * U + U]
  return `<svg viewBox="${box.join(' ')}" role="img" aria-label="${f(s.l.map, s.visited.size)}">${links.map((d) => { const [x1, y1] = c(all.get(d.a)!); const [x2, y2] = c(all.get(d.b)!); return `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${d.kind === 'hidden' ? '#C9962B' : '#2B2620'}" stroke-width="1.5"/>` }).join('')}${cells.map((r) => {
    const [x, y] = c(r)
    const fill = r.id === s.world.gate ? (s.accused.size >= s.world.key ? '#E8C26A' : '#CDB98F') : seen(r.id) ? (r.relation ? TINT[r.relation] : '#F4EEDD') : 'none'
    return `<rect x="${x - 4}" y="${y - 4}" width="8" height="8" rx="1.5" fill="${fill}" stroke="#2B2620" stroke-width="1"${seen(r.id) || r.id === s.world.gate ? '' : ' stroke-dasharray="2 2"'}/>${s.accused.has(r.id) ? `<circle cx="${x + 4}" cy="${y - 4}" r="2.2" fill="#A8326E"/>` : ''}${r.id === s.room.id ? `<circle cx="${x}" cy="${y}" r="2" fill="#127C80"/>` : ''}`
  }).join('')}</svg>`
}
