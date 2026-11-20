import type { Deck } from '../engine.ts'
import { fixture } from './fixture.ts'
import { lifecycle } from './lifecycle.ts'

export const decks: Record<string, Deck> = { lifecycle, fixture }
