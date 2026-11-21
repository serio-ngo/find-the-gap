import { expect, test, type Page } from '@playwright/test'
import { begin, shoot } from '../../src/game/engine.ts'
import { deck, displayed, expectEnd, open, play, playButton, rockNames, strings } from './helpers.ts'

const l = strings.labels.en

for (const lang of ['en', 'pl'] as const)
  test(`in ${lang} every rock carries its evidence from the first frame, with nothing to reveal and one pick per wave`, async ({ page }) => {
    await open(page, lang)
    await playButton(page, lang).click()
    const g = begin(deck, 1, 'standard')
    const twins = page.locator('[data-rock]')
    await expect.poll(() => twins.evaluateAll((bs) => bs.map((b) => b.ariaLabel))).toEqual(rockNames(deck, g, lang))
    await expect(page.locator('.ftg-hud button')).toHaveCount(3)
    await expect(page.locator('.ftg-wave')).toHaveText('1/21')
    await twins.nth(0).dispatchEvent('click')
    await twins.nth(1).dispatchEvent('click')
    await expect(page.locator('.ftg-wave')).toHaveText('2/21')
    const after = await play(page, { lang, begun: true, start: shoot(deck, g, displayed(deck, g)[0]!.sourceIndex) })
    expect(after.decisions).toHaveLength(21)
    await expectEnd(page, after, lang)
    await expect(page.locator('.ftg-duel strong').first()).toHaveText(`${after.decisions.filter((d) => d.hit).length}/21`)
  })

test('pointer input on the canvas picks a rock', async ({ page }, info) => {
  await open(page)
  await playButton(page).click()
  const box = (await page.locator('canvas').boundingBox())!
  const points = await page.evaluate(
    ({ x, y, w, h }) => {
      const out: number[][] = []
      for (let r = 0; r < 14; r++)
        for (let c = 0; c < 20; c++) {
          const px = x + ((c + 0.5) * w) / 20
          const py = y + ((r + 0.5) * h) / 14
          if (document.elementFromPoint(px, py)?.tagName === 'CANVAS') out.push([px, py])
        }
      return out
    },
    { x: box.x, y: box.y, w: box.width, h: box.height },
  )
  const status = page.locator('.ftg-sr').first()
  let hit = false
  for (let round = 0; round < 3 && !hit; round++)
    for (const [x, y] of points) {
      if (info.project.name === 'touch') await page.touchscreen.tap(x, y)
      else await page.mouse.click(x, y)
      if (await status.textContent()) {
        hit = true
        break
      }
    }
  expect(hit).toBe(true)
})

for (const [name, press] of [
  ['the button', async (p: Page) => p.getByRole('button', { name: l.pause }).click()],
  ['the P key', async (p: Page) => p.keyboard.press('p')],
  ['the Escape key', async (p: Page) => p.keyboard.press('Escape')],
] as const) {
  test(`pause by ${name} stops the wave counter`, async ({ page }) => {
    await open(page)
    await playButton(page).click()
    const root = page.locator('.ftg')
    const wave = page.locator('.ftg-wave')
    const hits = page.locator('.ftg-hits')
    const live = page.locator('.ftg-sr').first()
    const before = await wave.textContent()
    const hitsBefore = await hits.textContent()
    await press(page)
    await expect(root).toHaveAttribute('data-phase', 'paused')
    const twin = page.locator('[data-rock]').first()
    await twin.press('Enter')
    await expect(hits).toHaveText(hitsBefore!)
    await expect(live).toHaveText('')
    await expect(wave).toHaveText(before!)
    await page.getByRole('button', { name: strings.visible.en.resume }).click()
    await expect(root).toHaveAttribute('data-phase', 'play')
    await twin.press('Enter')
    await expect(live).not.toHaveText('')
    await expect(wave).not.toHaveText(before!)
  })
}
