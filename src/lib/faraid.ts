// Faraid — Islamic inheritance shares (UPGRADES #98).
//
// SCOPE, STATED HONESTLY: this covers the COMMON estate — spouse(s), sons,
// daughters, father, mother — including 'awl (shares over-subscribe, everyone
// scales down) and radd (shares under-subscribe with no residuary, surplus
// returns to blood heirs but never to a spouse), plus the 'Umariyyatan cases.
// It deliberately does NOT model siblings, grandparents, grandchildren, uncles,
// or the hajb (exclusion) rules between them. A real estate with those heirs
// MUST go to a qualified scholar — the UI says so, loudly.
//
// Pure arithmetic on exact fractions: no floats, so no drift. Self-checked in
// faraid.test.ts against textbook cases.

export interface Heirs {
  husband: boolean
  wives: number
  sons: number
  daughters: number
  father: boolean
  mother: boolean
}

export interface Share {
  key: string
  label: string
  /** How many people share this portion (e.g. 3 sons) */
  count: number
  /** Portion of the whole estate for the WHOLE group */
  share: Frac
  reason: string
}

export interface FaraidResult {
  shares: Share[]
  /** 'awl = shares over-subscribed and were scaled down proportionally */
  awl: boolean
  /** radd = surplus returned to blood heirs (spouse excluded) */
  radd: boolean
  /** Portion with no heir in scope — goes to bayt al-mal / charity per the school followed */
  unassigned: Frac
  notes: string[]
}

// ── exact fractions ─────────────────────────────────────────
export interface Frac { n: number; d: number }
const gcd = (a: number, b: number): number => (b === 0 ? a : gcd(b, a % b))
export const frac = (n: number, d: number): Frac => {
  if (d === 0) return { n: 0, d: 1 }
  const s = d < 0 ? -1 : 1
  const g = gcd(Math.abs(n), Math.abs(d)) || 1
  return { n: (n * s) / g, d: (d * s) / g }
}
const add = (a: Frac, b: Frac) => frac(a.n * b.d + b.n * a.d, a.d * b.d)
const sub = (a: Frac, b: Frac) => frac(a.n * b.d - b.n * a.d, a.d * b.d)
const mul = (a: Frac, b: Frac) => frac(a.n * b.n, a.d * b.d)
export const toNumber = (f: Frac) => f.n / f.d
export const fracLabel = (f: Frac) => (f.n === 0 ? '0' : `${f.n}/${f.d}`)

const ZERO: Frac = { n: 0, d: 1 }
const ONE: Frac = { n: 1, d: 1 }

/**
 * Distribute an estate among the heirs in scope.
 * Returns group shares as exact fractions of the whole estate.
 */
export function computeFaraid(h: Heirs): FaraidResult {
  const notes: string[] = []
  const hasChild = h.sons > 0 || h.daughters > 0
  const hasSon = h.sons > 0

  // Fixed (Quranic) shares. `blood` marks heirs eligible for radd — a spouse never is.
  const fixed: { key: string; label: string; count: number; share: Frac; reason: string; blood: boolean }[] = []

  // ── Spouse ────────────────────────────────────────────────
  let spouseShare: Frac = ZERO
  if (h.husband) {
    spouseShare = hasChild ? frac(1, 4) : frac(1, 2)
    fixed.push({
      key: 'husband', label: 'Husband', count: 1, share: spouseShare, blood: false,
      reason: hasChild ? '1/4 — with children' : '1/2 — no children',
    })
  } else if (h.wives > 0) {
    spouseShare = hasChild ? frac(1, 8) : frac(1, 4)
    fixed.push({
      key: 'wives', label: h.wives > 1 ? `Wives (${h.wives})` : 'Wife', count: h.wives, share: spouseShare, blood: false,
      reason: `${hasChild ? '1/8 — with children' : '1/4 — no children'}${h.wives > 1 ? ', shared equally' : ''}`,
    })
  }

  // ── Mother ────────────────────────────────────────────────
  // 'Umariyyatan: spouse + both parents, no children — the mother takes a third
  // of what REMAINS after the spouse, not a third of the whole estate.
  const umariyya = h.mother && h.father && !hasChild && (h.husband || h.wives > 0)
  if (h.mother) {
    const share = hasChild
      ? frac(1, 6)
      : umariyya
        ? mul(frac(1, 3), sub(ONE, spouseShare))
        : frac(1, 3)
    fixed.push({
      key: 'mother', label: 'Mother', count: 1, share, blood: true,
      reason: hasChild ? '1/6 — with children'
        : umariyya ? "1/3 of the remainder after the spouse ('Umariyyatan)'"
        : '1/3 — no children',
    })
    if (umariyya) notes.push("'Umariyyatan case: the mother takes one third of the remainder after the spouse's share, not one third of the whole estate.")
  }

  // ── Father ────────────────────────────────────────────────
  // With a son he is a pure fixed-sharer (1/6). With daughters only he takes 1/6
  // AND mops up the residue as 'asaba. With no children he is residuary.
  const fatherIsResiduary = h.father && !hasSon
  if (h.father) {
    if (hasChild) {
      fixed.push({
        key: 'father', label: 'Father', count: 1, share: frac(1, 6), blood: true,
        reason: hasSon ? '1/6 — a son takes the residue' : '1/6, plus the residue as ʿasaba',
      })
    }
    // No children: father is pure residuary — added after fixed shares below.
  }

  // ── Daughters with no son take a fixed share ──────────────
  if (!hasSon && h.daughters > 0) {
    fixed.push({
      key: 'daughters', label: h.daughters > 1 ? `Daughters (${h.daughters})` : 'Daughter',
      count: h.daughters, share: h.daughters === 1 ? frac(1, 2) : frac(2, 3), blood: true,
      reason: h.daughters === 1 ? '1/2 — one daughter, no son' : '2/3 — two or more daughters, no son, shared equally',
    })
  }

  let totalFixed = fixed.reduce((s, f) => add(s, f.share), ZERO)
  const shares: Share[] = []
  let awl = false, radd = false
  let unassigned: Frac = ZERO

  // ── 'Awl: fixed shares exceed the estate → scale everyone down ──
  if (toNumber(totalFixed) > 1) {
    awl = true
    notes.push(`ʿAwl: the fixed shares add up to more than the estate (${fracLabel(totalFixed)}), so every share is reduced proportionally — the classical solution.`)
    fixed.forEach(f => shares.push({
      key: f.key, label: f.label, count: f.count,
      share: frac(f.share.n * totalFixed.d, f.share.d * totalFixed.n),
      reason: f.reason,
    }))
    return { shares, awl, radd, unassigned: ZERO, notes }
  }

  fixed.forEach(f => shares.push({ key: f.key, label: f.label, count: f.count, share: f.share, reason: f.reason }))
  let residue = sub(ONE, totalFixed)

  // ── Residue → the ʿasaba ──────────────────────────────────
  if (toNumber(residue) > 0) {
    if (hasSon) {
      // Children take the residue, a son receiving twice a daughter's portion.
      const parts = h.sons * 2 + h.daughters
      if (h.sons > 0) shares.push({
        key: 'sons', label: h.sons > 1 ? `Sons (${h.sons})` : 'Son', count: h.sons,
        share: mul(residue, frac(h.sons * 2, parts)),
        reason: h.daughters > 0 ? 'Residue as ʿasaba — a son takes twice a daughter’s portion' : 'Residue as ʿasaba',
      })
      if (h.daughters > 0) shares.push({
        key: 'daughters', label: h.daughters > 1 ? `Daughters (${h.daughters})` : 'Daughter', count: h.daughters,
        share: mul(residue, frac(h.daughters, parts)),
        reason: 'Residue as ʿasaba — half a son’s portion each',
      })
      residue = ZERO
    } else if (fatherIsResiduary) {
      const existing = shares.find(s => s.key === 'father')
      if (existing) {
        existing.share = add(existing.share, residue)
        existing.reason = '1/6 plus the residue as ʿasaba'
      } else {
        shares.push({ key: 'father', label: 'Father', count: 1, share: residue, reason: 'Residue as ʿasaba — no children' })
      }
      residue = ZERO
    }
  }

  // ── Radd: surplus with no residuary returns to the blood heirs ──
  if (toNumber(residue) > 0) {
    const bloodKeys = fixed.filter(f => f.blood).map(f => f.key)
    const bloodTotal = fixed.filter(f => f.blood).reduce((s, f) => add(s, f.share), ZERO)
    if (bloodKeys.length > 0 && toNumber(bloodTotal) > 0) {
      radd = true
      notes.push('Radd: the fixed shares did not use up the estate and there is no ʿasaba, so the surplus returns to the blood heirs in proportion — a spouse never shares in radd.')
      shares.forEach(s => {
        if (!bloodKeys.includes(s.key)) return
        const portion = frac(s.share.n * bloodTotal.d, s.share.d * bloodTotal.n)  // s.share / bloodTotal
        s.share = add(s.share, mul(residue, portion))
      })
      residue = ZERO
    } else {
      // Only a spouse survives in scope — the remainder is not theirs by radd.
      unassigned = residue
      notes.push('The remainder has no heir among those entered. Classically it passes to the bayt al-māl (public treasury); many today give it in charity or to distant kin — ask your scholar.')
    }
  }

  return { shares, awl, radd, unassigned, notes }
}
