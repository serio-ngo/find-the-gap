import { expect, it } from 'vitest'
import { aimTracker } from '../../src/game/aim.ts'

it('counts a move to another rock across empty space as one switch and keeps paused time out of dwell', () => {
  const a = aimTracker()
  a.reset(0)
  a.lock(0, 100, true)
  a.lock(-1, 400, true)
  a.lock(1, 500, true)
  expect(a.read([0, 1, 2])).toEqual({ dwell: [300, 0, 0], switches: 1 })
  a.lock(1, 700, false)
  a.lock(2, 700, false)
  a.resume(60_000)
  a.lock(1, 60_900, true)
  expect(a.read([0, 1, 2])).toEqual({ dwell: [300, 200, 200], switches: 1 })
  a.reset(70_000)
  expect(a.read([0, 1, 2])).toEqual({ dwell: [0, 0, 0], switches: 0 })
})

it('returns dwell per source rock when the display order is shuffled', () => {
  const a = aimTracker()
  a.reset(0)
  a.lock(0, 0, true)
  a.lock(1, 300, true)
  a.lock(-1, 400, true)
  expect(a.read([2, 0, 1])).toEqual({ dwell: [100, 0, 300], switches: 1 })
})

it('books no dwell in a new wave to the rock aimed in the previous wave', () => {
  const a = aimTracker()
  a.reset(0)
  a.lock(1, 500, true)
  a.lock(1, 1000, true)
  a.reset(2000)
  a.lock(3, 2600, true)
  a.lock(3, 3000, true)
  expect(a.read([0, 1, 2, 3])).toEqual({ dwell: [0, 0, 0, 400], switches: 0 })
})
