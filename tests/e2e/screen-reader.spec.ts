import { expect, test, type Page } from '@playwright/test'
import { Run, expectEnd, open, playButton, right, strings, suites, trunk, wrong } from './helpers.ts'

const l = strings.labels.en
const [t1] = trunk
const live = (page: Page) => page.locator('.ftg-sr')
const parts = (n: number) => l.branch!.replace('{n}', String(n)).replace('{k}', '12')

test('every button and link has an accessible name and the floor is hidden from screen readers', async ({ page }) => {
  await open(page)
  const named = async () => {
    const all = [...(await page.getByRole('button').all()), ...(await page.getByRole('link').all())]
    expect(all.length).toBeGreaterThan(0)
    for (const e of all) await expect(e).toHaveAccessibleName(/\S/)
  }
  await named()
  await playButton(page).click()
  await expect(page.locator('.ftg-floor')).toHaveAttribute('aria-hidden', 'true')
  await new Run(page).go(t1!.id)
  await named()
})

test('a keyboard-only player finishes the level with the arrow keys and the stamp', async ({ page }) => {
  await open(page)
  await playButton(page).click()
  await new Run(page, true).finish()
  await expectEnd(page)
})

test('Enter and Space stamp the monster beside the hero', async ({ page }) => {
  await open(page)
  await playButton(page).click()
  const r = new Run(page, true)
  await r.go(suites[0]!)
  await r.monster(0)
  await page.keyboard.press('Enter')
  await expect(page.locator('.ftg-branch svg')).toHaveAccessibleName(parts(1))
  await r.go(suites[1]!)
  await r.monster(0)
  await page.keyboard.press('Space')
  await expect(page.locator('.ftg-branch svg')).toHaveAccessibleName(parts(2))
})

test('reading a station is announced with its clue for every monster', async ({ page }) => {
  await open(page)
  await playButton(page).click()
  const r = new Run(page)
  await r.go(t1!.id)
  await r.station(0)
  await expect(live(page)).toContainText(l.lamp!)
  await expect(live(page)).toContainText(l.pick!.replace('{n}', '1'))
})

test('an accusation outside the certain rooms announces only the dropped item', async ({ page }) => {
  await open(page)
  await playButton(page).click()
  await new Run(page).accuseIn(suites[0]!)
  await expect(live(page)).toContainText(l.dropped!.split('{item}')[0]!)
  await expect(live(page)).not.toContainText(l.hit!)
  await expect(live(page)).not.toContainText(l.miss!)
})

for (const [name, pick, said] of [['hit', right, l.hit], ['miss', wrong, l.miss]] as const)
  test(`a live region announces a ${name} in a certain room`, async ({ page }) => {
    await open(page)
    await playButton(page).click()
    const r = new Run(page)
    await r.go(t1!.id)
    await r.accuse(pick(t1!))
    await expect(live(page)).toContainText(said!)
  })
