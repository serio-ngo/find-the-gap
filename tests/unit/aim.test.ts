import { expect, it } from 'vitest'
import { aimTracker } from '../../src/game/aim.ts'

it('counts a move to another rock across empty space as one switch and keeps paused time out of dwell', () => {
  const a = aimTracker()
  a.reset(0)
  a.lock(0, 100, true)
  a.lock(-1, 400, true)
  a.lock(1, 500, true)
  expect(a.read(0)).toEqual({ dwell: 300, switches: 1 })
  a.lock(1, 700, false)
  a.lock(2, 700, false)
  a.resume(60_000)
  a.lock(1, 60_900, true)
  expect(a.read(1)).toEqual({ dwell: 200, switches: 1 })
  expect(a.read(2)).toEqual({ dwell: 200, switches: 1 })
  a.reset(70_000)
  expect(a.read(1)).toEqual({ dwell: 0, switches: 0 })
})
