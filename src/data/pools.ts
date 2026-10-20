// Reference pools for synthetic player generation.
// Geography follows the illustrative multi-market country mix in
// referenceProfile.ts. The operator settles in EUR, so every synthetic account uses
// EUR as its display currency.

import { REFERENCE_PROFILE } from './referenceProfile'

export const JURISDICTIONS: { country: string; code: string; currency: string }[] =
  REFERENCE_PROFILE.countries.map(([code, name]) => ({ country: name, code, currency: 'EUR' }))

/** Country share weights for sampling, keyed for weightedPick. */
export const COUNTRY_WEIGHTS: [{ country: string; code: string; currency: string }, number][] =
  REFERENCE_PROFILE.countries.map(([code, name, share]) => [
    { country: name, code, currency: 'EUR' },
    share,
  ])

export const AGE_BANDS = ['18-24', '25-34', '35-44', '45-54', '55-64', '65+']

/** Map a sampled age (years) to its display band. */
export function ageToBand(age: number): string {
  if (age < 25) return '18-24'
  if (age < 35) return '25-34'
  if (age < 45) return '35-44'
  if (age < 55) return '45-54'
  if (age < 65) return '55-64'
  return '65+'
}

export const SLOW_GAMES = ['Sportsbook', 'Bingo', 'Lottery', 'Poker']
export const MEDIUM_GAMES = ['Blackjack', 'Roulette', 'Baccarat', 'Live Casino']
export const FAST_GAMES = ['Online Slots', 'Crash Games', 'Instant Win', 'Turbo Roulette']

// Handle parts for anonymised, pseudonymous player identifiers.
export const HANDLE_ADJECTIVES = [
  'silver',
  'crimson',
  'azure',
  'golden',
  'velvet',
  'amber',
  'cobalt',
  'ivory',
  'scarlet',
  'jade',
  'onyx',
  'copper',
  'midnight',
  'frost',
  'ember',
  'slate',
]

export const HANDLE_NOUNS = [
  'falcon',
  'otter',
  'lynx',
  'heron',
  'badger',
  'marten',
  'osprey',
  'wolf',
  'raven',
  'fox',
  'stag',
  'hawk',
  'bison',
  'crane',
  'puma',
  'orca',
]
