import { expect, test, type Page } from '@playwright/test'
import { open, play, playButton, strings } from './helpers.ts'

const l = strings.labels.en

test('a new player finishes the first wave by keyboard only (neutral wave text, no hit or miss)', async ({ page }) => {
  await open(page)
  const start = page.locator('.ftg-play')
  for (let i = 0; i < 12 && !(await start.evaluate((e) => e === document.activeElement)); i++) await page.keyboard.press('Tab')
  await expect(playButton(page)).toBeFocused()
  await page.keyboard.press('Enter')
  await play(page, { by: 'keys', limit: 1, begun: true })
  await expect(page.locator('.ftg-hits')).toHaveText('0')
  await expect(page.locator('.ftg-sr')).toHaveText(`${l.wave} 1`)
})

test('a new player finishes the first wave with the mouse on a rock', async ({ page }) => {
  await open(page)
  await play(page, { limit: 1 })
  await expect(page.locator('.ftg-hits')).toHaveText('0')
  await expect(page.locator('.ftg-sr')).toHaveText(`${l.wave} 1`)
})

for (const lang of ['en', 'pl'] as const)
  test(`scanning in ${lang} reveals equivalent readings and does not advance the wave`, async ({ page }) => {
    await open(page, lang)
    await playButton(page, lang).click()
    const scan = page.getByRole('button', { name: strings.labels[lang].inspect })
    const twins = page.locator('[data-rock]')
    const readout = page.locator('.ftg-readout')
    const first = await twins.evaluateAll((buttons) => buttons.map((b) => b.ariaLabel!))
    expect(new Set(first).size).toBe(4)
    await expect(readout).toBeHidden()
    await scan.focus()
    await page.keyboard.press('Space')
    await expect(scan).toBeFocused()
    await expect(scan).toHaveAttribute('aria-pressed', 'true')
    await expect(readout).toBeVisible()
    await expect(page.locator('.ftg-wave')).toHaveText('1/10')
    await expect(page.locator('.ftg-sr')).toBeEmpty()
    const readings = await readout.locator('li').allTextContents()
    for (const [i, reading] of readings.entries()) await expect(twins.nth(i)).toHaveAccessibleName(`${first[i]}. ${reading}`)
    await page.keyboard.press('Space')
    await expect(readout).toBeHidden()
    for (const [i, name] of first.entries()) await expect(twins.nth(i)).toHaveAccessibleName(name)
    await play(page, { lang, begun: true, limit: 1 })
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
