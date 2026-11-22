import { expect, test, type Page } from '@playwright/test'
import { edition } from '../../src/game/eval/version.ts'
import { decks } from '../../src/game/levels/index.ts'
import { open, play, strings, type Lang } from './helpers.ts'

// Mocks /api/game/*; returns the recorded request bodies.
async function mock(page: Page, step: (r: import('@playwright/test').Route) => unknown = (r) => r.fulfill({ json: { fallback: true } })) {
  const results: { waves: number[][] }[] = []
  const steps: unknown[] = []
  await page.route('**/api/game/result', (r) => {
    results.push(r.request().postDataJSON())
    return r.fulfill({ json: {} })
  })
  await page.route('**/api/game/step', (r) => {
    steps.push(r.request().postDataJSON())
    return step(r)
  })
  return { results, steps }
}

const study = (page: Page, lang: Lang = 'en') => page.getByRole('button', { name: strings.labels[lang].contribute })
const again = (page: Page) => page.locator('.ftg-again')

test('nothing is sent until the toggle is on, then once per game', async ({ page }) => {
  const { results } = await mock(page)
  await open(page)
  await play(page)
  await expect(page.locator('.ftg')).toHaveAttribute('data-phase', 'end')
  await expect(study(page)).toHaveAttribute('aria-pressed', 'false')
  await page.waitForLoadState('networkidle')
  expect(results).toHaveLength(0)

  await study(page).click() // the game just finished is sent
  await expect(study(page)).toHaveAttribute('aria-pressed', 'true')
  await expect.poll(() => results.length).toBe(1)
  expect(results[0].waves.length).toBeGreaterThan(0)

  await study(page).click()
  await study(page).click()
  await expect(study(page)).toHaveAttribute('aria-pressed', 'true')
  await page.waitForLoadState('networkidle')
  expect(results).toHaveLength(1)

  await again(page).click()
  await play(page, { begun: true })
  await expect.poll(() => results.length).toBe(2)
})

test('a game played with the toggle already on is sent once at the end', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('ftg:study', '1'))
  const { results } = await mock(page)
  await open(page)
  await play(page)
  await expect.poll(() => results.length).toBe(1)
  await page.waitForLoadState('networkidle')
  expect(results).toHaveLength(1)
})

for (const lang of ['pl', 'en'] as Lang[])
  test(`the toggle is named in ${lang}`, async ({ page }) => {
    await mock(page)
    await open(page, lang)
    await play(page, { lang })
    await expect(study(page, lang)).toHaveAttribute('aria-pressed', 'false')
    await study(page, lang).click()
    await expect(study(page, lang)).toHaveAttribute('aria-pressed', 'true')
    await study(page, lang).click()
    await expect(study(page, lang)).toHaveAttribute('aria-pressed', 'false')
  })

test('adaptive mode uses /step answers when they arrive', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('ftg:study', '1'))
  const live = { hit: 0.9, miss: 0.1 }
  const { results, steps } = await mock(page, (r) => r.fulfill({ json: { ai: 0, ...live, cached: false } }))
  await open(page, 'en', 1, '?mode=adaptive')
  await play(page, { mode: 'adaptive', live }) // play() fails if the page shows a wave the live answers would not produce
  await expect.poll(() => results.length).toBe(1)
  expect((steps as { past: unknown[] }[]).map((s) => s.past.length)).toEqual([4, 9, 14, 19])
  expect(results[0].waves.some((w) => w[8] === 1)).toBe(true)
})

for (const [name, answer] of [['hangs', () => new Promise(() => {})], ['answers fallback', (r: import('@playwright/test').Route) => r.fulfill({ json: { fallback: true } })]] as const)
  test(`adaptive mode still plays when /step ${name}`, async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem('ftg:study', '1'))
    const { results } = await mock(page, answer)
    await open(page, 'en', 1, '?mode=adaptive')
    await play(page, { mode: 'adaptive' })
    await expect(page.locator('.ftg')).toHaveAttribute('data-phase', 'end')
    await expect.poll(() => results.length).toBe(1)
    expect(results[0].waves.every((w) => w[8] === 0)).toBe(true)
  })

test('aim data: moving between rocks is one switch, and paused time counts neither in dwell nor in reaction time', async ({ page }, info) => {
  test.skip(info.project.name === 'touch', 'hover needs a mouse')
  await page.addInitScript(() => localStorage.setItem('ftg:study', '1'))
  const { results } = await mock(page)
  await open(page)
  await page.locator('.ftg-play').click()
  const box = (await page.locator('canvas').boundingBox())!
  const n = await page.locator('[data-rock]').count()
  // the game's grid: the column count with the largest cells
  const h = box.height - 64 - 8
  const cell = (c: number) => Math.min(box.width / c, h / Math.ceil(n / c))
  const cols = Array.from({ length: n }, (_, i) => i + 1).reduce((b, c) => (cell(c) > cell(b) ? c : b))
  const rows = Math.ceil(n / cols)
  const centre = (k: number) => {
    const row = Math.floor(k / cols)
    const len = Math.min(cols, n - row * cols)
    return [box.x + (((k % cols) + 0.5) / len) * box.width, box.y + 8 + ((row + 0.5) / rows) * h] as const
  }
  await page.mouse.move(...centre(0), { steps: 5 })
  await page.mouse.move(...centre(1), { steps: 10 })
  await page.keyboard.press('p')
  await page.waitForTimeout(1500)
  await page.getByRole('button', { name: strings.visible.en.resume }).click()
  await page.mouse.move(...centre(1))
  await page.mouse.down()
  await page.mouse.up()
  await expect(page.locator('.ftg-wave')).toHaveText('2/21')
  for (let i = 2; i <= 21; i++) {
    await expect(page.locator('.ftg-wave')).toHaveText(`${i}/21`)
    await page.locator('[data-rock="0"]').dispatchEvent('click')
  }
  await expect(page.locator('.ftg')).toHaveAttribute('data-phase', 'end')
  await expect.poll(() => results.length).toBe(1)
  const [ms, switches, , ...dwell] = results[0]!.waves[0]!.slice(11)
  expect(switches).toBe(1)
  expect(dwell.reduce((t, x) => t + x, 0)).toBeLessThanOrEqual(ms!)
  expect(ms).toBeLessThan(1500)
})

test('the page carries the edition of every deck', async ({ page }) => {
  await open(page)
  const shown = JSON.parse((await page.locator('.ftg').getAttribute('data-editions'))!)
  expect(shown).toEqual(Object.fromEntries(await Promise.all(Object.values(decks).map(async (d) => [d.id, await edition(d)]))))
})
