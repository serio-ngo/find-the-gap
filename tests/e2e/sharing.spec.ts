import { expect, test } from '@playwright/test'
import { aiPick, wave } from '../../src/game/engine.ts'
import { deck, levelUrl, open, play, right, run, strings, wrong } from './helpers.ts'
import { resultText } from '../../src/game/share.ts'

const l = strings.labels.en

test.beforeEach(async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write'])
  await open(page)
})

const finish = async (page: import('@playwright/test').Page) => {
  const g = await play(page, { pick: (s) => (s.decisions.length % 3 ? right(deck, s) : wrong(deck, s)) })
  const played = g.decisions.filter((d) => d.hit !== null)
  const text = resultText({
    deck: strings.visible.en.title,
    level: 1,
    mode: 'standard',
    you: played.map((d) => d.hit as boolean),
    ai: g.decisions.flatMap((d, i) => (d.hit === null ? [] : [wave(deck, d.spec).answers.includes(Number(aiPick(run, g, i)!.choice.slice(1)))])),
    lang: 'en',
    url: levelUrl('en'),
  })
  return text
}

test('X and Bluesky links carry the emoji result and the level URL', async ({ page }) => {
  const text = await finish(page)
  for (const [name, host] of [[l.x, 'x.com'], [l.bluesky, 'bsky.app']]) {
    const href = new URL((await page.getByRole('link', { name }).getAttribute('href'))!)
    expect(href.hostname).toBe(host)
    expect(href.searchParams.get('text')).toBe(text)
    expect(text).toContain(levelUrl('en'))
  }
})

test('LinkedIn and Facebook links carry the level URL', async ({ page }) => {
  await finish(page)
  const linkedin = new URL((await page.getByRole('link', { name: l.linkedin }).getAttribute('href'))!)
  const facebook = new URL((await page.getByRole('link', { name: l.facebook }).getAttribute('href'))!)
  expect(linkedin.searchParams.get('url')).toBe(levelUrl('en'))
  expect(facebook.searchParams.get('u')).toBe(levelUrl('en'))
})

test('copy writes the result text to the clipboard', async ({ page }) => {
  const text = await finish(page)
  await page.getByRole('button', { name: l.copy }).click()
  await expect.poll(() => page.evaluate(async () => (await navigator.clipboard.readText()).replaceAll('\r\n', '\n'))).toBe(text)
})

test('og:image points to a preview PNG that loads and og:url is the level URL', async ({ page, request }) => {
  await expect(page.locator('meta[property="og:url"]')).toHaveAttribute('content', levelUrl('en'))
  const image = new URL((await page.locator('meta[property="og:image"]').getAttribute('content'))!)
  const res = await request.get(image.pathname)
  expect(res.ok()).toBe(true)
  expect(res.headers()['content-type']).toBe('image/png')
  expect((await res.body()).subarray(1, 4).toString()).toBe('PNG')
})
