import { describe, expect, it } from 'vitest'
import { families, paintObject, shape } from '../../src/game/gen.ts'
import type { Part } from '../../src/game/gen.ts'

const stages = [
  { stage: 'spec-review', run: 11, steps: ['3. Publish the spec review · success', '6. Push commits · skipped'] },
  { stage: 'gate', run: 12, steps: ['4. Test lock · success', '5. Acceptance report · success'] },
]
const record = { stages, marks: ['AC1', '◆', 'Same test'] }
const art = (identity = 'wave:0', family: typeof families[number] = 'salvage tug') => shape(record, identity, family)

describe('target geometry', () => {
  it('reproduces each family and gives different seeds different hulls', () => {
    for (const family of families) {
      expect(art('alpha', family)).toEqual(art('alpha', family))
      expect(art('alpha', family).outline).not.toEqual(art('beta', family).outline)
    }
    expect(new Set(families.map((family) => JSON.stringify(art('alpha', family).outline))).size).toBe(families.length)
  })

  it('mounts job-specific hardware and keeps its closed geometry independent of the result', () => {
    const spec = { ...stages[0], url: 'spec' }
    const test = { ...stages[1], stage: 'write-tests', url: 'test' }
    const equipment = (url: string, quote: string) =>
      shape({ ...record, stages: [spec, test], context: { url, quote } }, 'wave:0', 'salvage tug')
    const survey = equipment('spec', '3. Publish the spec review · success')
    const vanes = equipment('test', '9. Brief · success')
    expect(survey.outline).not.toEqual(vanes.outline)
    expect(vanes.details).toEqual(equipment('test', '9. Brief · failure').details)
  })

  it('maps stage order and recorded step order into the subsystem parts', () => {
    const base = art()
    const reverse = shape({ ...record, stages: [...stages].reverse() }, 'wave:0', 'salvage tug')
    const steps = shape({ ...record, stages: [{ ...stages[0], steps: stages[0].steps.slice().reverse() }, stages[1]] }, 'wave:0', 'salvage tug')
    expect(reverse.outline).toEqual(base.outline)
    expect(reverse.systems).not.toEqual(base.systems)
    expect(steps.systems).not.toEqual(base.systems)
    for (const step of ['5. Delivery manifest · success', '5. Acceptance report · failure', '5. Acceptance report · skipped']) {
      const changed = shape({ ...record, stages: [stages[0], { ...stages[1], steps: [stages[1].steps[0], step] }] }, 'wave:0', 'salvage tug')
      expect(changed.systems).not.toEqual(base.systems)
      const parts: Part[] = []
      paintObject(changed, (part) => parts.push(part))
      expect(parts).toEqual(base.details)
    }
  })

  it('only paints the shared evidence motif on deliberate inspection', () => {
    const a = art()
    const b = shape({ ...record, marks: ['AC2', '◆', 'Same test'] }, 'wave:1', 'ring observatory')
    const c = shape({ ...record, marks: ['AC3', '▲', 'Another test'] }, 'wave:2', 'orbital probe')
    expect(a.motif).toEqual(b.motif)
    expect(a.motif).not.toEqual(c.motif)
    const ordered = (id: string) => shape({ ...record, marks: [id, '◆', 'Same test'] }, 'wave:0', 'salvage tug', true)
    expect(ordered('AC2').motif).toHaveLength(ordered('AC1').motif.length + 1)
    const parts: Part[] = []
    paintObject(a, (p) => parts.push(p))
    expect(parts).toEqual(a.details)
    parts.length = 0
    paintObject(a, (p) => parts.push(p), true)
    expect(parts).toEqual([...a.details, ...a.systems, ...a.motif])
  })

  it('represents numeric precision with the measured output lengths', () => {
    const control = shape({ stages, marks: ['5.00', '5.00'] }, 'wave:0', 'salvage tug')
    const sample = shape({ stages, marks: ['5.00', '5.000'] }, 'wave:0', 'salvage tug')
    expect(control.details).toEqual(sample.details)
    expect(control.systems).toEqual(sample.systems)
    expect(sample.motif).toHaveLength(control.motif.length + 1)
  })
})
