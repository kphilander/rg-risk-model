// ---------------------------------------------------------------------------
// JURISDICTION RULE-PACKS — player-facing guidance per licence region.
//
// Complements core/config.ts (which tunes SCORING per jurisdiction): this
// module carries the operational guidance — the right helpline, regulator,
// minimum age, and mandatory responsible-gambling statement — so interventions
// and regulator report packs reference the correct local resources for each
// player's jurisdiction.
//
// NOTE: entries are ILLUSTRATIVE DEFAULTS assembled from well-known public
// sources. Helplines, minimum ages, and mandated wording change over time and
// vary by product/state — an operator MUST verify every entry with local
// counsel and the relevant regulator, and override per deployment. Where no
// widely-known national helpline exists, Gambling Therapy (a real, free,
// multilingual online support service) is used as the referral.
// ---------------------------------------------------------------------------

export interface JurisdictionGuide {
  id: string
  name: string
  age: number
  helpline: string
  helplineLabel: string
  regulator: string
  mandatory: string
}

/** Common licensed markets, alphabetical by name. Malta is the demo
 *  tenant's licence jurisdiction. */
export const JURISDICTIONS: JurisdictionGuide[] = [
  {
    id: 'AT',
    name: 'Austria',
    age: 18,
    helpline: '+43 1 544 13 57',
    helplineLabel: 'Spielsuchthilfe Wien',
    regulator: 'Federal Ministry of Finance (BMF) — gambling supervision',
    mandatory: '18+. Gambling can be addictive — play responsibly.',
  },
  {
    id: 'BE',
    name: 'Belgium',
    age: 21,
    helpline: '0800 35 777',
    helplineLabel: 'SOS Jeux / SOS Spelen (free, anonymous)',
    regulator: 'Kansspelcommissie — Belgian Gaming Commission',
    mandatory: '21+. Gambling can be addictive — play in moderation. Self-exclusion via EPIS.',
  },
  {
    id: 'CA',
    name: 'Canada',
    age: 19,
    helpline: '1-866-531-2600',
    helplineLabel: 'ConnexOntario (other provinces vary)',
    regulator: 'Provincial regulators (AGCO / iGaming Ontario et al.)',
    mandatory: '19+ (18+ in some provinces). Gambling can be addictive — play responsibly.',
  },
  {
    id: 'CZ',
    name: 'Czechia',
    age: 18,
    helpline: '800 350 000',
    helplineLabel: 'Národní linka pro odvykání (national quitline)',
    regulator: 'Ministry of Finance (Czechia)',
    mandatory: '18+. Warning: participation in gambling can lead to addiction — play responsibly.',
  },
  {
    id: 'FR',
    name: 'France',
    age: 18,
    helpline: '09 74 75 13 13',
    helplineLabel: 'Joueurs Info Service (8:00–02:00, non-premium)',
    regulator: 'ANJ — Autorité Nationale des Jeux',
    mandatory: '18+. Gambling involves risks: debt, isolation, dependency. Support: 09 74 75 13 13.',
  },
  {
    id: 'DE',
    name: 'Germany',
    age: 18,
    helpline: '0800 137 27 00',
    helplineLabel: 'BZgA gambling-addiction helpline (free)',
    regulator: 'GGL — Gemeinsame Glücksspielbehörde der Länder',
    mandatory: '18+. Gambling can be addictive — play responsibly. Nationwide self-exclusion via OASIS.',
  },
  {
    id: 'GR',
    name: 'Greece',
    age: 21,
    helpline: '1114',
    helplineLabel: 'KETHEA-ALFA gambling support line',
    regulator: 'HGC — Hellenic Gaming Commission (ΕΕΕΠ)',
    mandatory: '21+. Frequent play risks addiction and loss of property — play responsibly.',
  },
  {
    id: 'MT',
    name: 'Malta',
    age: 18,
    helpline: '1777',
    helplineLabel: 'RGF Malta helpline (GamCare-supported)',
    regulator: 'MGA — Malta Gaming Authority',
    mandatory: '18+. Gambling can be addictive — play responsibly (rgf.org.mt).',
  },
  {
    id: 'NL',
    name: 'Netherlands',
    age: 18,
    helpline: 'loketkansspel.nl',
    helplineLabel: 'Loket Kansspel — national gambling info point',
    regulator: 'Kansspelautoriteit (KSA)',
    mandatory: '18+. Know what gambling costs you — stop in time. Self-exclusion via CRUKS.',
  },
  {
    id: 'PL',
    name: 'Poland',
    age: 18,
    helpline: '801 889 880',
    helplineLabel: 'Behavioural-addiction helpline (state-funded)',
    regulator: 'Ministry of Finance (Poland)',
    mandatory: '18+. Gambling can be addictive — play responsibly.',
  },
  {
    id: 'PT',
    name: 'Portugal',
    age: 18,
    helpline: 'jogoresponsavel.pt',
    helplineLabel: 'Jogo Responsável — SRIJ player-support portal',
    regulator: 'SRIJ — Serviço de Regulação e Inspeção de Jogos',
    mandatory: '18+. Gambling can be addictive — play responsibly.',
  },
  {
    id: 'ES',
    name: 'Spain',
    age: 18,
    helpline: 'jugarbien.es',
    helplineLabel: 'jugarBIEN — DGOJ safer-gambling portal',
    regulator: 'DGOJ — Dirección General de Ordenación del Juego',
    mandatory: '18+. Gambling can be addictive — play responsibly. Self-exclusion register: RGIAJ.',
  },
  {
    id: 'SE',
    name: 'Sweden',
    age: 18,
    helpline: '020-81 91 00',
    helplineLabel: 'Stödlinjen — national support line',
    regulator: 'Spelinspektionen — Swedish Gambling Authority',
    mandatory: '18+. Gambling can be addictive — play responsibly. Self-exclude at Spelpaus.se.',
  },
  {
    id: 'CH',
    name: 'Switzerland',
    age: 18,
    helpline: '0800 040 080',
    helplineLabel: 'SOS Spielsucht (free, 24/7)',
    regulator: 'Gespa & ESBK — Swiss gambling supervisory authorities',
    mandatory: '18+. Gambling can be addictive — play responsibly (sos-spielsucht.ch).',
  },
  {
    id: 'GB',
    name: 'United Kingdom',
    age: 18,
    helpline: '0808 8020 133',
    helplineLabel: 'GamCare — National Gambling Helpline (24/7)',
    regulator: 'Gambling Commission (Great Britain)',
    mandatory: '18+. Gambling can be addictive — play responsibly. Free self-exclusion via GAMSTOP; support at BeGambleAware.org.',
  },
  {
    id: 'US',
    name: 'United States',
    age: 21,
    helpline: '1-800-GAMBLER',
    helplineLabel: 'National Problem Gambling Helpline (24/7)',
    regulator: 'State gaming regulators (varies by state)',
    mandatory: '21+. Gambling problem? Call or text 1-800-GAMBLER.',
  },
]

/** Fallback when a player's jurisdiction has no configured pack. */
export const DEFAULT_GUIDE: JurisdictionGuide = {
  id: 'XX',
  name: 'Unmapped jurisdiction',
  age: 18,
  helpline: 'gamblingtherapy.org',
  helplineLabel: 'Gambling Therapy (global, multilingual)',
  regulator: 'Verify local regulator per deployment',
  mandatory: '18+. Gambling can be addictive — play responsibly.',
}

/** Tenant-level licence keys (core/config.ts) → player-level guide ids. */
const ALIASES: Record<string, string> = {
  UK: 'GB',
  UKGC: 'GB',
  MGA: 'MT',
  ON: 'CA',
}

const BY_ID = new Map(JURISDICTIONS.map((g) => [g.id, g]))

/** Resolve the guide for a jurisdiction code (ISO-2 or licence key). */
export function guideFor(jurisdiction: string): JurisdictionGuide {
  const key = (jurisdiction ?? '').trim().toUpperCase()
  return BY_ID.get(ALIASES[key] ?? key) ?? DEFAULT_GUIDE
}
