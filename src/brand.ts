// ---------------------------------------------------------------------------
// Central brand definition for this white-label player-protection platform.
// Change these values to rebrand the entire UI (wordmark, page title, storage
// keys, export file names) in a single place.
// ---------------------------------------------------------------------------

export const BRAND = {
  /** Full product name. */
  name: 'RG Risk Model',
  /** Two-weight wordmark: "RG" (heavy) + "Risk Model" (light). */
  wordmark: ['RG', 'Risk Model'] as const,
  /** Short descriptor shown beneath the wordmark. */
  tagline: 'Responsible Gaming Analytics',
  /** Lowercase slug used for storage keys, export filenames, package id. */
  slug: 'rg-risk',
}
