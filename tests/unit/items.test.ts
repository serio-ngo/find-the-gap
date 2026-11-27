import { describe, expect, it } from 'vitest'
import { ICONS, itemOf } from '../../src/game/items.ts'
import { rows } from '../../src/game/levels/rows.ts'

describe('items', () => {
  it('gives every row an icon from its relation, never from the tests job or the gap', () => {
    for (const r of rows) {
      expect(Object.keys(ICONS), r.id).toContain(itemOf(r))
      expect(itemOf({ rule: r.rule })).toBe(itemOf(r))
    }
  })
})
