import type { DailyActivity, MarkerResult, PlayerProfile } from '../types'
import { DEFAULT_MARKER_WEIGHTS } from '../core/config'

// ---------------------------------------------------------------------------
// Analysis helpers — shared aggregates over the activity window.
// ---------------------------------------------------------------------------

function mean(xs: number[]): number {
  if (xs.length === 0) return 0
  return xs.reduce((s, x) => s + x, 0) / xs.length
}

function clamp(n: number, lo = 0, hi = 100): number {
  return Math.max(lo, Math.min(hi, n))
}

/** Map a level within [lo, hi] onto a 0-100 score. */
function levelScore(value: number, lo: number, hi: number): number {
  if (hi === lo) return 0
  return clamp(((value - lo) / (hi - lo)) * 100)
}

/** Map relative growth (recent/early - 1) onto 0-100, hitting 100 at `fullAt`. */
function growthScore(early: number, recent: number, fullAt: number): number {
  if (early <= 0) return recent > 0 ? 65 : 0
  const growth = recent / early - 1
  return clamp((growth / fullAt) * 100)
}

interface Windows {
  all: DailyActivity[]
  played: DailyActivity[]
  firstHalf: DailyActivity[]
  secondHalf: DailyActivity[]
  recent21: DailyActivity[]
  firstPlayed: DailyActivity[]
  secondPlayed: DailyActivity[]
}

function windows(activity: DailyActivity[]): Windows {
  const mid = Math.floor(activity.length / 2)
  const firstHalf = activity.slice(0, mid)
  const secondHalf = activity.slice(mid)
  return {
    all: activity,
    played: activity.filter((d) => d.played),
    firstHalf,
    secondHalf,
    recent21: activity.slice(-21),
    firstPlayed: firstHalf.filter((d) => d.played),
    secondPlayed: secondHalf.filter((d) => d.played),
  }
}

// ---------------------------------------------------------------------------
// The 13 behavioral markers. Each returns a 0-100 contribution + explanation.
// ---------------------------------------------------------------------------

type MarkerFn = (w: Windows) => Omit<MarkerResult, 'weight'>

const chasingLosses: MarkerFn = (w) => {
  // Days where a loss is immediately followed by a fresh deposit / continued play.
  let lossDays = 0
  let chasedAfterLoss = 0
  let stakeBump = 0
  let bumpCount = 0
  for (let i = 1; i < w.all.length; i++) {
    const prev = w.all[i - 1]
    const cur = w.all[i]
    if (prev.played && prev.net < 0 && Math.abs(prev.net) > prev.avgStake * 5) {
      lossDays++
      if (cur.played && (cur.deposits > 0 || cur.bets > 0)) {
        chasedAfterLoss++
        if (prev.avgStake > 0) {
          stakeBump += cur.avgStake / prev.avgStake
          bumpCount++
        }
      }
    }
  }
  const ratio = lossDays > 0 ? chasedAfterLoss / lossDays : 0
  const avgBump = bumpCount > 0 ? stakeBump / bumpCount : 1
  const score = clamp(ratio * 70 + clamp((avgBump - 1) * 120, 0, 40))
  return {
    id: 'chasing-losses',
    label: 'Chasing losses',
    score,
    value: `${Math.round(ratio * 100)}% of loss days chased`,
    explanation:
      lossDays === 0
        ? 'No meaningful loss-then-redeposit pattern detected.'
        : `Returned to play or re-deposited after ${chasedAfterLoss} of ${lossDays} significant loss days, often at higher stakes (${avgBump.toFixed(1)}× prior stake).`,
  }
}

const increasingBets: MarkerFn = (w) => {
  const early = mean(w.firstPlayed.map((d) => d.avgStake))
  const recent = mean(w.secondPlayed.map((d) => d.avgStake))
  const score = growthScore(early, recent, 1.5)
  const growthPct = early > 0 ? (recent / early - 1) * 100 : 0
  return {
    id: 'increasing-bets',
    label: 'Increasing bet sizes',
    score,
    value: `${growthPct > 0 ? '+' : ''}${Math.round(growthPct)}% avg stake`,
    explanation:
      score < 15
        ? 'Average stake is broadly stable across the window.'
        : `Average stake rose from ${early.toFixed(1)} to ${recent.toFixed(1)} over the 92-day window — a sustained escalation in wager size.`,
  }
}

const depositVolatility: MarkerFn = (w) => {
  const deposits = w.played.map((d) => d.deposits).filter((x) => x > 0)
  const m = mean(deposits)
  const sd = Math.sqrt(mean(deposits.map((x) => (x - m) ** 2)))
  const cv = m > 0 ? sd / m : 0
  const score = levelScore(cv, 0.4, 1.6)
  return {
    id: 'deposit-volatility',
    label: 'Deposit volatility',
    score,
    value: `CV ${cv.toFixed(2)}`,
    explanation:
      score < 15
        ? 'Deposits are consistent in size and cadence.'
        : `Deposit amounts swing erratically (coefficient of variation ${cv.toFixed(2)}), a sign of unplanned, impulsive funding.`,
  }
}

const lossOfWinnings: MarkerFn = (w) => {
  // Win days followed by giving the winnings back on subsequent play.
  let winDays = 0
  let gaveBack = 0
  for (let i = 0; i < w.all.length - 1; i++) {
    const cur = w.all[i]
    if (cur.played && cur.net > cur.avgStake * 8) {
      winDays++
      // Look at the next two playing days.
      let returned = 0
      for (let j = i + 1; j < Math.min(i + 4, w.all.length); j++) {
        if (w.all[j].played) returned += w.all[j].net
      }
      if (returned < -cur.net * 0.6) gaveBack++
    }
  }
  const cancels = w.played.reduce((s, d) => s + d.withdrawalCancellations, 0)
  const ratio = winDays > 0 ? gaveBack / winDays : 0
  const score = clamp(ratio * 70 + levelScore(cancels, 0, 6) * 0.4)
  return {
    id: 'loss-of-winnings',
    label: 'Repeated loss of winnings',
    score,
    value: `${gaveBack}/${winDays} wins given back`,
    explanation:
      winDays === 0
        ? 'No notable winning days to give back.'
        : `Surrendered winnings after ${gaveBack} of ${winDays} winning days${cancels > 0 ? `, and cancelled ${cancels} withdrawal(s) to keep playing` : ''}.`,
  }
}

const paymentSwitching: MarkerFn = (w) => {
  let switches = 0
  let last = ''
  const distinct = new Set<string>()
  for (const d of w.played) {
    if (!d.paymentMethod) continue
    distinct.add(d.paymentMethod)
    if (last && d.paymentMethod !== last) switches++
    last = d.paymentMethod
  }
  const score = clamp(levelScore(distinct.size, 1, 6) * 0.6 + levelScore(switches, 0, 12) * 0.7)
  return {
    id: 'payment-switching',
    label: 'Payment-method switching',
    score,
    value: `${distinct.size} methods, ${switches} switches`,
    explanation:
      score < 15
        ? 'Funds the account through a stable payment method.'
        : `Rotated between ${distinct.size} payment methods with ${switches} switches — can indicate exhausted funds or circumventing limits.`,
  }
}

const impulsiveTransactions: MarkerFn = (w) => {
  const cancels = w.played.reduce((s, d) => s + d.withdrawalCancellations, 0)
  const multiDeposit = w.played.filter((d) => d.depositCount >= 3).length
  const score = clamp(levelScore(cancels, 0, 6) * 0.6 + levelScore(multiDeposit, 0, 10) * 0.6)
  return {
    id: 'impulsive-transactions',
    label: 'Impulsive transactions',
    score,
    value: `${cancels} cancels, ${multiDeposit} multi-deposit days`,
    explanation:
      score < 15
        ? 'Transaction behaviour appears deliberate and controlled.'
        : `${cancels} cancelled withdrawal(s) and ${multiDeposit} day(s) with 3+ deposits point to impulsive, in-the-moment decisions.`,
  }
}

const longerSessions: MarkerFn = (w) => {
  const early = mean(w.firstPlayed.map((d) => d.minutes))
  const recent = mean(w.secondPlayed.map((d) => d.minutes))
  const absScore = levelScore(recent, 40, 150)
  const trendScore = growthScore(early, recent, 1.2)
  const score = clamp(absScore * 0.55 + trendScore * 0.55)
  return {
    id: 'longer-sessions',
    label: 'Longer session durations',
    score,
    value: `${Math.round(recent)} min/day recent`,
    explanation:
      score < 15
        ? 'Session lengths are short and stable.'
        : `Daily play time grew from ~${Math.round(early)} to ~${Math.round(recent)} minutes, with extended, intense sessions.`,
  }
}

const playFrequency: MarkerFn = (w) => {
  // Longest consecutive-day streak + rise in play-day frequency.
  let streak = 0
  let maxStreak = 0
  for (const d of w.all) {
    if (d.played) {
      streak++
      maxStreak = Math.max(maxStreak, streak)
    } else streak = 0
  }
  const earlyFreq = w.firstHalf.length ? w.firstPlayed.length / w.firstHalf.length : 0
  const recentFreq = w.secondHalf.length ? w.secondPlayed.length / w.secondHalf.length : 0
  const score = clamp(
    levelScore(maxStreak, 4, 21) * 0.5 +
      levelScore(recentFreq, 0.4, 0.95) * 0.3 +
      growthScore(earlyFreq, recentFreq, 1) * 0.3,
  )
  return {
    id: 'play-frequency',
    label: 'Play frequency',
    score,
    value: `${maxStreak}-day streak, ${Math.round(recentFreq * 100)}% of days`,
    explanation:
      score < 15
        ? 'Plays occasionally with frequent breaks.'
        : `Played on ${Math.round(recentFreq * 100)}% of recent days with a peak run of ${maxStreak} consecutive days — little time away from gambling.`,
  }
}

const lateNightPlay: MarkerFn = (w) => {
  const recentNight = mean(w.secondPlayed.map((d) => d.nightFraction))
  // Context-aware: slow (sportsbook/lottery) play is discounted.
  const fastShare =
    w.secondPlayed.length > 0
      ? w.secondPlayed.filter((d) => d.gameSpeed !== 'slow').length / w.secondPlayed.length
      : 0
  const score = clamp(levelScore(recentNight, 0.1, 0.55) * (0.6 + fastShare * 0.4))
  return {
    id: 'late-night-play',
    label: 'Late-night play',
    score,
    value: `${Math.round(recentNight * 100)}% overnight`,
    explanation:
      score < 15
        ? 'Little play during overnight hours.'
        : `${Math.round(recentNight * 100)}% of recent play falls between midnight and 6am — disrupted routines often accompany escalating risk.`,
  }
}

const fasterGames: MarkerFn = (w) => {
  const earlyFast =
    w.firstPlayed.length > 0
      ? w.firstPlayed.filter((d) => d.gameSpeed === 'fast').length / w.firstPlayed.length
      : 0
  const recentFast =
    w.secondPlayed.length > 0
      ? w.secondPlayed.filter((d) => d.gameSpeed === 'fast').length / w.secondPlayed.length
      : 0
  const score = clamp(levelScore(recentFast, 0.25, 0.85) * 0.6 + growthScore(earlyFast || 0.05, recentFast, 1.5) * 0.5)
  return {
    id: 'faster-games',
    label: 'Shift to faster games',
    score,
    value: `${Math.round(recentFast * 100)}% high-speed`,
    explanation:
      score < 15
        ? 'Game mix is stable and weighted to slower products.'
        : `Migrated toward high-speed, high-volatility games (${Math.round(earlyFast * 100)}% → ${Math.round(recentFast * 100)}% of play) which accelerate losses.`,
  }
}

const toleranceForLoss: MarkerFn = (w) => {
  const earlyPeak = mean(w.firstPlayed.map((d) => d.peakStake))
  const recentPeak = mean(w.secondPlayed.map((d) => d.peakStake))
  const earlyLoss = mean(w.firstPlayed.filter((d) => d.net < 0).map((d) => -d.net))
  const recentLoss = mean(w.secondPlayed.filter((d) => d.net < 0).map((d) => -d.net))
  const score = clamp(growthScore(earlyPeak, recentPeak, 1.4) * 0.55 + growthScore(earlyLoss, recentLoss, 1.6) * 0.55)
  return {
    id: 'tolerance-for-loss',
    label: 'Increasing loss tolerance',
    score,
    value: `peak stake ${recentPeak.toFixed(0)}`,
    explanation:
      score < 15
        ? 'Peak stakes and absorbed losses are steady.'
        : `Peak stakes and tolerated daily losses have climbed (peak ${earlyPeak.toFixed(0)} → ${recentPeak.toFixed(0)}), reflecting growing tolerance for larger risks.`,
  }
}

const inabilityToStop: MarkerFn = (w) => {
  // Long sessions / extra sessions on heavy-loss days.
  let lossPlayDays = 0
  let extendedOnLoss = 0
  for (const d of w.played) {
    if (d.net < -d.avgStake * 8) {
      lossPlayDays++
      if (d.minutes > 75 || d.sessions >= 2) extendedOnLoss++
    }
  }
  const ratio = lossPlayDays > 0 ? extendedOnLoss / lossPlayDays : 0
  const score = clamp(ratio * 80 + levelScore(lossPlayDays, 2, 25) * 0.3)
  return {
    id: 'inability-to-stop',
    label: 'Inability to stop',
    score,
    value: `${extendedOnLoss}/${lossPlayDays} heavy-loss days extended`,
    explanation:
      lossPlayDays === 0
        ? 'No pattern of pushing on through heavy losses.'
        : `Kept playing through ${extendedOnLoss} of ${lossPlayDays} heavy-loss days with extended or repeated sessions — difficulty disengaging.`,
  }
}

const depositEscalation: MarkerFn = (w) => {
  const early = mean(w.firstPlayed.map((d) => d.depositCount))
  const recent = mean(w.secondPlayed.map((d) => d.depositCount))
  const score = growthScore(early || 0.2, recent, 1.2)
  return {
    id: 'deposit-escalation',
    label: 'Deposit-frequency escalation',
    score,
    value: `${recent.toFixed(1)} deposits/active day`,
    explanation:
      score < 15
        ? 'Deposit frequency is stable.'
        : `Deposits per active day rose from ${early.toFixed(1)} to ${recent.toFixed(1)} — more frequent topping-up to stay in play.`,
  }
}

// Marker registry — pure functions only. Aggregate weights are injected from
// the active RiskConfig (per tenant/jurisdiction), not hard-coded here.
const MARKERS: MarkerFn[] = [
  chasingLosses,
  increasingBets,
  depositVolatility,
  lossOfWinnings,
  paymentSwitching,
  impulsiveTransactions,
  longerSessions,
  playFrequency,
  lateNightPlay,
  fasterGames,
  toleranceForLoss,
  inabilityToStop,
  depositEscalation,
]

/** Compute all 13 markers for a slice of a player's window, weighting each by
 *  the supplied marker-weight map (defaults to the platform default weights). */
export function computeMarkers(
  activity: DailyActivity[],
  weights: Record<string, number> = DEFAULT_MARKER_WEIGHTS,
): MarkerResult[] {
  const w = windows(activity)
  return MARKERS.map((fn) => {
    const r = fn(w)
    return { ...r, weight: weights[r.id] ?? 1 }
  })
}

export function computeMarkersForPlayer(
  player: PlayerProfile,
  weights?: Record<string, number>,
): MarkerResult[] {
  return computeMarkers(player.activity, weights)
}
