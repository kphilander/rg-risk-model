import { create } from 'zustand'
import type { GameSpeed } from '../types'
import { scoreGame, type GameRiskProfile } from '../lib/gameRisk'
import { BRAND } from '../brand'

// Game-catalog store for the game-risk lens. Kept separate from the primary
// portfolio store (useStore) and persisted independently to localStorage,
// mirroring the app's own manual-persistence pattern (see useCaseStore).

const GAMES_KEY = `${BRAND.slug}.games.v1`

export type GameAnswers = Record<string, number | boolean>

export interface CatalogGame {
  id: string
  name: string
  category: string
  /** Tempo class used to join the catalog against player activity gameSpeed. */
  speedClass: GameSpeed
  answers: GameAnswers
  profile: GameRiskProfile
}

// Six seeded archetypes with plausible, pre-filled answer sheets. Answers are
// static data; profiles are always derived via scoreGame so the instrument
// stays the single source of truth.
const SEED_SHEETS: Omit<CatalogGame, 'profile'>[] = [
  {
    id: 'turbo-slots',
    name: 'Turbo online slots',
    category: 'Slots',
    speedClass: 'fast',
    answers: {
      roundSeconds: 2.5,
      turboMode: true,
      skipAnimation: true,
      forcedPauses: false,
      stakeSpan: 500,
      sideBets: true,
      inSessionDeposit: true,
      rtp: 94,
      hitFrequency: 28,
      jackpotVolatility: 5,
    },
  },
  {
    id: 'classic-slots',
    name: 'Classic slots',
    category: 'Slots',
    speedClass: 'fast',
    answers: {
      roundSeconds: 12,
      turboMode: false,
      skipAnimation: false,
      forcedPauses: false,
      stakeSpan: 200,
      sideBets: true,
      inSessionDeposit: true,
      rtp: 96,
      hitFrequency: 32,
      jackpotVolatility: 3,
    },
  },
  {
    id: 'live-blackjack',
    name: 'Live blackjack',
    category: 'Live casino',
    speedClass: 'medium',
    answers: {
      roundSeconds: 35,
      turboMode: false,
      skipAnimation: false,
      forcedPauses: false,
      stakeSpan: 100,
      sideBets: true,
      inSessionDeposit: true,
      rtp: 99,
      hitFrequency: 45,
      jackpotVolatility: 1,
    },
  },
  {
    id: 'live-roulette',
    name: 'Live roulette',
    category: 'Live casino',
    speedClass: 'medium',
    answers: {
      roundSeconds: 40,
      turboMode: false,
      skipAnimation: false,
      forcedPauses: false,
      stakeSpan: 500,
      sideBets: false,
      inSessionDeposit: true,
      rtp: 97,
      hitFrequency: 40,
      jackpotVolatility: 2,
    },
  },
  {
    id: 'inplay-sports',
    name: 'In-play sports betting',
    category: 'Sportsbook',
    speedClass: 'fast',
    answers: {
      roundSeconds: 20,
      turboMode: false,
      skipAnimation: false,
      forcedPauses: false,
      stakeSpan: 300,
      sideBets: true,
      inSessionDeposit: true,
      rtp: 93,
      hitFrequency: 40,
      jackpotVolatility: 3,
    },
  },
  {
    id: 'prematch-sports',
    name: 'Pre-match sports betting',
    category: 'Sportsbook',
    speedClass: 'slow',
    answers: {
      roundSeconds: 60,
      turboMode: false,
      skipAnimation: false,
      forcedPauses: true,
      stakeSpan: 100,
      sideBets: false,
      inSessionDeposit: true,
      rtp: 95,
      hitFrequency: 30,
      jackpotVolatility: 2,
    },
  },
]

function seedCatalog(): CatalogGame[] {
  return SEED_SHEETS.map((g) => ({ ...g, profile: scoreGame(g.answers) }))
}

function loadGames(): CatalogGame[] | null {
  try {
    const raw = localStorage.getItem(GAMES_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return null
    const seeds = new Map(SEED_SHEETS.map((s) => [s.id, s]))
    // Re-hydrate defensively: back-fill any newly added questions from the
    // seed sheet, then re-score so persisted profiles never go stale against
    // an updated instrument.
    return (parsed as CatalogGame[])
      .filter((g) => g && typeof g.id === 'string' && g.answers)
      .map((g) => {
        const seed = seeds.get(g.id)
        const answers = { ...(seed?.answers ?? {}), ...g.answers }
        return { ...(seed ?? {}), ...g, answers, profile: scoreGame(answers) }
      })
  } catch {
    /* corrupt or unavailable storage — fall back to seeds */
  }
  return null
}

function persist(games: CatalogGame[]): void {
  try {
    localStorage.setItem(GAMES_KEY, JSON.stringify(games))
  } catch {
    /* ignore quota / private-mode errors */
  }
}

interface GameStoreState {
  games: CatalogGame[]
  seeded: boolean
  /** Merge new answers for one game and re-score it. */
  updateAnswers: (id: string, answers: GameAnswers) => void
  /** Restore the six seeded archetypes (discards operator edits). */
  resetCatalog: () => void
}

const initial = loadGames()

export const useGameStore = create<GameStoreState>((set, get) => ({
  games: initial ?? seedCatalog(),
  seeded: initial !== null,

  updateAnswers: (id, answers) => {
    const next = get().games.map((g) => {
      if (g.id !== id) return g
      const merged = { ...g.answers, ...answers }
      return { ...g, answers: merged, profile: scoreGame(merged) }
    })
    persist(next)
    set({ games: next, seeded: true })
  },

  resetCatalog: () => {
    const games = seedCatalog()
    persist(games)
    set({ games, seeded: true })
  },
}))
