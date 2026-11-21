import { begin, shoot } from '../src/game/engine.ts'
import type { Deck, Game, Mode } from '../src/game/engine.ts'

export const replay = (d: Deck, level: number, mode: Mode, picks: number[]): Game =>
  picks.reduce((g, p) => shoot(d, g, p), begin(d, level, mode))
