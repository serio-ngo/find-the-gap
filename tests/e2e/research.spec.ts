import { expect, test, type Page } from '@playwright/test'
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
