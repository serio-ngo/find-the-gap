import { expect, test, type Page } from '@playwright/test'
import { ICON } from '../../src/game/cards.ts'
import { hit } from '../../src/game/engine.ts'
import { BINDINGS, clueOf } from '../../src/game/levels/observations.ts'
import { world } from '../../src/game/levels/world.ts'
import { Run, byId, chartName, collected, expectEnd, near, open, phone, playButton, right, rowsById, run, strings, suites, trunk, wrong } from './helpers.ts'

const l = strings.labels.en
const [t1] = trunk
const branch = (n: number) => l.branch!.replace('{n}', String(n)).replace('{k}', String(world.key))

const begin = async (page: Page, keys = false) => {
  await open(page)
  await playButton(page).click()
  return new Run(page, keys)
}

const expected = (field: string, id: string) => {
  const b = BINDINGS.find((x) => x.field === field)!
  const v = clueOf(b.field, rowsById.get(id)!.context!)
  const on = b.field === 'job' ? v === 'success' : Number(v) > 0
  return { icon: b.field === 'job' && !on ? 'smoke' : ICON[b.station], on: on || b.field === 'share' }
}

test('walking to an item shows its clue icon for its own monster only', async ({ page }) => {
  const r = await begin(page)
  await r.go(t1!.id)
  for (const [k, it] of r.lay.items.entries()) {
    await r.station(k)
    const cols = page.locator('.ftg-sheet .ftg-col')
    await expect(cols).toHaveCount(1)
    const want = expected(it.field, t1!.monsters[it.m]!)
    await expect(cols.locator('.ftg-clue use')).toHaveAttribute('href', `#rg-i-${want.icon}`)
    await expect(cols.locator('.ftg-clue')).toHaveAttribute('opacity', want.on ? '1' : '0.2')
    await expect(page.locator('.ftg-st').nth(k)).toHaveAttribute('data-read', '')
  }
})

test('stamping a monster beside you adds one key part, once per room', async ({ page }) => {
  const r = await begin(page)
  await r.go(t1!.id)
  await expect(page.locator('.ftg-branch svg')).toHaveAccessibleName(branch(0))
  await r.monster(0)
  if (phone()) await page.locator('[data-walk="m0"]').tap()
  else {
    await page.locator('.ftg').focus()
    await page.keyboard.press(' ')
  }
  await expect(page.locator('.ftg-branch svg')).toHaveAccessibleName(branch(1))
  await expect(page.locator('.ftg-mon[data-picked]')).toHaveCount(1)
  await page.keyboard.press('Enter')
  await expect(page.locator('.ftg-mon[data-picked]')).toHaveCount(1)
  expect(await collected(page, '.ftg-hud')).toBe(1)
  const k = await page.locator('.ftg-mon').evaluateAll((ms) => ms.findIndex((m) => m.hasAttribute('data-picked')))
  await expect(page.locator('.ftg-sr')).toContainText(right(t1!) === k ? l.hit! : l.miss!)
})

test('a trunk door stays shut until the room has an accusation', async ({ page }) => {
  const r = await begin(page)
  await r.go(t1!.id)
  const next = r.lay.doors.find((d) => d.trunk)!
  await r.door(next.to)
  await expect(page.locator('.ftg')).toHaveAttribute('data-room', t1!.id)
  await r.accuse(0)
  await r.door(next.to)
  await expect(page.locator('.ftg')).toHaveAttribute('data-room', next.to)
})

test('a hidden door opens when you walk next to it', async ({ page }) => {
  const hidden = world.doors.find((d) => d.kind === 'hidden')!
  const r = await begin(page)
  await r.go(hidden.a)
  const i = r.lay.doors.findIndex((d) => d.to === hidden.b)
  if (!r.found.has(r.lay.doors[i]!.id)) await expect(page.locator('.ftg-door').nth(i)).toHaveAttribute('data-hidden', '')
  await r.beside(hidden.b)
  await expect(page.locator('.ftg-door').nth(i)).not.toHaveAttribute('data-hidden', '')
  await r.door(hidden.b)
  await expect(page.locator('.ftg')).toHaveAttribute('data-room', hidden.b)
})

test('the gate opens at 12 key parts and ends the run', async ({ page }) => {
  const r = await begin(page)
  const last = suites.at(-1)!
  for (const id of [...suites.slice(0, -1), ...trunk.map((x) => x.id)]) await r.accuseIn(id)
  const root = page.locator('.ftg')
  expect(r.accused.size).toBe(world.key - 1)
  await expect(page.locator('.ftg-branch svg')).toHaveAccessibleName(branch(world.key - 1))
  await r.door(world.gate)
  await expect(root).toHaveAttribute('data-phase', 'play')
  await expect(root).toHaveAttribute('data-room', trunk.at(-1)!.id)
  await r.accuseIn(last)
  await expect(page.locator('.ftg-branch svg')).toHaveAccessibleName(branch(world.key))
  await r.go(world.gate)
  await expectEnd(page)
})

test('the end screen shows hits, chance and the stored AI for the four certain rooms', async ({ page }) => {
  const r = await begin(page)
  r.pick = (room) => (trunk.indexOf(room) % 2 ? wrong(room) : right(room))
  await r.finish()
  await expectEnd(page)
  const won = trunk.filter((x) => hit(rowsById, x, r.pick(x))).length
  const ai = trunk.filter((x) => typeof run.picks[x.id] === 'number' && hit(rowsById, x, run.picks[x.id]!)).length
  await expect(page.locator('.ftg-loot li')).toHaveCount(trunk.length)
  await expect(page.locator('.ftg-loot .ftg-me.ftg-won')).toHaveCount(won)
  await expect(page.locator('.ftg-loot .ftg-ai.ftg-won')).toHaveCount(ai)
  await expect(page.locator('.ftg-loot .ftg-ai[role=img]')).toHaveCount(trunk.filter((x) => typeof run.picks[x.id] === 'number').length)
  await expect(page.locator('.ftg-chart [role=img]')).toHaveAccessibleName(chartName(r.visits))
  await expect(page.locator('.ftg-norm')).toHaveText(/^[+-]\d+\.\dσ$/)
  await expect(page.locator('.ftg-hits')).not.toBeVisible()
  expect(await collected(page, '.ftg-end')).toBe(world.key)
  await expect(page.locator('.ftg-end')).toBeFocused()
})

test('the game region contains no words', async ({ page }) => {
  const words = () =>
    page.locator('.ftg').evaluate((root) => {
      const out: string[] = []
      const walk = (n: Node) => {
        if (n.nodeType === 3) {
          const el = n.parentElement!
          const t = n.textContent!.trim()
          if (t && !el.closest('.ftg-sr, .ftg-end') && el.checkVisibility()) out.push(el.closest('.ftg-foot, .ftg-sha') ? (/^([0-9a-f]+( [=≠] [0-9a-f]+)?|•+)$/.test(t) ? '' : t) : t)
        }
        n.childNodes.forEach(walk)
      }
      walk(root)
      return out.filter((t) => /\p{L}{2,}/u.test(t))
    })
  const r = await begin(page)
  expect(await words()).toEqual([])
  await r.go(t1!.id)
  await r.station(0)
  expect(await words()).toEqual([])
  await r.accuse(0)
  await expect(page.locator('.ftg-sha')).toBeVisible()
  expect(await words()).toEqual([])
  for (const relation of ['pair', 'missing_link', 'lock_only']) {
    await r.accuseIn([...near.keys()].find((id) => byId.get(id)!.relation === relation && !byId.get(id)!.certain)!)
    await expect(page.locator('.ftg-sha')).toBeVisible()
    expect(await words()).toEqual([])
  }
  await page.keyboard.press('p')
  expect(await words()).toEqual([])
})
