import { branch, cards, dyn, describe, f, ICON, map, memo, panel, result } from './cards.ts'
import { rooms } from './engine.ts'
import { hash, monster } from './gen.ts'
import { collection } from './items.ts'
import type { Item } from './items.ts'
import type { Text } from './debrief.ts'
import { BINDINGS } from './levels/observations.ts'
import type { Binding, Room, Row, World } from './levels/observations.ts'

export type Slim = Pick<Row, 'id' | 'rule' | 'values' | 'context'>
export type Spot = { x: number; y: number }
export type Gate = Spot & { id: string; to: string; dx: number; dy: number; hidden: boolean; trunk: boolean; gate: boolean }
export type Lay = { w: number; monsters: Spot[]; stations: (Spot & Binding)[]; doors: Gate[] }
export type Scene = {
  world: World; room: Room; lay: Lay; monsters: Slim[]; at: Spot; read: string[]; pick: number; hit: boolean; gain: number; score: number
  found: Set<string>; accused: Set<string>; visited: Set<string>; bag: Map<Item, number>; l: Text['l']
}

export const T = 40
export const P = 56
export const ROWS = 10
const px = (v: number) => P + T * v + T / 2
const LEVEL = ['#E2DBC5', '#A8D8A0', '#5CB86A', '#3A9A50', '#23703A']
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v))
const lane = (id: string, i: number, n: number, w: number) => clamp(Math.floor(((i + 0.5) * w) / n) + (hash(id) % 3) - 1, 1, w - 2)

export const layout = (world: World, room: Room): Lay => {
  const all = new Map(rooms(world).map((r) => [r.id, r]))
  const trunk = world.wings.find((x) => x.trunk.includes(room.id))?.trunk ?? []
  const w = room.monsters.length ? 29 : 9
  const used = new Set<string>()
  const doors = world.doors.flatMap((d): Gate[] => {
    if (d.a !== room.id && d.b !== room.id) return []
    const to = d.a === room.id ? d.b : d.a
    const [ax, ay] = all.get(to)!.cell
    const wide = Math.abs(ax - room.cell[0]) >= Math.abs(ay - room.cell[1])
    const dx = wide ? Math.sign(ax - room.cell[0]) || 1 : 0
    const dy = wide ? 0 : Math.sign(ay - room.cell[1])
    const span = (wide ? ROWS : w) - 2
    let k = hash(room.id + to) % span
    while (used.has(`${dx}${dy}${k}`)) k = (k + 1) % span
    used.add(`${dx}${dy}${k}`)
    return [{ id: `${d.a}>${d.b}`, to, dx, dy, x: dx ? (dx > 0 ? w : -1) : k + 1, y: dy ? (dy > 0 ? ROWS : -1) : k + 1, hidden: d.kind === 'hidden', trunk: room.certain && to === trunk[trunk.indexOf(room.id) + 1], gate: to === world.gate }]
  })
  const n = room.monsters.length
  return {
    w,
    doors,
    monsters: room.monsters.map((_, i) => ({ x: lane(`${room.id}${i}`, i, n, w), y: 1 + (hash(`${room.id}y${i}`) % 3) })),
    stations: room.clues.map((c, i) => ({ ...BINDINGS.find((b) => b.field === c)!, x: lane(room.id + c, i, room.clues.length, w), y: 6 + (hash(`${room.id}${c}y`) % 3) })),
  }
}

export const entry = (l: Lay, from?: string): Spot => {
  const d = l.doors.find((x) => x.to === from)
  return d ? { x: clamp(d.x, 0, l.w - 1), y: clamp(d.y, 0, ROWS - 1) } : { x: l.w >> 1, y: ROWS - 1 }
}

export const step = (l: Lay, at: Spot, dx: number, dy: number): Spot | Gate => {
  const x = at.x + dx
  const y = at.y + dy
  const d = l.doors.find((g) => g.x === x && g.y === y)
  const blocked = [...l.monsters, ...l.stations].some((o) => o.x === x && o.y === y)
  return d ?? (x < 0 || y < 0 || x >= l.w || y >= ROWS || blocked ? at : { x, y })
}

const near = (a: Spot, b: Spot) => Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y)) <= 1

export const reach = (l: Lay, at: Spot) => ({
  monsters: l.monsters.flatMap((m, i) => (near(m, at) ? [i] : [])),
  station: l.stations.findIndex((o) => near(o, at)),
  hidden: l.doors.filter((d) => d.hidden && near(d, at)),
})

export const passable = (d: Gate, s: Pick<Scene, 'found' | 'accused' | 'room' | 'world'>) =>
  (!d.hidden || s.found.has(d.id)) && (!d.trunk || s.accused.has(s.room.id)) && (!d.gate || s.accused.size >= s.world.key)

const floor = (s: Scene) => {
  const { lay, room, world, l } = s
  const W = lay.w * T + 2 * P
  const H = ROWS * T + 2 * P
  const fw = lay.w * T
  const fh = ROWS * T
  const pc = (x: number, y: number, w: number, h: number) => `left:${(100 * x) / W}%;top:${(100 * y) / H}%;width:${(100 * w) / W}%;height:${(100 * h) / H}%`
  const hot = (key: string, label: string, x: number, y: number, w: number, h: number) => `<button class="ftg-hot" data-walk="${key}" style="${pc(x, y, w, h)}" aria-label="${label}"></button>`
  const rect = (fill: string, x = 0, y = 0, w = W, h = H) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${fill}"/>`
  const grid = world.wings.flatMap((x) => x.suites.filter((u) => u.id === 'vault' && u.rooms.some((r) => r.id === room.id)).map(() => x.grid))[0] ?? []
  const col0 = P + fw / 2 - Math.ceil(grid.length / 7) * 11
  const doors = lay.doors.map((d, i) => {
    const cx = d.dx ? (d.dx > 0 ? P + fw : P) : px(d.x)
    const cy = d.dy ? (d.dy > 0 ? P + fh : P) : px(d.y)
    return { cx, cy, svg: `<g class="ftg-door" transform="translate(${cx},${cy}) rotate(${d.dx > 0 ? 90 : d.dx < 0 ? -90 : d.dy > 0 ? 180 : 0})"><use class="ftg-arch" href="#rg-door"/><use class="ftg-crack" href="#rg-i-crack" x="-14" y="-30" width="28" height="28"/></g>`, i }
  })
  const stations = lay.stations.map((st, i) => {
    const cx = px(st.x)
    const cy = px(st.y)
    return { cx, cy, svg: `<g class="ftg-st" data-st="${i}"><ellipse class="ftg-ring" cx="${cx}" cy="${cy - 10}" rx="34" ry="40"/><ellipse cx="${cx}" cy="${cy + 16}" rx="24" ry="6" fill="#2B2620" opacity=".2"/><use href="#rg-i-plinth" x="${cx - 24}" y="${cy - 8}" width="48" height="30"/><use href="#rg-i-${ICON[st.station]}" x="${cx - 17}" y="${cy - 40}" width="34" height="34"/><use class="ftg-eye" href="#rg-i-eye" x="${cx + 18}" y="${cy - 2}" width="20" height="20"/></g>`, label: f(l.station, l[st.station]) }
  })
  const mons = lay.monsters.map((m, i) => {
    const cx = px(m.x)
    const cy = px(m.y)
    return `<g class="ftg-mon" data-mon="${i}"><ellipse class="ftg-ring" cx="${cx}" cy="${cy}" rx="62" ry="58"/><ellipse cx="${cx}" cy="${cy + 8}" rx="64" ry="48" fill="#EFE5CF" stroke="#2B2620" stroke-width="1.3" stroke-dasharray="4 5"/>${monster(s.monsters[i]!).replace('<svg ', `<svg x="${cx - 57}" y="${cy - 60}" width="115" height="102" `)}<use class="ftg-seal" href="#rg-i-seal" x="${cx + 38}" y="${cy + 14}" width="30" height="30"/></g>`
  })
  return `<div class="ftg-slide"><svg class="ftg-floor" viewBox="0 0 ${W} ${H}" aria-hidden="true">${rect('#E3D6B6')}${rect('url(#rg-wallhatch)')}${rect('url(#rg-brick)')}${rect('#F4EEDD', P, P, fw, fh)}${rect('url(#rg-minor)', P, P, fw, fh)}${rect('url(#rg-major)', P, P, fw, fh)}<rect x="${P}" y="${P}" width="${fw}" height="${fh}" fill="none" stroke="#2B2620" stroke-width="2.5"/>${grid.map((v, i) => rect(LEVEL[v]!, col0 + Math.floor(i / 7) * 22, P + fh / 2 - 77 + (i % 7) * 22, 18, 18)).join('')}${doors.map((d) => d.svg).join('')}${stations.map((x) => x.svg).join('')}${mons.join('')}<use class="ftg-hero" href="#rg-hero" width="36" height="46"/></svg>${s.monsters.map((m, i) => hot(`m${i}`, f(l.monster, i + 1, describe(m, l)), px(lay.monsters[i]!.x) - 44, px(lay.monsters[i]!.y) - 62, 88, 104)).join('')}${stations.map((x, i) => hot(`s${i}`, x.label, x.cx - 28, x.cy - 46, 56, 72)).join('')}${doors.map((d) => hot(`d${d.i}`, l.door!, d.cx - 24, d.cy - 24, 48, 48)).join('')}</div>`
}

export const paint = (root: HTMLElement, s: Scene) => {
  const q = <E extends Element = HTMLElement>(c: string) => root.querySelector<E>(c)!
  const all = <E extends Element = HTMLElement>(c: string) => root.querySelectorAll<E>(c)
  const { lay } = s
  const room = q('.ftg-room')
  if (root.dataset.room !== s.room.id) {
    root.dataset.room = s.room.id
    room.style.setProperty('--w', String(lay.w * T + 2 * P))
    room.style.setProperty('--h', String(ROWS * T + 2 * P))
    room.innerHTML = floor(s)
    q('.ftg-deck').innerHTML = cards(s)
  }
  const at = reach(lay, s.at)
  const done = s.pick >= 0
  room.style.setProperty('--cx', ((P + T * (s.at.x + 0.5)) / (lay.w * T + 2 * P)).toFixed(3))
  q<SVGElement>('.ftg-hero').style.transform = `translate(${P + T * s.at.x + 2}px,${P + T * s.at.y - 14}px)`
  all('.ftg-mon').forEach((e, i) => { e.toggleAttribute('data-near', at.monsters.includes(i) && !done); e.toggleAttribute('data-picked', s.pick === i) })
  all('.ftg-st').forEach((e, i) => { e.toggleAttribute('data-near', i === at.station); e.toggleAttribute('data-read', s.read.includes(lay.stations[i]!.field)) })
  all('.ftg-door').forEach((e, i) => { e.toggleAttribute('data-hidden', lay.doors[i]!.hidden && !s.found.has(lay.doors[i]!.id)); e.toggleAttribute('data-lock', !passable(lay.doors[i]!, s)) })
  all('.ftg-card').forEach((c, i) => {
    const on = at.monsters.includes(i) && !done
    c.toggleAttribute('data-near', on)
    c.toggleAttribute('data-picked', s.pick === i)
    c.querySelector('button')!.disabled = !on
    memo(c.querySelector('.ftg-dyn')!, `${s.read}|${s.pick}`, () => dyn(s, i))
  })
  memo(q('.ftg-panel'), done ? `r${s.pick}${s.hit}${s.gain}` : `p${at.station}`, () => (done ? result(s) : panel(s, at.station)))
  q('.ftg-hits').textContent = String(s.score)
  memo(q('.ftg-branch'), `${s.accused.size}`, () => branch(s))
  all('.ftg-items').forEach((e) => memo(e, `${[...s.bag]}`, () => collection(s.bag, s.l)))
  memo(q('.ftg-map'), `${s.room.id}${s.visited.size}${s.found.size}${s.accused.size}`, () => map(s))
}
