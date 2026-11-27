import { existsSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import curation from '../../scripts/deck/curation.json'
import { gateReport } from '../../scripts/gates.ts'
import { buildWorld } from '../../scripts/world.ts'
import { gapOf } from '../../src/game/levels/observations.ts'
import { rows } from '../../src/game/levels/rows.ts'
import { world } from '../../src/game/levels/world.ts'

const archive = 'C:/Users/Lenovo/Repos/lifecycle-runs'
const levels = (name: string) => fileURLToPath(new URL(`../../src/game/levels/${name}`, import.meta.url))
const rooms = world.wings.flatMap((w) => w.suites.flatMap((s) => s.rooms)).filter((r) => r.monsters.length)
const byId = new Map(rows.map((r) => [r.id, r]))
const certain = rooms.filter((r) => r.certain)

describe('world', () => {
  it.skipIf(!existsSync(archive))('rebuilds byte-identical from the archive', () => {
    const files = buildWorld({ observations: readFileSync(`${archive}/observations.jsonl`, 'utf8'), cases: readFileSync(`${archive}/cases.jsonl`, 'utf8'), snapshots: Object.fromEntries(['serio-focus', 'lifecycle-sandbox'].map((r) => [r, readFileSync(`${archive}/snapshot/serio-ngo/${r}.json`, 'utf8')])) }, curation)
    expect(Object.keys(files).length).toBeGreaterThan(2)
    for (const [name, text] of Object.entries(files)) expect(text).toBe(readFileSync(levels(name), 'utf8'))
  })

  it('gives each certain room on the trunk exactly one gap, 3 to 5 monsters and one relation', () => {
    expect(certain).toHaveLength(4)
    const trunk = world.wings.find((w) => w.repo.endsWith('serio-focus'))!.trunk
    for (const r of certain) {
      expect(trunk).toContain(r.id)
      expect(r.monsters.length).toBeGreaterThanOrEqual(3)
      expect(r.monsters.length).toBeLessThanOrEqual(5)
      expect(r.monsters.filter((id) => gapOf[byId.get(id)!.rule]!(byId.get(id)!.values))).toHaveLength(1)
      expect(new Set(r.monsters.map((id) => byId.get(id)!.rule)).size).toBe(1)
    }
  })

  it('places every row in exactly one room of 3 to 5 monsters of one relation', () => {
    const placed = rooms.flatMap((r) => r.monsters)
    expect(new Set(placed).size).toBe(placed.length)
    expect([...placed].sort()).toEqual(rows.map((r) => r.id).sort())
    for (const r of rooms) {
      expect(r.monsters.length).toBeGreaterThanOrEqual(3)
      expect(r.monsters.length).toBeLessThanOrEqual(5)
      expect(new Set(r.monsters.map((id) => byId.get(id)!.rule)).size).toBe(1)
    }
  })

  it('passes the field, reader, red herring and permutation gates', () => {
    const g = gateReport(world, rows)
    for (const share of Object.values(g.fields)) expect(share).toBeLessThanOrEqual(0.65)
    expect(g.reader).toBeLessThanOrEqual(0.65)
    expect(g.herrings).toBeGreaterThanOrEqual(2)
    expect(g.p).toBeGreaterThanOrEqual(0.05)
  })

  it('places no row of the curation list', () => {
    const placed = new Set(rooms.flatMap((r) => r.monsters))
    for (const id of Object.keys(curation)) expect(placed.has(id)).toBe(false)
  })
})
