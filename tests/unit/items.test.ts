import { describe, expect, it } from 'vitest'
import { ICONS, ITEMS, itemOf } from '../../src/game/items.ts'
import { signs } from '../../src/game/levels/observations.ts'
import { rows } from '../../src/game/levels/rows.ts'

describe('items', () => {
  it('gives every drawn pattern an icon', () => {
    for (const r of rows) expect(Object.keys(ICONS), r.id).toContain(itemOf({ clue: '', rule: r.rule, values: r.values, signs: signs(r) }))
  })
  it('keys the item on the tests job of the run', () => {
    const base = { clue: '', rule: 'odd_revision', values: [] }
    expect(itemOf({ ...base, signs: { job: 2, impacts: 0, full: 0, relocked: 0 } })).toBe('BadgeCheck')
    expect(itemOf({ ...base, signs: { job: 1, impacts: 0, full: 0, relocked: 0 } })).toBe(ITEMS[1])
    expect(itemOf({ ...base, signs: null })).toBe('Badge')
  })
})
