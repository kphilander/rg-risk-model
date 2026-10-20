// EXAMPLE marker plugin — shows how to add a new behavioral marker in one file.
// "Weekend concentration": what share of a player's turnover lands on Sat/Sun.
// (Uses day-of-week — a signal none of the base 13 markers look at.)
//
// It's a normal module: importing it registers the marker. See EXTENDING.md.

import { defineMarker } from '../markers'

export const weekendConcentration = defineMarker({
  id: 'weekend-concentration',
  label: 'Weekend concentration',
  domain: 'temporal',
  weight: 0.7,
  compute: (activity) => {
    let weekend = 0
    let total = 0
    for (const d of activity) {
      if (!d.played) continue
      const turnover = d.avgStake * d.bets
      total += turnover
      const day = new Date(`${d.date}T00:00:00Z`).getUTCDay() // 0 = Sun … 6 = Sat
      if (day === 0 || day === 6) weekend += turnover
    }
    const share = total > 0 ? weekend / total : 0
    // Weekends are ~2/7 (29%) of days; concentration well above that is notable.
    const score = Math.max(0, Math.min(100, ((share - 0.29) / (0.7 - 0.29)) * 100))
    return {
      score,
      value: `${Math.round(share * 100)}% weekend`,
      explanation:
        score < 15
          ? 'Play is spread evenly across the week.'
          : `${Math.round(share * 100)}% of turnover is concentrated on weekends — a compressed, high-intensity play pattern.`,
    }
  },
})
