import { expect, test } from '@playwright/test'
import { Run, expectEnd, open, playButton } from './helpers.ts'

test('the level plays to the end with every request blocked and never calls /step', async ({ page, context, baseURL }) => {
  const urls: string[] = []
  page.on('request', (r) => urls.push(r.url()))
  await open(page)
  await page.waitForLoadState('networkidle')
  const loaded = urls.length
  expect(loaded).toBeGreaterThan(0)
  for (const u of urls) expect(new URL(u).origin).toBe(new URL(baseURL!).origin)
  await context.route('**', (r) => r.abort())
  await context.setOffline(true)
  await playButton(page).click()
  await new Run(page).finish()
  await expectEnd(page)
  expect(urls.slice(loaded)).toEqual([])
  expect(urls.some((u) => u.endsWith('/step'))).toBe(false)
})
