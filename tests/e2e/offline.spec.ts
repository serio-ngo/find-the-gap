import { expect, test } from '@playwright/test'
import { replay } from '../../src/game/engine.ts'
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
    const e = replay(deck, 1, mode, g.decisions.map((d) => d.pick))
    await expectEnd(page, e)
    expect(urls.length).toBe(loaded)
  })
