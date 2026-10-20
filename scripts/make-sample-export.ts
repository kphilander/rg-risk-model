// Generates a realistic operator-style CSV export under public/sample-data/.
// Source rows are derived from the synthetic generator and written as the
// granular/daily feeds a real operator would deliver — then the app re-ingests
// them through the CSV → adapters → projection pipeline (proving it round-trips
// from raw rows, not the in-memory generator).
//
//   npx tsx scripts/make-sample-export.ts
//
// NOTE: this produces SYNTHETIC sample data only; no real records.

import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { formatISO, subDays } from 'date-fns'
import { generatePlayers } from '../src/data/generateData'

const ASOF = new Date('2026-06-29T09:00:00Z')
const N = 60
const OUT = join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'sample-data')
mkdirSync(OUT, { recursive: true })

const r2 = (n: number) => Math.round(n * 100) / 100
const PRODUCT: Record<string, string> = { slow: 'Sportsbook', medium: 'Live Casino', fast: 'Online Slots' }
const TXN = { dep: 'DEP', wd: 'WD', cancel: 'WD_CANCEL' }

const players = generatePlayers(N, 'sample-export-v1')

const identities: string[] = ['player_id,country,jurisdiction,age_band,gender,currency,account_opened_at']
const wagers: string[] = ['player_id,date,product,game_speed,bets,stake_eur,winnings_eur,peak_stake_eur']
const wallet: string[] = ['player_id,processed_at,txn_type,amount_eur,method,status']
const sessions: string[] = ['player_id,date,duration_min,night_fraction']

for (const p of players) {
  const opened = formatISO(subDays(ASOF, p.accountAgeDays), { representation: 'date' })
  identities.push(`${p.id},${p.country},${p.jurisdiction},${p.ageBand},${p.gender},${p.currency},${opened}`)

  for (const d of p.activity) {
    if (!d.played) continue

    if (d.bets > 0) {
      const stake = r2(d.avgStake * d.bets)
      const winnings = r2(stake + d.net) // net = winnings - stake
      wagers.push(
        `${p.id},${d.date},${PRODUCT[d.gameSpeed] ?? 'Sportsbook'},${d.gameSpeed},${d.bets},${stake},${winnings},${r2(d.peakStake)}`,
      )
    }

    for (let k = 0; k < d.depositCount; k++) {
      wallet.push(`${p.id},${d.date},${TXN.dep},${r2(d.deposits / Math.max(1, d.depositCount))},${d.paymentMethod},S`)
    }
    if (d.withdrawals > 0) {
      wallet.push(`${p.id},${d.date},${TXN.wd},${r2(d.withdrawals)},${d.paymentMethod},S`)
    }
    for (let k = 0; k < d.withdrawalCancellations; k++) {
      wallet.push(`${p.id},${d.date},${TXN.cancel},${r2(d.withdrawals)},${d.paymentMethod},R`)
    }

    const nSess = Math.max(1, d.sessions)
    for (let k = 0; k < nSess; k++) {
      sessions.push(`${p.id},${d.date},${Math.round(d.minutes / nSess)},${d.nightFraction}`)
    }
  }
}

writeFileSync(join(OUT, 'identities.csv'), identities.join('\n') + '\n')
writeFileSync(join(OUT, 'wagers.csv'), wagers.join('\n') + '\n')
writeFileSync(join(OUT, 'wallet.csv'), wallet.join('\n') + '\n')
writeFileSync(join(OUT, 'sessions.csv'), sessions.join('\n') + '\n')

console.log(
  `Wrote ${players.length} players → public/sample-data/ ` +
    `(${wagers.length - 1} wager, ${wallet.length - 1} wallet, ${sessions.length - 1} session rows)`,
)
