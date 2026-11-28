import { branch, describe, f, ICON, map, memo, panel, result } from './cards.ts'
import { rooms } from './engine.ts'
import { hash, monster } from './gen.ts'
import { art, collection } from './items.ts'
import type { Item } from './items.ts'
import type { Text } from './debrief.ts'
import { BINDINGS, place } from './levels/observations.ts'
import type { Binding, Room, Row, World } from './levels/observations.ts'

export type Slim = Pick<Row, 'id' | 'rule' | 'values' | 'context'>
export type Spot = { x: number; y: number }
export type Gate = Spot & { id: string; to: string; dx: number; dy: number; hidden: boolean; trunk: boolean; gate: boolean }
export type Lay = { w: number; h: number; monsters: Spot[]; items: (Spot & Binding & { m: number; code: number })[]; spots: (Spot & { kind: number })[]; doors: Gate[] }
export type Scene = {
  world: World; room: Room; lay: Lay; monsters: Slim[]; at: Spot; read: number[]; pick: number; aimed: number; hit: boolean; gain: number; score: number
  found: Set<string>; accused: Set<string>; visited: Set<string>; dug: Set<string>; bag: Map<Item, number>; l: Text['l']
}

export const T = 64
export const P = 56
export const ROWS = 10
const px = (v: number) => P + T * v + T / 2
const LEVEL = ['#E2DBC5', '#A8D8A0', '#5CB86A', '#3A9A50', '#23703A']
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v))
const BAND = 7
const mix = (s: string) => { let n = hash(s); n = Math.imul(n ^ (n >>> 16), 0x45d9f3b); n = Math.imul(n ^ (n >>> 16), 0x45d9f3b); return (n ^ (n >>> 16)) >>> 0 }
const DECOR = ['crack', 'sprout', 'dirt', 'stain', 'pebbles']
const TYPES = ['archive', 'vault', 'hall', 'greenhouse', 'cavern', 'workshop']
const CARPET: Record<string, string> = { archive: 'a', hall: 'b' }
export const ART = [...TYPES.flatMap((t) => [`wall-${t}`, `door-${t}`, ...[...'abcd'].map((v) => `floor-${t}-${v}`)]), ...DECOR.flatMap((k) => [...'abcd'].map((v) => `mark-${k}-${v}`)), 'door-library', 'door-hidden', 'carpet-a', 'carpet-b', 'hero']

export const look = (world: World, room: Room) => {
  const vault = world.wings.flatMap((x) => x.suites.filter((u) => u.id === 'vault' && u.rooms.some((r) => r.id === room.id)).map(() => x.grid))
  const type = vault.length ? 'vault' : TYPES[mix(`${room.id}/type`) % TYPES.length]!
  const k = mix(`${room.id}/base`)
  return { grid: vault[0] ?? [], type, base: k % 4, door: type === 'archive' && (k >>> 3) & 1 ? 'library' : type, carpet: CARPET[type], wall: [(k >>> 5) % 160, (k >>> 13) % 160] }
}

export const tile = (room: Room, x: number, y: number) => {
  const k = mix(`${room.id}/${x},${y}`)
  return { accent: k % 10 >= 7 ? k % 4 : -1, ox: (k >>> 4) % 192, oy: (k >>> 12) % 192, fx: (k >>> 20) & 1, fy: (k >>> 21) & 1 }
}

export const decal = (room: Room, x: number, y: number) => {
  const k = mix(`${room.id}#${x},${y}`)
  return { variant: 'abcd'[k % 4]!, size: 40 + ((k >>> 2) % 16), turn: (k >>> 6) % 360 }
}
const joined = (w: number, h: number, objs: Set<string>) => {
  const seen = new Set([`${w >> 1},${h - 1}`])
  const queue = [[w >> 1, h - 1]] as [number, number][]
  for (const [x, y] of queue) {
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
      const k = `${x + dx},${y + dy}`
      if (x + dx >= 0 && y + dy >= 0 && x + dx < w && y + dy < h && !objs.has(k) && !seen.has(k)) {
        seen.add(k)
        queue.push([x + dx, y + dy])
      }
    }
  }
  const open = (x: number, y: number) => [-1, 0, 1].some((dx) => [-1, 0, 1].some((dy) => x + dx >= 0 && y + dy >= 0 && x + dx < w && y + dy < h && !objs.has(`${x + dx},${y + dy}`)))
  return seen.size === w * h - objs.size && [...objs].every((k) => open(...(k.split(',').map(Number) as [number, number])))
}

export const layout = (world: World, room: Room, rows: Map<string, Slim>): Lay => {
  const all = new Map(rooms(world).map((r) => [r.id, r]))
  const trunk = world.wings.find((x) => x.trunk.includes(room.id))?.trunk ?? []
  const w = room.monsters.length ? 4 * BAND + 2 : 9
  const h = room.monsters.length ? 4 : ROWS
  const objs = new Set<string>()
  const cells = Array.from({ length: h * (w - 2) }, (_, i) => ({ x: (i % (w - 2)) + 1, y: Math.floor(i / (w - 2)) }))
  const put = (rank: (c: Spot) => number) => {
    for (const c of [...cells].sort((a, b) => rank(a) - rank(b))) {
      const k = `${c.x},${c.y}`
      if (objs.has(k) || k === `${w >> 1},${h - 1}`) continue
      objs.add(k)
      if (joined(w, h, objs)) return c
      objs.delete(k)
    }
    throw new Error('room full')
  }
  const found = room.monsters.map((id, m) => ({ m, id, p: place(rows.get(id) as Row) })).sort((a, b) => (a.id < b.id ? -1 : 1))
  const monsters: Spot[] = []
  found.forEach(({ m, p }) => {
    monsters[m] = put((c) => { const b = Math.floor((c.x - 1) / BAND); return ((b - p.band + 4) % 4) * 1000 + 10 * Math.abs(c.y - p.y) + Math.abs(c.x - (1 + BAND * b + 3)) })
  })
  const used = new Set<string>()
  const doors = world.doors.flatMap((d): Gate[] => {
    if (d.a !== room.id && d.b !== room.id) return []
    const to = d.a === room.id ? d.b : d.a
    const [ax, ay] = all.get(to)!.cell
    const wide = Math.abs(ax - room.cell[0]) >= Math.abs(ay - room.cell[1])
    const dx = wide ? Math.sign(ax - room.cell[0]) || 1 : 0
    const dy = wide ? 0 : Math.sign(ay - room.cell[1])
    const span = wide ? h : w - 2
    let k = hash(room.id + to) % span
    while (used.has(`${dx}${dy}${k}`) || (dy && objs.has(`${k + 1},${dy > 0 ? h - 1 : 0}`))) k = (k + 1) % span
    used.add(`${dx}${dy}${k}`)
    return [{ id: `${d.a}>${d.b}`, to, dx, dy, x: dx ? (dx > 0 ? w : -1) : k + 1, y: dy ? (dy > 0 ? h : -1) : k, hidden: d.kind === 'hidden', trunk: room.certain && to === trunk[trunk.indexOf(room.id) + 1], gate: to === world.gate }]
  })
  const owned = found.flatMap(({ m, p }) => p.items.map((field) => ({ m, i: BINDINGS.findIndex((b) => b.field === field) })))
  const free = cells.filter((c) => !objs.has(`${c.x},${c.y}`) && ![{ x: w >> 1, y: h - 1 }, ...doors.map((d) => ({ x: clamp(d.x, 0, w - 1), y: clamp(d.y, 0, h - 1) }))].some((e) => e.x === c.x && e.y === c.y)).sort((a, b) => mix(`${room.id}:${a.x},${a.y}`) - mix(`${room.id}:${b.x},${b.y}`))
  const items: Lay['items'] = owned.map(({ m, i }, k) => ({ ...BINDINGS[i]!, ...free[k]!, m, code: m * BINDINGS.length + i }))
  const spots = free.slice(0, 3 * owned.length).sort((a, b) => a.y - b.y || a.x - b.x).map((c) => ({ ...c, kind: mix(`${room.id}|${c.x},${c.y}`) % DECOR.length }))
  return { w, h, doors, monsters, items, spots }
}

export const entry = (l: Lay, from?: string): Spot => {
  const d = l.doors.find((x) => x.to === from)
  return d ? { x: clamp(d.x, 0, l.w - 1), y: clamp(d.y, 0, l.h - 1) } : { x: l.w >> 1, y: l.h - 1 }
}

export const step = (l: Lay, at: Spot, dx: number, dy: number): Spot | Gate => {
  const x = at.x + dx
  const y = at.y + dy
  const d = l.doors.find((g) => g.x === x && g.y === y)
  const blocked = l.monsters.some((o) => o.x === x && o.y === y)
  return d ?? (x < 0 || y < 0 || x >= l.w || y >= l.h || blocked ? at : { x, y })
}

const DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1]] as const

export const path = (l: Lay, from: Spot, goal: (p: Spot) => boolean, door?: Gate) => {
  const seen = new Set([`${from.x},${from.y}`])
  const queue = [{ p: from, m: [] as (readonly [number, number])[] }]
  for (const { p, m } of queue) {
    if (goal(p)) return m
    for (const d of DIRS) {
      const r = step(l, p, d[0], d[1])
      if ('to' in r) {
        if (r === door) return [...m, d]
      } else if (!seen.has(`${r.x},${r.y}`)) {
        seen.add(`${r.x},${r.y}`)
        queue.push({ p: r, m: [...m, d] })
      }
    }
  }
  return null
}

const near = (a: Spot, b: Spot) => Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y)) <= 1

export const reach = (l: Lay, at: Spot) => ({
  monsters: l.monsters.flatMap((m, i) => (near(m, at) ? [i] : [])),
  station: l.items.findIndex((o) => o.x === at.x && o.y === at.y),
  hidden: l.doors.filter((d) => d.hidden && near(d, at)),
})

export const passable = (d: Gate, s: Pick<Scene, 'found' | 'accused' | 'room' | 'world'>) =>
  (!d.hidden || s.found.has(d.id)) && (!d.trunk || s.accused.has(s.room.id)) && (!d.gate || s.accused.size >= s.world.key)

const floor = (s: Scene) => {
  const { lay, room, world, l } = s
  const W = lay.w * T + 2 * P
  const H = lay.h * T + 2 * P
  const fw = lay.w * T
  const fh = lay.h * T
  const pc = (x: number, y: number, w: number, h: number) => [x / W, y / H, w / W, h / H].map((v) => `${100 * v}%`).join(' ')
  const hot = (key: string, label: string, x: number, y: number, w: number, h: number) => `<button class="ftg-hot" data-walk="${key}" data-pc="${pc(x, y, w, h)}" aria-label="${label}"></button>`
  const rect = (fill: string, x = 0, y = 0, w = W, h = H) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${fill}"/>`
  const { grid, type, base, door, carpet, wall } = look(world, room)
  const cells = Array.from({ length: lay.w * lay.h }, (_, i) => {
    const x = i % lay.w
    const y = Math.floor(i / lay.w)
    const t = tile(room, x, y)
    return `<svg x="${P + T * x}" y="${P + T * y}" width="${T}" height="${T}" viewBox="0 0 ${T} ${T}"><use href="#ftg-f${t.accent < 0 ? base : t.accent}" transform="matrix(${t.fx ? -1 : 1} 0 0 ${t.fy ? -1 : 1} ${t.fx ? t.ox + T : -t.ox} ${t.fy ? t.oy + T : -t.oy})"/></svg>`
  })
  const c0 = mix(`${room.id}/carpet`)
  const rug = carpet ? `<pattern id="ftg-rug" width="128" height="128" x="${c0 % 128}" y="${(c0 >>> 7) % 128}" patternUnits="userSpaceOnUse"><image href="${art(`carpet-${carpet}`)}" width="128" height="128"/></pattern><rect x="${P + (c0 % (lay.w - 6)) * T + 6}" y="${P + T + 6}" width="${5 * T - 12}" height="${(lay.h - 2) * T - 12}" fill="url(#ftg-rug)" stroke="#2B2620" stroke-width="2"/>` : ''
  const lines = `<path d="${Array.from({ length: lay.w + 1 }, (_, i) => `M${P + T * i},${P}V${P + fh}`).join('')}${Array.from({ length: lay.h + 1 }, (_, j) => `M${P},${P + T * j}H${P + fw}`).join('')}" stroke="#2B2620" stroke-width="1" opacity="0.16"/>`
  const col0 = P + fw / 2 - Math.ceil(grid.length / 7) * 11
  const doors = lay.doors.map((d, i) => {
    const cx = d.dx ? (d.dx > 0 ? P + fw : P) : px(d.x)
    const cy = d.dy ? (d.dy > 0 ? P + fh : P) : px(d.y)
    return { cx, cy, svg: `<g class="ftg-door" transform="translate(${cx},${cy}) rotate(${d.dx > 0 ? 90 : d.dx < 0 ? -90 : d.dy > 0 ? 180 : 0})"><image class="ftg-arch" href="${art(`door-${door}`)}" x="-26" y="-56" width="52" height="60"/><image class="ftg-crack" href="${art('door-hidden')}" x="-26" y="-56" width="52" height="60"/></g>`, i }
  })
  const stations = lay.items.map((_, i) => `<g class="ftg-st" data-st="${i}"></g>`)
  const spots = lay.spots.map((p, i) => `<g class="ftg-spot" data-spot="${i}" transform="translate(${px(p.x)},${px(p.y)})">${((d) => `<image href="${art(`mark-${DECOR[p.kind]}-${d.variant}`)}" x="${-d.size / 2}" y="${-d.size / 2}" width="${d.size}" height="${d.size}"${p.kind === 1 ? '' : ` transform="rotate(${d.turn})"`}/>`)(decal(room, p.x, p.y))}</g>`)
  const mons = lay.monsters.map((m, i) => {
    const cx = px(m.x)
    const cy = px(m.y)
    return `<g class="ftg-mon" data-mon="${i}"><ellipse class="ftg-ring" cx="${cx}" cy="${cy}" rx="36" ry="34"/><ellipse cx="${cx}" cy="${cy + 6}" rx="34" ry="26" fill="#EFE5CF" stroke="#2B2620" stroke-width="1.3" stroke-dasharray="4 5"/>${monster(s.monsters[i]!).replace('<svg ', `<svg x="${cx - 32}" y="${cy - 34}" width="64" height="57" `)}<use class="ftg-seal" href="#rg-i-seal" x="${cx + 12}" y="${cy + 8}" width="22" height="22"/></g>`
  })
  return `<div class="ftg-slide"><svg class="ftg-floor" viewBox="0 0 ${W} ${H}" aria-hidden="true"><defs>${[...'abcd'].map((v, i) => `<image id="ftg-f${i}" href="${art(`floor-${type}-${v}`)}" width="256" height="256"/>`).join('')}</defs><pattern id="ftg-wall" width="160" height="160" x="${wall[0]}" y="${wall[1]}" patternUnits="userSpaceOnUse"><image href="${art(`wall-${type}`)}" width="160" height="160"/></pattern>${rect('#E3D6B6')}${rect('url(#ftg-wall)')}<rect width="${W}" height="${H}" fill="#2B2620" opacity="0.27"/>${cells.join('')}${rug}${lines}<rect x="${P}" y="${P}" width="${fw}" height="${fh}" fill="none" stroke="#2B2620" stroke-width="2.5"/>${grid.map((v, i) => rect(LEVEL[v]!, col0 + Math.floor(i / 7) * 22, P + fh / 2 - 77 + (i % 7) * 22, 18, 18)).join('')}${doors.map((d) => d.svg).join('')}${spots.join('')}${stations.join('')}${mons.join('')}<image class="ftg-hero" href="${art('hero')}" width="36" height="46"/></svg>${s.monsters.map((m, i) => hot(`m${i}`, f(l.monster, i + 1, describe(m, l)), px(lay.monsters[i]!.x) - 34, px(lay.monsters[i]!.y) - 34, 68, 68)).join('')}${lay.spots.map((p, i) => hot(`h${i}`, l.hint!, px(p.x) - 30, px(p.y) - 30, 60, 60)).join('')}${doors.map((d) => hot(`d${d.i}`, l.door!, d.cx - 24, d.cy - 24, 48, 48)).join('')}</div>`
}

export const paint = (root: HTMLElement, s: Scene) => {
  const q = <E extends Element = HTMLElement>(c: string) => root.querySelector<E>(c)!
  const all = <E extends Element = HTMLElement>(c: string) => root.querySelectorAll<E>(c)
  const { lay } = s
  const room = q('.ftg-room')
  if (root.dataset.room !== s.room.id) {
    root.dataset.room = s.room.id
    room.style.setProperty('--w', String(lay.w * T + 2 * P))
    room.style.setProperty('--h', String(lay.h * T + 2 * P))
    room.innerHTML = floor(s)
    all('.ftg-hot').forEach((e) => { [e.style.left, e.style.top, e.style.width, e.style.height] = e.dataset.pc!.split(' ') as [string, string, string, string] })
  }
  const at = reach(lay, s.at)
  const done = s.pick >= 0
  room.style.setProperty('--cx', ((P + T * (s.at.x + 0.5)) / (lay.w * T + 2 * P)).toFixed(3))
  q<SVGElement>('.ftg-hero').style.transform = `translate(${P + T * s.at.x + 14}px,${P + T * s.at.y + 8}px)`
  all('.ftg-mon').forEach((e, i) => { e.toggleAttribute('data-near', at.monsters.includes(i) && !done); e.toggleAttribute('data-picked', s.pick === i) })
  all('.ftg-st').forEach((e, i) => {
    const st = lay.items[i]!
    const read = s.read.includes(st.code)
    e.toggleAttribute('data-near', i === at.station)
    e.toggleAttribute('data-read', read)
    if (read && !e.firstChild) e.innerHTML = `<ellipse class="ftg-ring" cx="${px(st.x)}" cy="${px(st.y) - 4}" rx="30" ry="30"/><use href="#rg-i-${ICON[st.station]}" x="${px(st.x) - 17}" y="${px(st.y) - 30}" width="34" height="34"/>`
  })
  all('.ftg-spot').forEach((e, i) => {
    const dug = s.dug.has(`${s.room.id}|${lay.spots[i]!.x},${lay.spots[i]!.y}`)
    e.toggleAttribute('data-dug', dug)
    q(`[data-walk="h${i}"]`).ariaLabel = (dug ? s.l.checked : s.l.hint)!
  })
  const mon = at.monsters.includes(s.aimed) ? s.aimed : (at.monsters[0] ?? -1)
  all('.ftg-door').forEach((e, i) => { e.toggleAttribute('data-hidden', lay.doors[i]!.hidden && !s.found.has(lay.doors[i]!.id)); e.toggleAttribute('data-lock', !passable(lay.doors[i]!, s)) })
  memo(q('.ftg-panel'), done ? `r${s.pick}${s.hit}${s.gain}` : `p${s.room.id}${at.station}|${mon}|${s.read.length}`, () => (done ? result(s) : panel(s, at.station, mon)))
  q('.ftg-hits').textContent = String(s.score)
  memo(q('.ftg-branch'), `${s.accused.size}`, () => branch(s))
  all('.ftg-items').forEach((e) => memo(e, `${[...s.bag]}`, () => collection(s.bag, s.l)))
  memo(q('.ftg-map'), `${s.room.id}${s.visited.size}${s.found.size}${s.accused.size}`, () => map(s))
}
