import { describe, expect, it } from 'vitest'
import { ICONS, ITEMS, itemOf } from '../../src/game/items.ts'
import { signs } from '../../src/game/levels/observations.ts'
import { rows } from '../../src/game/levels/rows.ts'

describe('items', () => {
  it('gives every drawn pattern an icon', () => {
    for (const r of rows) expect(Object.keys(ICONS), r.id).toContain(itemOf({ clue: '', rule: r.rule, values: r.values, signs: signs(r) }))
  })
  it('keys the table on the job, or on the agent where no job is drawn', () => {
    const base = { clue: '', values: [] }
    expect(itemOf({ ...base, rule: 'pair', signs: { locks: 0, job: 2, share: 0, impacts: 0, agent: 0 } })).toBe('BadgeCheck')
    expect(itemOf({ ...base, rule: 'missing_link', signs: { locks: 0, job: 0, share: 0, impacts: 0, agent: 2 } })).toBe(ITEMS.agent[2])
    expect(itemOf({ ...base, rule: 'pair', signs: null })).toBe('Badge')
  })
})
