// ---------------------------------------------------------------------------
// PROJECTION — canonical events → per-player feature windows.
//
// Folds a batch (or stream) of CanonicalEvents, plus identity reference data,
// into the rolling daily windows the scoring engine consumes. This is the piece
// every real operator integration runs after its ingestion adapters; the
// synthetic source skips it by producing windows directly.
// ---------------------------------------------------------------------------

import { addDays, differenceInCalendarDays, formatISO, parseISO, subDays } from 'date-fns'
import type { DailyActivity, GameSpeed, PlayerProfile } from '../types'
import type { CanonicalEvent, CanonicalPlayer, IdentityRecord } from './canonical'
import type { Projection } from './ports'

export interface ProjectionOptions {
  identities: IdentityRecord[]
  windowDays: number
  /** End of the window ("now"). Days are [asOf-(windowDays-1) … asOf]. */
  asOf: Date
}

interface DayAcc extends DailyActivity {
  _stake: number
  _payout: number
  _speed: Record<string, number>
  _method: Record<string, number>
  _nightSum: number
  _nightN: number
}

function emptyDay(date: string, dayIndex: number): DayAcc {
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
    _stake: 0,
    _payout: 0,
    _speed: {},
    _method: {},
    _nightSum: 0,
    _nightN: 0,
  }
}

function dominant(tally: Record<string, number>, fallback: string): string {
  let best = fallback
  let bestN = -1
  for (const [k, n] of Object.entries(tally)) {
    if (n > bestN) {
      bestN = n
      best = k
    }
  }
  return best
}

function round2(n: number): number {
  return Math.round(n * 100) / 100
}

export class EventProjection implements Projection {
  private readonly windowDays: number
  private readonly asOf: Date
  private readonly startDate: Date
  private readonly identities: Map<string, IdentityRecord>

  constructor(opts: ProjectionOptions) {
    this.windowDays = opts.windowDays
    this.asOf = opts.asOf
    this.startDate = subDays(opts.asOf, opts.windowDays - 1)
    this.identities = new Map(opts.identities.map((i) => [i.playerRef, i]))
  }

  /** Map an ISO timestamp to a day index in the window, or -1 if outside it. */
  private dayIndex(ts: string): number {
    const idx = differenceInCalendarDays(parseISO(ts), this.startDate)
    return idx >= 0 && idx < this.windowDays ? idx : -1
  }

  project(events: CanonicalEvent[]): CanonicalPlayer[] {
    // Window scaffold per player (seed from identities so known accounts always
    // appear, even with no activity in-window).
    const windows = new Map<string, DayAcc[]>()
    const dates = Array.from({ length: this.windowDays }, (_, d) =>
      formatISO(addDays(this.startDate, d), { representation: 'date' }),
    )
    const ensure = (ref: string) => {
      let w = windows.get(ref)
      if (!w) {
        w = dates.map((date, i) => emptyDay(date, i))
        windows.set(ref, w)
      }
      return w
    }
    for (const id of this.identities.keys()) ensure(id)

    // Fold events into day buckets.
    for (const e of events) {
      const di = this.dayIndex(e.ts)
      if (di < 0) continue
      const day = ensure(e.playerRef)[di]
      switch (e.type) {
        case 'wager': {
          const n = e.bets ?? 1
          day.bets += n
          day._stake += e.stake
          day._payout += e.payout
          day.peakStake = Math.max(day.peakStake, e.peakStake ?? e.stake)
          day._speed[e.gameSpeed] = (day._speed[e.gameSpeed] ?? 0) + n
          day.played = true
          break
        }
        case 'wallet': {
          if (e.kind === 'deposit' && e.status === 'settled') {
            day.deposits += e.amount
            day.depositCount += 1
          } else if (e.kind === 'withdrawal' && e.status === 'settled') {
            day.withdrawals += e.amount
          } else if (e.kind === 'withdrawal_cancel') {
            day.withdrawalCancellations += 1
          }
          if (e.method) day._method[e.method] = (day._method[e.method] ?? 0) + 1
          break
        }
        case 'session': {
          day.sessions += 1
          day.minutes += e.durationMin
          day._nightSum += e.nightFraction
          day._nightN += 1
          if (e.durationMin > 0) day.played = true
          break
        }
        case 'rg':
          // Reserved for self-exclusion / cool-off handling.
          break
      }
    }

    // Finalise each day + assemble player profiles.
    const players: PlayerProfile[] = []
    for (const [ref, w] of windows) {
      let lastPlayedIdx = -1
      const activity: DailyActivity[] = w.map((d, i) => {
        const net = round2(d._payout - d._stake)
        const avgStake = d.bets > 0 ? round2(d._stake / d.bets) : 0
        if (d.played) lastPlayedIdx = i
        return {
          date: d.date,
          dayIndex: d.dayIndex,
          played: d.played,
          sessions: d.sessions,
          minutes: Math.round(d.minutes),
          bets: d.bets,
          avgStake,
          peakStake: round2(d.peakStake || avgStake),
          deposits: round2(d.deposits),
          depositCount: d.depositCount,
          withdrawals: round2(d.withdrawals),
          withdrawalCancellations: d.withdrawalCancellations,
          net,
          gameSpeed: dominant(d._speed, 'slow') as GameSpeed,
          paymentMethod: dominant(d._method, ''),
          nightFraction: d._nightN > 0 ? round2(d._nightSum / d._nightN) : 0,
        }
      })

      const id = this.identities.get(ref)
      const lastActive =
        lastPlayedIdx >= 0
          ? `${activity[lastPlayedIdx].date}T${String(18 + (lastPlayedIdx % 5)).padStart(2, '0')}:00:00Z`
          : formatISO(this.startDate)
      const accountAgeDays = id?.accountOpenedAt
        ? Math.max(1, differenceInCalendarDays(this.asOf, parseISO(id.accountOpenedAt)))
        : this.windowDays

      players.push({
        id: ref,
        handle: ref, // operators supply a pseudonymous ref, not a display handle
        country: id?.country ?? 'Unknown',
        jurisdiction: id?.jurisdiction ?? '??',
        ageBand: id?.ageBand ?? 'n/a',
        gender: id?.gender ?? 'X',
        currency: id?.currency ?? 'EUR',
        accountAgeDays,
        lastActive,
        archetype: 'regular', // not provided by operator feeds; informational only
        activity,
      })
    }

    return players
  }
}
