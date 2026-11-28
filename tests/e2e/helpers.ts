import { expect, test, type Locator, type Page } from '@playwright/test'
import { readFileSync } from 'node:fs'
import { hit, report, rooms, rowMap } from '../../src/game/engine.ts'
import type { AiRun, Visit } from '../../src/game/engine.ts'
import { label } from '../../src/game/chart.ts'
import type { Labels } from '../../src/game/chart.ts'
import { hash } from '../../src/game/gen.ts'
import { rows } from '../../src/game/levels/rows.ts'
import { world } from '../../src/game/levels/world.ts'
import type { Room } from '../../src/game/levels/observations.ts'
import { entry, layout, passable, path, reach, step } from '../../src/game/view.ts'
import type { Gate, Spot } from '../../src/game/view.ts'

export type Lang = 'pl' | 'en'
export const phone = () => test.info().project.name === 'phone'
const shown = async (el: Locator) => {
  const [b, r] = [await el.boundingBox(), await el.page().locator('.ftg-room').boundingBox()]
  return !!b && !!r && b.x >= r.x && b.x + b.width <= r.x + r.width
}
export const run = JSON.parse(readFileSync('src/game/eval/ai-run.json', 'utf8')) as AiRun
export const strings = JSON.parse(readFileSync('src/game/strings.json', 'utf8')) as {
  visible: Record<Lang, Record<string, string>>
  labels: Record<Lang, Record<string, string>>
}

export const all = rooms(world)
export const byId = new Map(all.map((r) => [r.id, r]))
export const rowsById = rowMap(rows)
export const trunk = all.filter((r) => r.certain)

export const right = (room: Room) => Math.max(0, room.monsters.findIndex((_, i) => hit(rowsById, room, i)))
export const wrong = (room: Room) => (right(room) ? 0 : 1)

const short = (s: string) => (s.length > 7 ? hash(s).toString(16).padEnd(7, '0').slice(0, 7) : s)
export const named = (room: Room, lang: Lang) => {
  const l = strings.labels[lang]
  return room.monsters.map((id, i) => {
    const m = rowsById.get(id)!
    const c = m.context?.criteria ?? 0
    return l.monster!.replace('{n}', String(i + 1)).replace('{s}', `${m.values.map(short).join(', ')}; ${l.eyes!.replace('{n}', String(c <= 3 ? 1 : c === 4 ? 2 : 3))}`)
  })
}

export const urlPath = (lang: Lang, level = 1) => `${lang === 'en' ? '/en' : ''}/game/${level}/`
export const open = (page: Page, lang: Lang = 'en', level = 1) => page.goto(urlPath(lang, level))
export const playButton = (page: Page, lang: Lang = 'en') => page.getByRole('button', { name: strings.labels[lang].play, exact: true })
export const expectEnd = (page: Page) => expect(page.locator('.ftg')).toHaveAttribute('data-phase', 'end')

export const collected = (page: Page, scope: string) =>
  page.locator(`${scope} .ftg-count`).evaluateAll((counts) => counts.reduce((n, c) => n + Number(c.textContent), 0))

export const chartName = (visits: Visit[], lang: Lang = 'en') =>
  label(report(world, rowsById, visits, run.picks), { ...strings.visible[lang], chart: strings.labels[lang].chart } as Labels)

const KEYS: Record<string, string> = { '1,0': 'ArrowRight', '-1,0': 'ArrowLeft', '0,1': 'ArrowDown', '0,-1': 'ArrowUp' }
const tiles = (lay: ReturnType<typeof layout>, from: Spot, goal: (p: Spot) => boolean, door?: Gate) => {
  const m = path(lay, from, goal, door)
  if (!m) throw new Error('no path')
  return m
}

const route = (from: string, to: string) => {
  const prev = new Map([[from, '']])
  for (const id of prev.keys())
    for (const d of world.doors) {
      const n = d.a === id ? d.b : d.b === id ? d.a : ''
      if (n && !prev.has(n) && (n !== world.gate || n === to)) prev.set(n, id)
    }
  const out = [to]
  while (out[0] !== from) out.unshift(prev.get(out[0]!)!)
  return out.slice(1)
}

export const near = new Map([[world.start, 0]])
for (const id of near.keys())
  for (const d of world.doors) {
    const n = d.a === id ? d.b : d.b === id ? d.a : ''
    if (n && d.kind === 'open' && n !== world.gate && !near.has(n)) near.set(n, near.size)
  }
export const suites = [...near.keys()].filter((id) => byId.get(id)!.monsters.length && !byId.get(id)!.certain).slice(0, world.key - trunk.length)

export class Run {
  page: Page
  keys: boolean
  pick: (room: Room) => number
  room = byId.get(world.start)!
  lay = layout(world, this.room, rowsById)
  at: Spot = entry(this.lay)
  found = new Set<string>()
  accused = new Set<string>()
  reads = new Map<string, number[]>()
  visits: Visit[] = []

  constructor(page: Page, keys = false, pick = right) {
    this.page = page
    this.keys = keys
    this.pick = pick
  }

  private see() {
    const near = reach(this.lay, this.at)
    near.hidden.forEach((d) => this.found.add(d.id))
    if (near.station < 0) return
    const k = this.lay.items[near.station]!.code
    const list = this.reads.get(this.room.id) ?? []
    if (!list.includes(k)) this.reads.set(this.room.id, [...list, k])
  }

  private enter(to: string) {
    const from = this.room.id
    this.room = byId.get(to)!
    this.lay = layout(world, this.room, rowsById)
    this.at = entry(this.lay, from)
    this.see()
  }

  private open(d: Gate) {
    return passable(d, { found: this.found, accused: this.accused, room: this.room, world })
  }

  async move([dx, dy]: readonly [number, number]) {
    await this.page.keyboard.press(KEYS[`${dx},${dy}`]!)
    const r = step(this.lay, this.at, dx, dy)
    if (!('to' in r)) {
      this.at = r
      this.see()
    } else if (this.open(r)) this.enter(r.to)
  }

  async walk(goal: (p: Spot) => boolean, door?: Gate) {
    for (const m of tiles(this.lay, this.at, goal, door)) await this.move(m)
  }

  station = (k: number) => this.walk((p) => reach(this.lay, p).station === k)
  monster = (i: number) => this.walk((p) => reach(this.lay, p).monsters.includes(i))
  beside = (id: string) => this.walk((p) => reach(this.lay, p).hidden.some((d) => d.to === id))

  async door(to: string) {
    const i = this.lay.doors.findIndex((d) => d.to === to)
    const d = this.lay.doors[i]!
    if (this.keys) return this.walk(() => false, d)
    const hot = this.page.locator(`[data-walk="d${i}"]`)
    await (phone() && (await shown(hot)) ? hot.tap() : hot.dispatchEvent('click'))
    const m = tiles(this.lay, this.at, () => false, d)
    for (const [dx, dy] of m.slice(0, -1)) this.at = step(this.lay, this.at, dx, dy) as Spot
    this.see()
    if (this.open(d)) this.enter(to)
  }

  async accuse(i: number) {
    await expect(this.page.locator('.ftg')).toHaveAttribute('data-room', this.room.id)
    await this.monster(i)
    const stamp = this.page.locator(`[data-walk="m${i}"]`)
    if (this.keys) {
      await stamp.focus()
      await this.page.keyboard.press('Enter')
    } else await (phone() ? stamp.tap() : stamp.click())
    await expect(this.page.locator('.ftg-mon').nth(i)).toHaveAttribute('data-picked', '')
    this.accused.add(this.room.id)
    this.visits.push({ room: all.indexOf(this.room), pick: i, ms: 0 })
  }

  async go(id: string) {
    for (const to of route(this.room.id, id)) {
      if (this.lay.doors.find((d) => d.to === to)!.trunk && !this.accused.has(this.room.id)) await this.accuse(this.pick(this.room))
      await this.door(to)
    }
  }

  async accuseIn(id: string) {
    await this.go(id)
    if (!this.accused.has(id)) await this.accuse(this.pick(this.room))
  }

  async finish() {
    for (const id of [...suites, ...trunk.map((r) => r.id)]) await this.accuseIn(id)
    await this.go(world.gate)
  }
}
