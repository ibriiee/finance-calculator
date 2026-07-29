// Runnable self-check for the faraid calculator, against classical textbook
// cases. No framework — run with:  npx tsx src/lib/faraid.test.ts
import assert from 'node:assert'
import { computeFaraid, toNumber, fracLabel, type Heirs } from './faraid'

const H = (p: Partial<Heirs>): Heirs => ({
  husband: false, wives: 0, sons: 0, daughters: 0, father: false, mother: false, ...p,
})

const run = (p: Partial<Heirs>) => {
  const r = computeFaraid(H(p))
  const get = (key: string) => r.shares.find(s => s.key === key)
  const of = (key: string) => {
    const s = get(key)
    return s ? fracLabel(s.share) : 'none'
  }
  const total = r.shares.reduce((n, s) => n + toNumber(s.share), 0) + toNumber(r.unassigned)
  return { r, of, total }
}

// Every distribution must account for exactly the whole estate.
const assertWhole = (total: number, msg: string) =>
  assert.ok(Math.abs(total - 1) < 1e-9, `${msg} — shares must total the estate (got ${total})`)

// 1. Husband + one daughter → husband 1/4; radd gives the daughter the rest.
{
  const { of, total } = run({ husband: true, daughters: 1 })
  assert.equal(of('husband'), '1/4', 'husband takes 1/4 with a child')
  assert.equal(of('daughters'), '3/4', 'daughter takes 1/2 plus radd of the surplus')
  assertWhole(total, 'husband + daughter')
}

// 2. Wife + two sons → wife 1/8, sons share 7/8.
{
  const { of, total } = run({ wives: 1, sons: 2 })
  assert.equal(of('wives'), '1/8', 'wife takes 1/8 with children')
  assert.equal(of('sons'), '7/8', 'sons take the residue')
  assertWhole(total, 'wife + 2 sons')
}

// 3. One son + one daughter → 2:1.
{
  const { of, total } = run({ sons: 1, daughters: 1 })
  assert.equal(of('sons'), '2/3', 'son takes twice the daughter')
  assert.equal(of('daughters'), '1/3', 'daughter takes half the son')
  assertWhole(total, 'son + daughter')
}

// 4. 'Umariyyatan — husband + mother + father: 1/2, 1/6, 1/3.
{
  const { r, of, total } = run({ husband: true, mother: true, father: true })
  assert.equal(of('husband'), '1/2', 'husband 1/2, no children')
  assert.equal(of('mother'), '1/6', "mother takes 1/3 of the REMAINDER ('Umariyyatan)")
  assert.equal(of('father'), '1/3', 'father takes the residue')
  assert.ok(r.notes.some(n => n.includes('Umariyyatan')), 'the Umariyyatan case is explained')
  assertWhole(total, 'umariyyatan (husband)')
}

// 5. 'Umariyyatan — wife + mother + father: 1/4, 1/4, 1/2.
{
  const { of, total } = run({ wives: 1, mother: true, father: true })
  assert.equal(of('wives'), '1/4', 'wife 1/4, no children')
  assert.equal(of('mother'), '1/4', 'mother takes 1/3 of the 3/4 remainder')
  assert.equal(of('father'), '1/2', 'father takes the residue')
  assertWhole(total, 'umariyyatan (wife)')
}

// 6. 'Awl — wife + father + mother + 2 daughters over-subscribes 24 → 27.
{
  const { r, of, total } = run({ wives: 1, father: true, mother: true, daughters: 2 })
  assert.ok(r.awl, "this classic case must trigger 'awl")
  // Classically written 3/27; fractions here are always reduced, so 3/27 = 1/9.
  assert.equal(of('wives'), '1/9', 'wife scaled to 3/27 (reduced: 1/9)')
  assert.equal(of('mother'), '4/27', 'mother scaled to 4/27')
  assert.equal(of('father'), '4/27', 'father scaled to 4/27')
  assert.equal(of('daughters'), '16/27', 'daughters scaled to 16/27')
  assertWhole(total, "'awl case")
}

// 7. Radd — mother + one daughter → 1/4 and 3/4 (1:3).
{
  const { r, of, total } = run({ mother: true, daughters: 1 })
  assert.ok(r.radd, 'surplus with no ʿasaba must trigger radd')
  assert.equal(of('mother'), '1/4', 'mother 1/6 plus her share of radd')
  assert.equal(of('daughters'), '3/4', 'daughter 1/2 plus her share of radd')
  assertWhole(total, 'radd case')
}

// 8. Father + one daughter → father is sharer AND residuary.
{
  const { of, total } = run({ father: true, daughters: 1 })
  assert.equal(of('daughters'), '1/2', 'daughter 1/2')
  assert.equal(of('father'), '1/2', 'father 1/6 plus the residue as ʿasaba')
  assertWhole(total, 'father + daughter')
}

// 9. Mother + father + son → 1/6, 1/6, 2/3.
{
  const { of, total } = run({ mother: true, father: true, sons: 1 })
  assert.equal(of('mother'), '1/6', 'mother 1/6 with children')
  assert.equal(of('father'), '1/6', 'father 1/6, the son takes the residue')
  assert.equal(of('sons'), '2/3', 'son takes the residue')
  assertWhole(total, 'mother + father + son')
}

// 10. A spouse alone does NOT take the surplus by radd — it is unassigned.
{
  const { r, of, total } = run({ husband: true })
  assert.equal(of('husband'), '1/2', 'husband 1/2, no children')
  assert.equal(fracLabel(r.unassigned), '1/2', 'the rest has no heir in scope — never radd to a spouse')
  assert.ok(!r.radd, 'radd must not fire for a spouse alone')
  assertWhole(total, 'husband alone')
}

// 11. Multiple wives share the single spouse portion between them.
{
  const { r, of } = run({ wives: 2, sons: 1 })
  assert.equal(of('wives'), '1/8', 'two wives still share one 1/8 between them')
  assert.equal(r.shares.find(s => s.key === 'wives')!.count, 2, 'count carries so the UI can divide it')
}

// 12. No heirs entered → nothing is invented.
{
  const { r } = run({})
  assert.equal(r.shares.length, 0, 'no heirs, no shares')
  assert.equal(fracLabel(r.unassigned), '1/1', 'the whole estate is unassigned')
}

console.log('faraid: all assertions passed ✓')
