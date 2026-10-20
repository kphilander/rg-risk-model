// ---------------------------------------------------------------------------
// Aggregate statistical reference profile for synthetic player generation.
//
// Illustrative iGaming behavioural distributions — category frequencies,
// quantiles, and rates — that drive the synthetic player generator
// (src/data/generateData.ts) so the simulated portfolio looks plausible.
//
// PRIVACY: this module contains ONLY aggregate distributions. It holds NO
// individual records, account identifiers, transactions, or play histories. The
// generator samples fresh, fully synthetic players from these distributions, so
// no real person's information or behaviour is ever reproduced.
// ---------------------------------------------------------------------------

import type { Rng } from '../lib/rng'

export interface Quantiles {
  /** Cumulative probabilities, ascending. */
  p: number[]
  /** Corresponding values at each probability. */
  v: number[]
}

const q = (p: number[], v: number[]): Quantiles => ({ p, v })

export interface ReferenceProfile {
  source: string
  /** Gender split of the population. */
  gender: { M: number; F: number }
  /** Age at registration (years). */
  age: Quantiles
  /** Registration-country share. [ISO-2, name, share]. */
  countries: [code: string, name: string, share: number][]
  /** Deposit payment-method share. [display name, share]. */
  paymentMethods: [name: string, share: number][]
  /** Single deposit amount, EUR. */
  depositEur: Quantiles
  /** Single withdrawal amount, EUR. */
  withdrawalEur: Quantiles
  /** Total stakes wagered on an active day, EUR (turnover). */
  stakesPerDayEur: Quantiles
  /** Number of individual bets on an active day. */
  betsPerDay: Quantiles
  /** Distinct active days per active customer over the multi-year window. */
  activeDaysPerUser: Quantiles
  /** Share of deposits that fail / are declined. */
  depositFailRate: number
  /** Share of withdrawals reversed or cancelled — a known RG signal. */
  withdrawalCancelRate: number
  /** Payout ratio: total winnings / total stakes (≈ 1 − house edge). */
  payoutRatio: number
  /** Share of population that triggers a responsible-gambling account closure. */
  selfExclusionRate: number
  /** Product participation among all registered customers. */
  productPlayedRate: { sports: number; casino: number; poker: number; bingo: number }
}

// ILLUSTRATIVE values only: round, generic figures chosen to look like a
// typical multi-market iGaming book (heavy-tailed amounts, male-skewed
// player base, mixed sports/casino). They are not taken from any single
// operator or research dataset.
export const REFERENCE_PROFILE: ReferenceProfile = {
  source: 'Illustrative iGaming behavioural distributions (synthetic demo; not derived from any single dataset)',
  gender: { M: 0.85, F: 0.15 },
  age: q(
    [0.05, 0.1, 0.25, 0.5, 0.75, 0.9, 0.95, 0.99],
    [19, 21, 25, 31, 40, 50, 57, 67],
  ),
  countries: [
    ['GB', 'United Kingdom', 0.22],
    ['DE', 'Germany', 0.14],
    ['ES', 'Spain', 0.1],
    ['FR', 'France', 0.09],
    ['NL', 'Netherlands', 0.08],
    ['SE', 'Sweden', 0.07],
    ['CA', 'Canada', 0.07],
    ['BE', 'Belgium', 0.04],
    ['AT', 'Austria', 0.04],
    ['PL', 'Poland', 0.04],
    ['PT', 'Portugal', 0.03],
    ['CH', 'Switzerland', 0.03],
    ['CZ', 'Czechia', 0.02],
    ['GR', 'Greece', 0.02],
    ['MT', 'Malta', 0.01],
  ],
  paymentMethods: [
    ['Debit card', 0.34],
    ['E-wallet', 0.24],
    ['Bank transfer', 0.15],
    ['Credit card', 0.1],
    ['Prepaid voucher', 0.1],
    ['Mobile pay', 0.07],
  ],
  depositEur: q(
    [0.05, 0.1, 0.25, 0.5, 0.75, 0.9, 0.95, 0.99],
    [10, 10, 15, 25, 50, 100, 200, 500],
  ),
  withdrawalEur: q(
    [0.05, 0.1, 0.25, 0.5, 0.75, 0.9, 0.95, 0.99],
    [15, 20, 40, 90, 200, 500, 900, 2500],
  ),
  stakesPerDayEur: q(
    [0.05, 0.1, 0.25, 0.5, 0.75, 0.9, 0.95, 0.99],
    [1, 2, 8, 35, 150, 600, 1500, 6000],
  ),
  betsPerDay: q(
    [0.05, 0.1, 0.25, 0.5, 0.75, 0.9, 0.95, 0.99],
    [1, 2, 5, 20, 80, 300, 600, 1500],
  ),
  activeDaysPerUser: q(
    [0.05, 0.1, 0.25, 0.5, 0.75, 0.9, 0.95, 0.99],
    [1, 1, 3, 8, 25, 70, 140, 365],
  ),
  depositFailRate: 0.15,
  withdrawalCancelRate: 0.25,
  payoutRatio: 0.95,
  selfExclusionRate: 0.03,
  productPlayedRate: { sports: 0.55, casino: 0.3, poker: 0.05, bingo: 0.02 },
}

// --- Sampling helpers ------------------------------------------------------

/** Sample a value at cumulative probability `u` from empirical quantiles,
 *  interpolating in log space (the amounts here are heavy-tailed / log-normal).
 *  Below the lowest / above the highest knot we extrapolate along the nearest
 *  segment's log-slope so the tails stay realistic. */
export function sampleQuantileAt(qn: Quantiles, u: number): number {
  const { p, v } = qn
  const lo = Math.max(1e-6, v[0] * 0.4)
  if (u <= p[0]) {
    const t = u / p[0]
    return Math.exp(lerp(Math.log(lo), Math.log(v[0]), clamp01(t)))
  }
  const last = p.length - 1
  if (u >= p[last]) {
    // Extrapolate along the final segment's slope, capped at ~3× the top knot.
    const slope =
      (Math.log(v[last]) - Math.log(v[last - 1])) / (p[last] - p[last - 1])
    const ln = Math.log(v[last]) + slope * (Math.min(u, 0.9995) - p[last])
    return Math.min(Math.exp(ln), v[last] * 3)
  }
  for (let i = 0; i < last; i++) {
    if (u <= p[i + 1]) {
      const t = (u - p[i]) / (p[i + 1] - p[i])
      return Math.exp(lerp(Math.log(v[i]), Math.log(v[i + 1]), t))
    }
  }
  return v[last]
}

/** Draw a random value from the empirical distribution. */
export function sampleQuantile(rng: Rng, qn: Quantiles): number {
  return sampleQuantileAt(qn, rng.next())
}

/** Weighted categorical pick from [value, weight] pairs. */
export function weightedPick<T>(rng: Rng, entries: readonly [T, number][]): T {
  const total = entries.reduce((s, e) => s + e[1], 0)
  let roll = rng.float(0, total)
  for (const [value, w] of entries) {
    if (roll < w) return value
    roll -= w
  }
  return entries[0][0]
}

/** Snap a euro amount to a realistic deposit/withdrawal ladder value. */
const LADDER = [
  5, 10, 15, 20, 25, 30, 40, 50, 75, 100, 150, 200, 250, 300, 500, 750, 1000,
  1500, 2000, 3000, 5000,
]
export function snapToLadder(amount: number): number {
  let best = LADDER[0]
  let bestD = Infinity
  for (const v of LADDER) {
    const d = Math.abs(Math.log(v) - Math.log(Math.max(1, amount)))
    if (d < bestD) {
      bestD = d
      best = v
    }
  }
  return best
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t
}
function clamp01(t: number): number {
  return Math.max(0, Math.min(1, t))
}
