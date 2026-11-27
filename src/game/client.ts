import { hit, rowMap, rooms, score, scoreOf } from './engine.ts'
import type { AiRun } from './engine.ts'
import stored from './eval/ai-run.json'
import { decks } from './levels/index.ts'
import type { Row, World } from './levels/observations.ts'
import { askBoard, boardRequest, newReceipt, resultRequest, sendResult, visitRow } from './net.ts'
import type { Board, VisitRecord } from './net.ts'
import { aimTracker } from './aim.ts'
import { bindInput } from './input.ts'
import { load, save } from './stats.ts'
import { showResult } from './debrief.ts'
import { itemOf } from './items.ts'
import type { Item } from './items.ts'
import { esc } from './chart.ts'
import { f } from './cards.ts'
import { entry, layout, paint, passable, reach, step } from './view.ts'
import type { Scene, Spot } from './view.ts'
import type { Text } from './debrief.ts'

type Rec = VisitRecord & { t0: number; aimed: number; hit: boolean; gain: number; aim: ReturnType<typeof aimTracker> }

const root = document.querySelector<HTMLElement>('.ftg')!
const $ = <T extends HTMLElement = HTMLElement>(s: string) => root.querySelector<T>(s)!
const json = <T>(s: string) => JSON.parse($(s).textContent!) as T
const text = JSON.parse(root.dataset.strings!) as Text
const { l } = text
const world = json<World>('.ftg-world')
const rows = rowMap(json<Row[]>('.ftg-rows'))
const all = rooms(world)
const byId = new Map(all.map((r) => [r.id, r]))
const level = Number(root.dataset.level)
const edition = root.dataset.edition!
const api = root.dataset.api
const ai = (stored as AiRun).picks
const hasNext = decks.observations.levels.some((x) => x.id === level + 1)
const DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1]] as const

const pauseEl = $('.ftg-pause')
const live = $('.ftg-sr')
const calmBtn = $('.ftg-calm')
const studyBtn = $('.ftg-study')
const boardEl = $<HTMLFormElement>('.ftg-board')
const motion = matchMedia('(prefers-reduced-motion: reduce)')

let room = byId.get(world.start)!
let lay = layout(world, room, rows)
let at: Spot = entry(lay)
let found = new Set<string>()
let accused = new Set<string>()
let visited = new Set<string>()
let recs = new Map<string, Rec>()
let order: Rec[] = []
let bag = new Map<Item, number>()
let lost = 0
let pausedAt = 0
let toggled = false
let first = false
let receipt = newReceipt()
let kept = ''
let sending = ''

const clock = () => (root.dataset.phase === 'paused' ? pausedAt : performance.now()) - lost
const rec = () => recs.get(room.id)

const scene = (): Scene => {
  const r = rec()
  return {
    world, room, lay, monsters: room.monsters.map((id) => rows.get(id)!), at, read: r?.stations ?? [], pick: r?.pick ?? -1,
    hit: r?.hit ?? false, gain: r?.gain ?? 0, score: score(world, rows, order), found, accused, visited, bag, l,
  }
}

const phase = (p: string) => (root.dataset.phase = p)

const setCalm = (b: boolean) => {
  calmBtn.setAttribute('aria-pressed', String(b))
  if (b) root.dataset.calm = ''
  else delete root.dataset.calm
}

const setPause = (p: boolean) => {
  if (root.dataset.phase !== (p ? 'play' : 'paused')) return
  if (p) pausedAt = performance.now()
  else lost += performance.now() - pausedAt
  phase(p ? 'paused' : 'play')
  pauseEl.hidden = !p
  if (!p) root.focus({ preventScroll: true })
}

const fin = (r: Rec) => {
  r.aim.lock(-1, clock(), false)
  Object.assign(r, r.aim.read(all[r.room]!.monsters.map((_, i) => i)))
}

const arrive = () => {
  const r = rec()
  const near = reach(lay, at)
  near.hidden.forEach((d) => found.add(d.id))
  let heard = false
  const k = near.station >= 0 ? lay.items[near.station]!.code : -1
  if (r && k >= 0 && !r.stations.includes(k)) {
    r.stations.push(k)
    heard = true
  }
  if (r && r.pick < 0) {
    const i = near.monsters.includes(r.aimed) ? r.aimed : (near.monsters[0] ?? -1)
    if (i !== r.aimed) {
      r.aimed = i
      r.aim.lock(i, clock(), true)
    }
  }
  paint(root, scene())
  if (!root.contains(document.activeElement)) root.focus({ preventScroll: true })
  if (heard) live.textContent = root.querySelector('.ftg-sheet')?.getAttribute('aria-label') ?? live.textContent
}

const go = (to: string) => {
  const from = room.id
  room = byId.get(to)!
  if (to === world.gate) return end()
  lay = layout(world, room, rows)
  at = entry(lay, from)
  visited.add(to)
  if (room.monsters.length && !recs.has(to)) {
    const r: Rec = { room: all.indexOf(room), route: order.length, pick: -1, ms: 0, switches: 0, first, doors: found.size, stations: [], dwell: [], t0: clock(), aimed: -1, hit: false, gain: 0, aim: aimTracker() }
    recs.set(to, r)
    order.push(r)
  }
  arrive()
}

const move = (dx: number, dy: number) => {
  const r = step(lay, at, dx, dy)
  if (!('to' in r)) {
    at = r
    return arrive()
  }
  if (passable(r, { found, accused, room, world })) go(r.to)
}

const walk = (kind: string, i: number) => {
  if (kind === 'm' && reach(lay, at).monsters.includes(i)) return stamp(i)
  const door = kind === 'd' ? lay.doors[i] : undefined
  const goal = (p: Spot) => (kind === 'm' ? reach(lay, p).monsters.includes(i) : kind === 's' && reach(lay, p).station === i)
  const seen = new Set([`${at.x},${at.y}`])
  const queue = [{ p: at, m: [] as (readonly number[])[] }]
  for (const { p, m } of queue) {
    if (goal(p)) return m.forEach(([dx, dy]) => move(dx!, dy!))
    for (const d of DIRS) {
      const r = step(lay, p, d[0], d[1])
      if ('to' in r) {
        if (r === door) return [...m, d].forEach(([dx, dy]) => move(dx!, dy!))
      } else if (!seen.has(`${r.x},${r.y}`)) {
        seen.add(`${r.x},${r.y}`)
        queue.push({ p: r, m: [...m, d] })
      }
    }
  }
}

const stamp = (i: number) => {
  const r = rec()
  if (!r || r.pick >= 0) return
  const close = reach(lay, at).monsters
  const k = i < 0 ? (close.includes(r.aimed) ? r.aimed : (close[0] ?? -1)) : i
  if (!close.includes(k)) return
  r.pick = k
  r.ms = clock() - r.t0
  fin(r)
  accused.add(room.id)
  r.hit = hit(rows, room, k)
  r.gain = room.certain ? scoreOf(r.hit, r.ms) : 0
  const item = itemOf(rows.get(room.monsters[k]!)!)
  bag.set(item, (bag.get(item) ?? 0) + 1)
  paint(root, scene())
  root.focus({ preventScroll: true })
  live.textContent = [room.certain ? (r.hit ? l.hit : l.miss) : '', f(l.dropped, l[item])].filter(Boolean).join('. ')
}

const start = () => {
  found = new Set()
  accused = new Set()
  visited = new Set([world.start])
  recs = new Map()
  order = []
  bag = new Map()
  receipt = newReceipt()
  kept = sending = ''
  lost = 0
  first = !load('observations', level, undefined, edition)?.plays
  room = byId.get(world.start)!
  lay = layout(world, room, rows)
  at = entry(lay)
  delete root.dataset.room
  $('.ftg-end').hidden = true
  $('.ftg-start').hidden = true
  phase('play')
  root.focus({ preventScroll: true })
  arrive()
}

const study = () => { try { return localStorage.getItem('ftg:study') === '1' } catch { return false } }
const rowsOut = () => order.map(visitRow)
const contribute = () => {
  const visits = rowsOut()
  const key = JSON.stringify(visits)
  if (!api || !visits.length || !study() || key === kept || key === sending) return
  sending = key
  const mine = receipt
  sendResult(api, resultRequest(visits, edition, mine)).then((ok) => {
    if (mine !== receipt) return
    if (ok) kept = key
    if (sending === key) sending = ''
  })
}

const showBoard = (b: Board, name: string) => {
  const mine = b.top.findIndex(([who, s]) => who === name && s === b.score)
  const row = ([who, s]: [string, number], me: boolean, k?: number) => `<li${k ? ` value="${k}"` : ''}${me ? ' class="ftg-mine"' : ''}><span>${esc(who)}</span> <output>${s}</output></li>`
  $('.ftg-top').innerHTML = b.top.map((x, i) => row(x, i === mine)).join('') + (mine < 0 ? row([name, b.score], true, b.n - b.below) : '')
  const better = l.better!.replace('{p}', String(Math.round((100 * b.below) / b.n)))
  $('.ftg-norm').ariaLabel += `. ${better}`
  live.textContent = better
  $('.ftg-top').focus()
}

const end = () => {
  order.filter((r) => r.pick < 0).forEach((r) => {
    r.ms = clock() - r.t0
    fin(r)
  })
  phase('end')
  $('.ftg-end').hidden = false
  save('observations', level, score(world, rows, order), { mode: 'world', picks: order.map((r) => r.pick), edition })
  showResult(root, world, rows, order, ai, text, hasNext)
  boardEl.hidden = !api
  boardEl.querySelectorAll('input, button').forEach((e) => ((e as HTMLInputElement).disabled = false))
  $('.ftg-top').replaceChildren()
  contribute()
  $('.ftg-end').focus()
}

setCalm(motion.matches)
motion.onchange = (e) => !toggled && setCalm(e.matches)
phase('start')
root.tabIndex = -1
bindInput(root, { pause: () => setPause(root.dataset.phase === 'play'), move, walk, stamp })
$('.ftg-play').onclick = start
$('.ftg-again').onclick = start
calmBtn.onclick = () => (toggled = true) && setCalm(calmBtn.getAttribute('aria-pressed') !== 'true')
studyBtn.hidden = !api
studyBtn.setAttribute('aria-pressed', String(study()))
studyBtn.onclick = () => {
  const on = !study()
  try { localStorage.setItem('ftg:study', on ? '1' : '0') } catch {}
  studyBtn.setAttribute('aria-pressed', String(on))
  contribute()
}
boardEl.onsubmit = async (e) => {
  e.preventDefault()
  const name = (boardEl.elements.namedItem('nick') as HTMLInputElement).value.trim()
  if (!api || !name) return
  boardEl.querySelectorAll('input, button').forEach((x) => ((x as HTMLInputElement).disabled = true))
  const game = order
  const visits = rowsOut()
  const b = await askBoard(api, boardRequest(visits, edition, name, receipt))
  if (order !== game) return
  if (b) kept = JSON.stringify(visits)
  if (!b) {
    boardEl.querySelectorAll('input, button').forEach((x) => ((x as HTMLInputElement).disabled = false))
    live.textContent = ''
    setTimeout(() => (live.textContent = l.notSaved!), 50)
    return (boardEl.elements.namedItem('nick') as HTMLInputElement).focus()
  }
  showResult(root, world, rows, order, ai, text, hasNext)
  showBoard(b, name)
}
document.addEventListener('visibilitychange', () => {
  if (!document.hidden) return
  setPause(true)
  contribute()
})
addEventListener('pagehide', contribute)
