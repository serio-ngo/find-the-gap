import { describe, expect, it } from 'vitest'
import { families, paintObject, shape } from '../../src/game/gen.ts'
import type { Part } from '../../src/game/gen.ts'

const spec = { stage: 'spec-review', conclusion: 'success', url: 'spec', steps: ['1. Set up job · success', '3. Publish the spec review · success', '6. Push commits · skipped'] }
const gate = { stage: 'gate', conclusion: 'failure', url: 'gate', steps: ['4. Test lock · success', '5. Acceptance report · failure'] }
const stages = [spec, gate]
const record = { stages, marks: ['AC1', '◆', 'Same test'], context: { url: 'spec', quote: spec.steps[1] } }
const art = (identity = 'wave:0', family: typeof families[number] = 'basalt', r = record) => shape(r, identity, family)
const painted = (s: ReturnType<typeof art>, inspected = false) => {
  const parts: Part[] = []
  paintObject(s, (p) => parts.push(p), inspected)
  return parts
}

describe('asteroid geometry', () => {
  it('reproduces every family and gives each identity its own silhouette', () => {
    for (const family of families) {
      expect(art('alpha', family)).toEqual(art('alpha', family))
      expect(art('alpha', family).outline).not.toEqual(art('beta', family).outline)
    }
    expect(new Set(families.map((family) => JSON.stringify(art('alpha', family).shell.map((p) => p.fill)))).size).toBe(families.length)
  })

  it('stays inside the sprite square', () => {
    for (const family of families) for (const id of ['a', 'b', 'c', 'd']) {
      for (const { points } of painted(art(id, family), true))
        for (const [x, y] of points) expect(Math.max(Math.abs(x), Math.abs(y))).toBeLessThanOrEqual(1)
    }
  })

  it('grows one crystal per step of its own job and makes its own step the heart', () => {
    const crystals = (s: ReturnType<typeof art>) => s.surface.filter((p) => p.width === 0.007 && ['signal', 'copper', 'dull'].includes(p.fill ?? ''))
    expect(crystals(art())).toHaveLength(spec.steps.length)
    const other = art('wave:0', 'basalt', { ...record, context: { url: 'gate', quote: gate.steps[1] } })
    expect(crystals(other)).toHaveLength(gate.steps.length)
    expect(other.surface.some((p) => p.fill === 'copper')).toBe(true)
    const heart = art('wave:0', 'basalt', { ...record, context: { url: 'spec', quote: spec.steps[0] } })
    expect(heart.surface).not.toEqual(art().surface)
  })

  it('cuts one band per stage and one tick per step output inside', () => {
    const inner = art().inner
    const ticks = inner.filter((p) => !p.fill && p.width === 0.011)
    expect(ticks).toHaveLength(spec.steps.length + gate.steps.length)
    expect(inner.filter((p) => p.fill === 'ember')).toHaveLength(1)
    const reversed = art('wave:0', 'basalt', { ...record, stages: [gate, spec] })
    expect(reversed.inner).not.toEqual(inner)
  })

  it('docks the craft of its own stage', () => {
    const craft = (quote: string, url: string) => art('wave:0', 'basalt', { ...record, context: { url, quote } }).surface
    expect(craft(spec.steps[1], 'spec')).not.toEqual(craft(gate.steps[0], 'gate'))
  })

  it('shows the clue only in the split core and keeps the closed rock free of the criterion id', () => {
    expect(painted(art())).toEqual([...art().shell, ...art().surface])
    expect(painted(art(), true)).toEqual([...art().shell, ...art().inner, ...art().surface])
    const ac2 = art('wave:0', 'basalt', { ...record, marks: ['AC2', '◆', 'Same test'] })
    expect(ac2.shell).toEqual(art().shell)
    const core = (s: ReturnType<typeof art>) => s.inner.slice(-6)
    const other = art('wave:0', 'basalt', { ...record, marks: ['AC3', '▲', 'Another test'] })
    expect(core(ac2)).toEqual(core(art()))
    expect(core(other)).not.toEqual(core(art()))
    expect(other.shell).not.toEqual(art().shell)
    const ordered = (id: string) => shape({ ...record, marks: [id, '◆', 'Same test'] }, 'wave:0', 'basalt', true)
    expect(ordered('AC2').inner).toHaveLength(ordered('AC1').inner.length + 1)
  })

  it('represents numeric precision with the measured output lengths', () => {
    const control = art('wave:0', 'basalt', { ...record, marks: ['5.00', '5.00'] })
    const sample = art('wave:0', 'basalt', { ...record, marks: ['5.00', '5.000'] })
    expect(control.surface).toEqual(sample.surface)
    expect(sample.inner).toHaveLength(control.inner.length + 1)
  })
})
