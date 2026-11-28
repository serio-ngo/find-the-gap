import { expect, test, type Page } from '@playwright/test'
import { world } from '../../src/game/levels/world.ts'
import { step, type Spot } from '../../src/game/view.ts'
import { Run, named, open, playButton, strings, trunk } from './helpers.ts'

const l = strings.labels.en
const [t1] = trunk
const hero = (page: Page) => page.locator('.ftg-hero').getAttribute('style')

for (const lang of ['en', 'pl'] as const)
  test(`in ${lang} the first room is a quiet hall and the first encounter names every monster by its evidence`, async ({ page }) => {
    await open(page, lang)
    await playButton(page, lang).click()
    await expect(page.locator('.ftg')).toHaveAttribute('data-room', world.start)
    await expect(page.locator('.ftg-card')).toHaveCount(0)
    await expect(page.locator('.ftg-hits')).toHaveText('0')
    await expect(page.locator('.ftg-branch svg')).toHaveAccessibleName(strings.labels[lang].branch!.replace('{n}', '0').replace('{k}', String(world.key)))
    await expect(page.locator('.ftg-map svg')).toBeVisible()
    await new Run(page).go(t1!.id)
    await expect(page.locator('.ftg-mon')).toHaveCount(t1!.monsters.length)
    await expect(page.locator('.ftg-card')).toHaveCount(0)
    await expect.poll(() => page.locator('[data-walk^="m"]').evaluateAll((bs) => bs.map((b) => b.ariaLabel))).toEqual(named(t1!, lang))
    expect(await page.locator('.ftg-mon path').evaluateAll((ps) => ps.filter((p) => p.getAttribute('d')?.includes('Q')).length)).toBe(0)
    await expect(page.locator('.ftg-slide')).toHaveText('')
  })

test('the hot spots and the D-pad walk the hero', async ({ page }) => {
  await open(page)
  await playButton(page).click()
  const r = new Run(page)
  await r.go(t1!.id)
  const root = page.locator('.ftg')
  await page.locator('[data-walk="m0"]').dispatchEvent('click')
  await expect(page.locator('.ftg-mon').first()).toHaveAttribute('data-near', '')
  for (const [k, it] of r.lay.items.entries()) {
    await page.locator(`[data-walk="h${r.lay.spots.findIndex((p) => p.x === it.x && p.y === it.y)}"]`).dispatchEvent('click')
    await expect(page.locator('.ftg-st').nth(k)).toHaveAttribute('data-near', '')
  }
  const before = await hero(page)
  let pos: Spot = r.lay.items.at(-1)!
  for (const [dir, dx, dy] of [[l.down, 0, 1], [l.up, 0, -1], [l.left, -1, 0], [l.right, 1, 0]] as const) {
    const at = await hero(page)
    const to = step(r.lay, pos, dx, dy)
    await page.getByRole('button', { name: dir, exact: true }).click()
    if (!('to' in to) && (to.x !== pos.x || to.y !== pos.y)) await expect.poll(() => hero(page)).not.toBe(at)
    if (!('to' in to)) pos = to
  }
  expect(before).not.toBeNull()
  await expect(root).toHaveAttribute('data-phase', 'play')
})

for (const [name, press] of [
  ['the button', async (p: Page) => p.getByRole('button', { name: l.pause }).click()],
  ['the P key', async (p: Page) => p.keyboard.press('p')],
  ['the Escape key', async (p: Page) => p.keyboard.press('Escape')],
] as const) {
  test(`pause by ${name} freezes the hero and resume lets it walk`, async ({ page }) => {
    await open(page)
    await playButton(page).click()
    const root = page.locator('.ftg')
    const live = page.locator('.ftg-sr')
    const before = await hero(page)
    await press(page)
    await expect(root).toHaveAttribute('data-phase', 'paused')
    await page.keyboard.press('ArrowUp')
    await page.keyboard.press('ArrowLeft')
    await page.locator('.ftg-pad').first().click()
    expect(await hero(page)).toBe(before)
    await expect(live).toHaveText('')
    await page.getByRole('button', { name: l.resume }).click()
    await expect(root).toHaveAttribute('data-phase', 'play')
    await page.keyboard.press('ArrowUp')
    await expect.poll(() => hero(page)).not.toBe(before)
  })
}
