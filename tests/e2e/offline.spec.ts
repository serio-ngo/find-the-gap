import { expect, test } from '@playwright/test'
import type { Mode } from '../../src/game/engine.ts'
import { deck, expectEnd, open, play } from './helpers.ts'

for (const mode of ['standard', 'adaptive'] as Mode[])
  test(`level 1 plays to the end with every request blocked in ${mode} mode`, async ({ page, context, baseURL }) => {
    const urls: string[] = []
    page.on('request', (r) => urls.push(r.url()))
    await open(page, 'en', 1, `?mode=${mode}`)
    await page.waitForLoadState('networkidle')
    const loaded = urls.length
    expect(loaded).toBeGreaterThan(0)
    for (const u of urls) expect(new URL(u).origin).toBe(new URL(baseURL!).origin)
    await context.route('**', (r) => r.abort())
    await context.setOffline(true)
    const g = await play(page, { mode })
    await expectEnd(page)
    expect(g.decisions).toHaveLength(deck.levels[0].sequence.length)
    expect(urls.slice(loaded).every((u) => new URL(u).pathname === '/api/game/step')).toBe(true)
  })
