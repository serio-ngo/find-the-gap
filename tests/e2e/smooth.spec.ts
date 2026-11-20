import { expect, test } from '@playwright/test'
import { expectEnd, open, play, playButton, strings } from './helpers.ts'

for (const reducedMotion of ['reduce', 'no-preference'] as const)
  test.describe(`with reducedMotion ${reducedMotion}`, () => {
    test.use({ reducedMotion })
    test('an active wave mutates no DOM for 500 ms and logs no console errors', async ({ page }) => {
      const errors: string[] = []
      page.on('console', (m) => m.type() === 'error' && errors.push(m.text()))
      page.on('pageerror', (e) => errors.push(e.message))
      await open(page)
      await playButton(page).click()
      await expect(page.locator('.ftg-rock').first()).toBeAttached()
      const mutations = await page.locator('.ftg').evaluate(
        (root) =>
          new Promise<number>((done) => {
            let n = 0
            const mo = new MutationObserver((r) => (n += r.length))
            mo.observe(root, { subtree: true, childList: true, attributes: true, characterData: true })
            setTimeout(() => done(n + mo.takeRecords().length), 500)
          }),
      )
      expect(mutations).toBe(0)
      expect(errors).toEqual([])
    })
  })

const shot = (page: import('@playwright/test').Page) => page.locator('.ftg canvas').evaluate((c: HTMLCanvasElement) => c.toDataURL())
const frames = async (page: import('@playwright/test').Page) => {
  const a = await shot(page)
  await page.waitForTimeout(200)
  return [a, await shot(page)]
}

test('the loop runs during a wave, stops when hidden, and there is one canvas', async ({ page }) => {
  await open(page)
  await playButton(page).click()
  await expect(page.locator('.ftg canvas')).toHaveCount(1)
  const [a, b] = await frames(page)
  expect(a).not.toBe(b)
  await page.evaluate(() => {
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => true })
    document.dispatchEvent(new Event('visibilitychange'))
  })
  await page.waitForTimeout(100)
  const [c, d] = await frames(page)
  expect(c).toBe(d)
})

test('after Again the first wave is spread over the field, not piled up', async ({ page }) => {
  await open(page)
  const g = await play(page)
  await expectEnd(page, g)
  await page.getByRole('button', { name: strings.labels.en.replay, exact: true }).click()
  await page.waitForTimeout(1500) // fly-in done
  // count non-field pixels above the ship band in each third of the canvas; a pile-up fills only one
  const thirds = await page.locator('.ftg canvas').evaluate((c: HTMLCanvasElement) => {
    const x = c.getContext('2d')!
    const h = c.height - 64 * (c.height / c.clientHeight)
    return [0, 1, 2].map((i) => {
      const d = x.getImageData(Math.floor((i * c.width) / 3), 0, Math.floor(c.width / 3), h).data
      let n = 0
      for (let k = 0; k < d.length; k += 4) if (d[k] + d[k + 1] + d[k + 2] > 150) n++
      return n
    })
  })
  expect(thirds.filter((n) => n > 1000).length).toBeGreaterThanOrEqual(2)
})
