import { addDays, formatISO, subDays } from 'date-fns'
import type {
  ArchetypeId,
  DailyActivity,
  GameSpeed,
  PlayerProfile,
} from '../types'
import { makeRng, type Rng } from '../lib/rng'
import {
  ageToBand,
  COUNTRY_WEIGHTS,
  HANDLE_ADJECTIVES,
  HANDLE_NOUNS,
} from './pools'
import {
  REFERENCE_PROFILE as REF,
  sampleQuantile,
  sampleQuantileAt,
  snapToLadder,
  weightedPick,
} from './referenceProfile'

export const WINDOW_DAYS = 92

// Fixed "now" so the dataset is deterministic regardless of the wall clock.
const REFERENCE_NOW = new Date('2026-06-29T09:00:00Z')

// Behavioural archetypes drive the *dynamics* the risk markers detect (trends,
// chasing, escalation). Monetary magnitudes are NOT hard-coded here — each
// archetype instead occupies a band of the reference stakes-per-day
// distribution via `intensityPct`, so the population's turnover, bet counts,
// deposits and withdrawals reproduce a realistic heavy-tailed shape while every
// value remains synthetic.
interface ArchetypeSpec {
  id: ArchetypeId
  weight: number
  /** Where this archetype sits in the population stakes-per-day distribution. */
  intensityPct: [number, number]
  playProb: number
  playTrend: number
  stakeTrend: number // multiplicative turnover growth across the window
  volatility: number
  chaseStrength: number // 0-1 propensity to deposit & continue after a loss
  nightBase: number
  nightTrend: number
  fastBase: number // probability of fast (casino) games at start
  fastTrend: number
  paymentSwitchProb: number
  withdrawalCancelProb: number
  sessionMinutes: [number, number]
  sessionMinTrend: number
}

const ARCHETYPES: ArchetypeSpec[] = [
  {
    id: 'recreational',
    weight: 40,
    intensityPct: [0.05, 0.45],
    playProb: 0.28,
    playTrend: 0,
    stakeTrend: 0.05,
    volatility: 0.25,
    chaseStrength: 0.02,
    nightBase: 0.05,
    nightTrend: 0,
    fastBase: 0.15,
    fastTrend: 0,
    paymentSwitchProb: 0.03,
    withdrawalCancelProb: 0.18,
    sessionMinutes: [12, 35],
    sessionMinTrend: 0,
  },
  {
    id: 'regular',
    weight: 27,
    intensityPct: [0.4, 0.78],
    playProb: 0.5,
    playTrend: 0.05,
    stakeTrend: 0.12,
    volatility: 0.35,
    chaseStrength: 0.08,
    nightBase: 0.1,
    nightTrend: 0.04,
    fastBase: 0.28,
    fastTrend: 0.05,
    paymentSwitchProb: 0.06,
    withdrawalCancelProb: 0.28,
    sessionMinutes: [20, 55],
    sessionMinTrend: 0.1,
  },
  {
    id: 'rising',
    weight: 12,
    intensityPct: [0.45, 0.82],
    playProb: 0.45,
    playTrend: 0.3,
    stakeTrend: 0.6,
    volatility: 0.5,
    chaseStrength: 0.28,
    nightBase: 0.12,
    nightTrend: 0.18,
    fastBase: 0.4,
    fastTrend: 0.25,
    paymentSwitchProb: 0.14,
    withdrawalCancelProb: 0.45,
    sessionMinutes: [25, 70],
    sessionMinTrend: 0.5,
  },
  {
    id: 'highroller',
    weight: 7,
    intensityPct: [0.9, 0.995],
    playProb: 0.55,
    playTrend: 0.05,
    stakeTrend: 0.1,
    volatility: 0.55,
    chaseStrength: 0.12,
    nightBase: 0.18,
    nightTrend: 0.05,
    fastBase: 0.45,
    fastTrend: 0.05,
    paymentSwitchProb: 0.08,
    withdrawalCancelProb: 0.3,
    sessionMinutes: [30, 80],
    sessionMinTrend: 0.05,
  },
  {
    id: 'chaser',
    weight: 9,
    intensityPct: [0.55, 0.88],
    playProb: 0.6,
    playTrend: 0.32,
    stakeTrend: 1.4,
    volatility: 0.8,
    chaseStrength: 0.62,
    nightBase: 0.2,
    nightTrend: 0.32,
    fastBase: 0.5,
    fastTrend: 0.4,
    paymentSwitchProb: 0.28,
    withdrawalCancelProb: 0.6,
    sessionMinutes: [35, 95],
    sessionMinTrend: 0.9,
  },
  {
    id: 'critical',
    weight: 5,
    intensityPct: [0.62, 0.93],
    playProb: 0.78,
    playTrend: 0.18,
    stakeTrend: 2.2,
    volatility: 1.0,
    chaseStrength: 0.8,
    nightBase: 0.3,
    nightTrend: 0.4,
    fastBase: 0.6,
    fastTrend: 0.35,
    paymentSwitchProb: 0.35,
    withdrawalCancelProb: 0.72,
    sessionMinutes: [45, 130],
    sessionMinTrend: 1.2,
  },
]

function weightedArchetype(rng: Rng): ArchetypeSpec {
  const total = ARCHETYPES.reduce((s, a) => s + a.weight, 0)
  let roll = rng.float(0, total)
  for (const a of ARCHETYPES) {
    if (roll < a.weight) return a
    roll -= a.weight
  }
  return ARCHETYPES[0]
}

function makeHandle(rng: Rng, index: number): string {
  const adj = rng.pick(HANDLE_ADJECTIVES)
  const noun = rng.pick(HANDLE_NOUNS)
  const num = (index * 7 + rng.int(10, 99)) % 1000
  return `${adj}_${noun}${num.toString().padStart(3, '0')}`
}

function buildActivity(rng: Rng, spec: ArchetypeSpec): DailyActivity[] {
  const startDate = subDays(REFERENCE_NOW, WINDOW_DAYS - 1)
  const days: DailyActivity[] = []
  let paymentMethod = weightedPick(rng, REF.paymentMethods)
  let recentLoss = 0 // rolling signal of recent losses (drives chasing)

  // Anchor this player into the reference stakes-per-day distribution.
  // `intensity` sets their typical daily turnover (EUR) and bet count; both are
  // sampled from the reference quantiles, so a whale lands in the tail and a
  // casual player near the floor.
  const intensity = rng.float(spec.intensityPct[0], spec.intensityPct[1])
  const baseTurnover = sampleQuantileAt(REF.stakesPerDayEur, intensity)
  const baseBets = Math.max(
    1,
    Math.round(sampleQuantileAt(REF.betsPerDay, clamp01(intensity + rng.gauss() * 0.05))),
  )

  for (let d = 0; d < WINDOW_DAYS; d++) {
    const progress = d / (WINDOW_DAYS - 1)
    const date = formatISO(addDays(startDate, d), { representation: 'date' })

    let playProb = spec.playProb + spec.playTrend * progress
    // Chasing: a recent loss raises the chance of returning the next day.
    if (recentLoss > 0) playProb += spec.chaseStrength * 0.5
    playProb = Math.max(0, Math.min(0.98, playProb))

    if (!rng.bool(playProb)) {
      recentLoss *= 0.6 // losses cool off when not playing
      days.push(emptyDay(date, d))
      continue
    }

    const sessions = 1 + (rng.bool(0.25 + spec.chaseStrength * 0.4) ? rng.int(1, 3) : 0)

    // Daily turnover (EUR) = base scale × growth × log-normal noise, inflated by
    // chasing after a recent loss.
    const stakeGrowth = 1 + spec.stakeTrend * progress
    const noise = Math.exp(rng.gauss() * spec.volatility * 0.5)
    const chaseBump = recentLoss > 0 ? 1 + spec.chaseStrength * rng.float(0.3, 1.1) : 1
    const turnover = Math.max(0.5, baseTurnover * stakeGrowth * noise * chaseBump)

    const bets = Math.max(
      1,
      Math.round(baseBets * (0.6 + 0.8 * rng.next()) * (1 + spec.chaseStrength * 0.4 * progress)),
    )
    const avgStake = Math.max(0.2, turnover / bets)
    const peakStake = avgStake * rng.float(1.8, 4.5)

    const sessionMin =
      rng.float(spec.sessionMinutes[0], spec.sessionMinutes[1]) *
      (1 + spec.sessionMinTrend * progress)
    const minutes = Math.round(sessionMin * sessions)

    // Money: turnover cycles through; net is negative on average (house edge ≈
    // 1 − payoutRatio) with winning days mixed in.
    const winProb = 0.5 * REF.payoutRatio
    const isWin = rng.next() < winProb
    const net = isWin
      ? turnover * rng.float(0.15, 1.1)
      : -turnover * rng.float(0.25, 0.9)

    // Deposits — drawn from the reference deposit ladder, larger after losses
    // for chasers; deposit *amounts* reproduce realistic €10/20/50/100 clustering.
    const lossPressure = recentLoss > 0 ? spec.chaseStrength : 0
    const depositCount =
      (net < 0 || rng.bool(0.4) ? 1 : 0) +
      (rng.bool(0.2 + lossPressure * 0.6) ? rng.int(1, 3) : 0)
    let deposits = 0
    for (let k = 0; k < depositCount; k++) {
      const u = clamp01(0.25 * intensity + 0.6 * rng.next() + lossPressure * 0.25)
      deposits += snapToLadder(sampleQuantileAt(REF.depositEur, u))
    }

    // Withdrawals and the telltale withdrawal cancellation (profile baseline rate).
    const hasWithdrawal = isWin && rng.bool(0.35)
    const withdrawals = hasWithdrawal
      ? snapToLadder(sampleQuantileAt(REF.withdrawalEur, clamp01(0.3 * intensity + 0.6 * rng.next())))
      : 0
    const withdrawalCancellations =
      hasWithdrawal && rng.bool(spec.withdrawalCancelProb) ? 1 : 0

    if (rng.bool(spec.paymentSwitchProb)) paymentMethod = weightedPick(rng, REF.paymentMethods)

    const fastProb = Math.min(0.95, spec.fastBase + spec.fastTrend * progress)
    const gameSpeed: GameSpeed = rng.bool(fastProb)
      ? 'fast'
      : rng.bool(0.5)
        ? 'medium'
        : 'slow'

    const nightFraction = Math.max(
      0,
      Math.min(1, spec.nightBase + spec.nightTrend * progress + rng.gauss() * 0.06),
    )

    days.push({
      date,
      dayIndex: d,
      played: true,
      sessions,
      minutes,
      bets,
      avgStake: round2(avgStake),
      peakStake: round2(peakStake),
      deposits: round2(deposits),
      depositCount,
      withdrawals: round2(withdrawals),
      withdrawalCancellations,
      net: round2(net),
      gameSpeed,
      paymentMethod,
      nightFraction: round2(nightFraction),
    })

    // Update the rolling loss signal.
    recentLoss = Math.max(0, recentLoss * 0.55 + (net < 0 ? -net : -net * 0.4))
  }

  return days
}

function emptyDay(date: string, dayIndex: number): DailyActivity {
  return {
    date,
    dayIndex,
    played: false,
    sessions: 0,
    minutes: 0,
    bets: 0,
    avgStake: 0,
    peakStake: 0,
    deposits: 0,
    depositCount: 0,
    withdrawals: 0,
    withdrawalCancellations: 0,
    net: 0,
    gameSpeed: 'slow',
    paymentMethod: '',
    nightFraction: 0,
  }
}

function round2(n: number): number {
  return Math.round(n * 100) / 100
}

function clamp01(t: number): number {
  return Math.max(0, Math.min(1, t))
}

function lastActiveISO(activity: DailyActivity[]): string {
  for (let i = activity.length - 1; i >= 0; i--) {
    if (activity[i].played) {
      // Anchor to that date with a plausible evening time.
      return `${activity[i].date}T${String(18 + (i % 5)).padStart(2, '0')}:0${i % 6}:00Z`
    }
  }
  return formatISO(subDays(REFERENCE_NOW, WINDOW_DAYS))
}

export function generatePlayers(count = 250, seed = 'rg-risk-v1'): PlayerProfile[] {
  const rng = makeRng(seed)
  const players: PlayerProfile[] = []

  for (let i = 0; i < count; i++) {
    const spec = weightedArchetype(rng)
    // Demographics sampled from the illustrative profile: male-skewed,
    // European-led geography, EUR settlement.
    const jur = weightedPick(rng, COUNTRY_WEIGHTS)
    const age = Math.round(Math.max(18, sampleQuantile(rng, REF.age)))
    const gender = weightedPick(rng, [
      ['M', REF.gender.M] as ['M', number],
      ['F', REF.gender.F] as ['F', number],
      ['X', 0.004] as ['X', number],
    ])
    const activity = buildActivity(rng, spec)
    players.push({
      id: `P-${(100000 + i).toString()}`,
      handle: makeHandle(rng, i),
      country: jur.country,
      jurisdiction: jur.code,
      ageBand: ageToBand(age),
      gender,
      currency: jur.currency,
      accountAgeDays: rng.int(120, 4000),
      lastActive: lastActiveISO(activity),
      archetype: spec.id,
      activity,
    })
  }

  return players
}
