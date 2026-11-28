import { expect, test, type Page } from '@playwright/test'
import { edition } from '../../src/game/eval/version.ts'
import { rows } from '../../src/game/levels/rows.ts'
import { world } from '../../src/game/levels/world.ts'
import { Run, all, open, playButton, strings, trunk, type Lang } from './helpers.ts'

async function mock(page: Page) {
  const results: { v: number; level: number; edition: string; visits: number[][] }[] = []
  const steps: unknown[] = []
  await page.route('**/api/game/result', (r) => {
    results.push(r.request().postDataJSON())
    return r.fulfill({ json: {} })
  })
  await page.route('**/api/game/step', (r) => {
    steps.push(r.request().postDataJSON())
    return r.fulfill({ json: { fallback: true } })
  })
  return { results, steps }
}

const study = (page: Page, lang: Lang = 'en') => page.getByRole('button', { name: strings.labels[lang].contribute })
const again = (page: Page) => page.locator('.ftg-again')
const remember = (page: Page) => page.addInitScript(() => localStorage.setItem('ftg:study', '1'))

test('nothing is sent until the toggle is on, then once per game, and /step is never called', async ({ page }) => {
  const { results, steps } = await mock(page)
  await open(page)
  await playButton(page).click()
  await new Run(page).finish()
  await expect(page.locator('.ftg')).toHaveAttribute('data-phase', 'end')
  await expect(study(page)).toHaveAttribute('aria-pressed', 'false')
  await page.waitForLoadState('networkidle')
  expect(results).toHaveLength(0)

  await study(page).click()
  await expect(study(page)).toHaveAttribute('aria-pressed', 'true')
  await expect.poll(() => results.length).toBe(1)
  expect(results[0]!.visits.length).toBeGreaterThan(0)

  await study(page).click()
  await study(page).click()
  await expect(study(page)).toHaveAttribute('aria-pressed', 'true')
  await page.waitForLoadState('networkidle')
  expect(results).toHaveLength(1)

  await again(page).click()
  await new Run(page).finish()
  await expect.poll(() => results.length).toBe(2)
  expect(steps).toEqual([])
})

for (const lang of ['pl', 'en'] as Lang[])
  test(`the toggle is named in ${lang}`, async ({ page }) => {
    await mock(page)
    await open(page, lang)
    await playButton(page, lang).click()
    await new Run(page).finish()
    await expect(study(page, lang)).toHaveAttribute('aria-pressed', 'false')
    await study(page, lang).click()
    await expect(study(page, lang)).toHaveAttribute('aria-pressed', 'true')
    await study(page, lang).click()
    await expect(study(page, lang)).toHaveAttribute('aria-pressed', 'false')
  })

test('a stored visit carries the route, the stations read in order, the pick, and the first-play flag', async ({ page }) => {
  await remember(page)
  const { results } = await mock(page)
  await open(page)
  await playButton(page).click()
  const r = new Run(page)
  const [t1] = trunk
  await r.go(t1!.id)
  await r.station(1)
  await r.station(0)
  await r.accuse(2)
  await r.finish()
  await expect.poll(() => results.length).toBe(1)
  const body = results[0]!
  expect(body).toMatchObject({ v: 0, level: 1, edition: await edition(world, rows) })
  expect(body.visits.every((v) => v.length === 23)).toBe(true)
  const [room, route, pick, ms, , first, doors, ...rest] = body.visits[0]!
  expect([room, route, pick, first, doors]).toEqual([all.indexOf(t1!), 0, 2, 1, 0])
  const read = r.reads.get(t1!.id)!
  expect(rest.slice(0, read.length)).toEqual(read)
  expect(rest.slice(12).reduce((t, x) => t + x, 0)).toBeLessThanOrEqual(ms!)
  expect(body.visits.map((v) => v[1])).toEqual(body.visits.map((_, i) => i))
  await again(page).click()
  await new Run(page).finish()
  await expect.poll(() => results.length).toBe(2)
  expect(results[1]!.visits[0]![5]).toBe(0)
})

test('aim data: moving between monsters is a switch, and paused time counts neither in dwell nor in the time to accuse', async ({ page }) => {
  await remember(page)
  const { results } = await mock(page)
  await open(page)
  await playButton(page).click()
  const r = new Run(page)
  await r.go(trunk[0]!.id)
  await r.monster(0)
  await page.keyboard.press('p')
  await page.waitForTimeout(1500)
  await page.getByRole('button', { name: strings.labels.en.resume }).click()
  await r.accuse(1)
  await r.finish()
  await expect.poll(() => results.length).toBe(1)
  const [, , pick, ms, switches] = results[0]!.visits[0]!
  const dwell = results[0]!.visits[0]!.slice(19)
  expect(pick).toBe(1)
  expect(switches).toBeGreaterThanOrEqual(1)
  expect(dwell.reduce((t, x) => t + x, 0)).toBeLessThanOrEqual(ms!)
  expect(ms).toBeLessThan(1500)
})

test('the page carries the edition of the world', async ({ page }) => {
  await open(page)
  await expect(page.locator('.ftg')).toHaveAttribute('data-edition', await edition(world, rows))
})

test('a play sent part way when the tab is left is replaced by the complete play under the same receipt, after a failed send', async ({ page }) => {
  await remember(page)
  const bodies: { receipt: number; visits: number[][] }[] = []
  await page.route('**/api/game/step', (r) => r.fulfill({ json: { fallback: true } }))
  await page.route('**/api/game/result', (r) => {
    bodies.push(r.request().postDataJSON())
    return bodies.length === 1 ? r.fulfill({ status: 503 }) : r.fulfill({ status: 204 })
  })
  await open(page)
  await playButton(page).click()
  const r = new Run(page)
  await r.accuseIn(trunk[0]!.id)
  await page.evaluate(() => dispatchEvent(new Event('pagehide')))
  await expect.poll(() => bodies.length).toBe(1)
  await r.finish()
  await expect.poll(() => bodies.length).toBe(2)
  const [part, full] = bodies
  expect(full!.receipt).toBe(part!.receipt)
  expect(full!.visits.slice(0, part!.visits.length).map((v) => v[0])).toEqual(part!.visits.map((v) => v[0]))
  expect(full!.visits.filter((v) => v[2] >= 0).length).toBeGreaterThan(part!.visits.length)
})
